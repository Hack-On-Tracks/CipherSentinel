"""Train and evaluate CipherSentinel on the public UWF-ZeekData24 subset.

The public CSV sample contains benign Zeek connection records and a small,
separately labelled T1048 exfiltration set. Benign records are split in time;
all labelled exfiltration records and the later benign period are held out.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))
if str(REPO / "ml") not in sys.path:
    sys.path.insert(0, str(REPO / "ml"))

from baseline import build_and_save
from evaluate import run as evaluate
from features import build_all
from ingest import write_manifest
from score import score_all
from train import train

DATASET_PAGE = "https://datasets.uwf.edu/"


def prepare_flows(benign_path: Path, attack_path: Path, out_dir: Path, train_fraction: float):
    benign = pd.read_csv(benign_path, low_memory=False)
    attack = pd.read_csv(attack_path, low_memory=False)
    required = {"ts", "src_ip_zeek", "orig_bytes", "resp_bytes", "duration", "label_binary", "label_tactic"}
    for path, frame in ((benign_path, benign), (attack_path, attack)):
        missing = required - set(frame.columns)
        if missing:
            raise ValueError(f"{path} is missing expected UWF fields: {sorted(missing)}")

    if benign.empty or attack.empty:
        raise ValueError("Both benign and labeled exfiltration CSVs must contain rows.")
    if benign["label_binary"].astype(str).str.lower().isin({"true", "1"}).any():
        raise ValueError("The purported benign input includes rows marked malicious.")
    if not attack["label_tactic"].astype(str).str.lower().eq("exfiltration").all():
        raise ValueError("The attack input contains rows not labeled Exfiltration.")

    benign = benign.copy()
    attack = attack.copy()
    benign["label"] = "benign"
    benign["scenario"] = ""
    attack["label"] = "exfiltration"
    attack["scenario"] = attack["label_technique"].fillna("T1048") if "label_technique" in attack else "T1048"

    combined = pd.concat([benign, attack], ignore_index=True)
    # Keep only metadata fields needed by the existing canonical flow schema.
    raw = pd.DataFrame({
        "ts": pd.to_numeric(combined["ts"], errors="coerce"),
        "src_ip": combined["src_ip_zeek"].astype(str),
        "out_bytes": pd.to_numeric(combined["orig_bytes"], errors="coerce").fillna(0),
        "in_bytes": pd.to_numeric(combined["resp_bytes"], errors="coerce").fillna(0),
        "duration": pd.to_numeric(combined["duration"], errors="coerce").fillna(0),
        "dst_port": pd.to_numeric(combined.get("dest_port_zeek", combined.get("dest_port", pd.Series(float("nan"), index=combined.index))), errors="coerce"),
        "label": combined["label"].astype(str),
        "scenario": combined["scenario"].fillna("").astype(str),
    })
    canonical, stats = ingest_flow_csv_from_frame(raw)

    benign_times = pd.to_datetime(
        pd.to_numeric(raw.loc[raw["label"] == "benign", "ts"], errors="coerce"),
        unit="s", utc=True, errors="coerce",
    ).dt.floor("15min")
    unique_windows = pd.Index(benign_times.dropna().unique()).sort_values()
    if len(unique_windows) < 3:
        raise ValueError("Not enough distinct benign 15-minute windows for a train/test split.")
    split_index = min(max(int(len(unique_windows) * train_fraction), 1), len(unique_windows) - 1)
    cutoff = pd.Timestamp(unique_windows[split_index - 1])
    canonical_windows = pd.to_datetime(canonical["ts"], utc=True).dt.floor("15min")
    canonical["evaluation_split"] = "test"
    benign_mask = canonical["label"].astype(str).str.lower().eq("benign")
    canonical.loc[benign_mask & (canonical_windows <= cutoff), "evaluation_split"] = "train"

    out_dir.mkdir(parents=True, exist_ok=True)
    flows_path = out_dir / "flows.csv"
    canonical.to_csv(flows_path, index=False)
    stats["label_counts"] = canonical["label"].value_counts().to_dict()
    stats["training_flow_count"] = int((canonical["evaluation_split"] == "train").sum())
    stats["test_flow_count"] = int((canonical["evaluation_split"] == "test").sum())
    manifest_path = write_manifest(
        out_dir=out_dir,
        dataset_id="UWF-ZeekData24-benign-vs-exfiltration-public-csv-subset",
        source_type="zeek_derived_flow_csv",
        provenance=("Public UWF-ZeekData24 CSV subset: benign Zeek connection records plus the "
                    "separately labeled Exfiltration/T1048 records; source and testbed nature documented."),
        license_str="Creative Commons Attribution (CC BY); cite UWF-ZeekData24 as directed by the source.",
        stats=stats,
        train_split=train_fraction,
        train_cutoff=cutoff.isoformat(),
    )
    manifest = json.loads(manifest_path.read_text())
    manifest["source_url"] = DATASET_PAGE
    manifest["source_files"] = {
        str(path.name): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in (benign_path, attack_path)
    }
    manifest["evaluation_protocol"] = (
        "Train on the earliest 70% (configurable) of benign 15-minute windows; "
        "test on the remaining benign windows plus all exfiltration-labeled records. "
        "The exfiltration records are all held out from fitting."
    )
    manifest["evaluation_caveat"] = (
        "Public UWF-ZeekData24 cyber-range benchmark. The reported scores apply only to this small, "
        "class-imbalanced dataset and must not be interpreted as production performance."
    )
    manifest["limitations"] = [
        "The public CSV subset contains only 23 exfiltration-labeled records, all from one source/destination pair.",
        "Zeek conn records have no SNI or JA4 in these CSVs; those inputs are unknown, not inferred.",
        "This is a cyber-range dataset, not a representative production enterprise capture.",
        "This benchmark tests the existing metadata score; it does not establish production readiness.",
    ]
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"[uwf] Canonical flows -> {flows_path} ({len(canonical)} rows)")
    print(f"[uwf] Benign cutoff: {cutoff}; train flows={stats['training_flow_count']}, test flows={stats['test_flow_count']}")
    return flows_path, manifest_path


def ingest_flow_csv_from_frame(raw: pd.DataFrame):
    """Reuse the canonical CSV normalizer without creating an intermediate raw file."""
    from ingest import ingest_flow_csv
    # The canonicalizer accepts a filesystem path; the dataset is small enough
    # that an in-memory temporary CSV avoids changing the source downloads.
    from tempfile import NamedTemporaryFile
    with NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        temp_path = tmp.name
    try:
        raw.to_csv(temp_path, index=False)
        return ingest_flow_csv(temp_path)
    finally:
        os.unlink(temp_path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--benign-csv", default=str(REPO / "data/external/uwf_zeekdata24/benign.csv"))
    parser.add_argument("--exfiltration-csv", default=str(REPO / "data/external/uwf_zeekdata24/exfiltration.csv"))
    parser.add_argument("--out-dir", default=str(REPO / "data/benchmark/uwf_zeekdata24"))
    parser.add_argument("--train-fraction", type=float, default=0.7)
    args = parser.parse_args()
    if not 0.5 <= args.train_fraction < 1.0:
        parser.error("--train-fraction must be in [0.5, 1.0).")

    out_dir = Path(args.out_dir)
    flows_path, _ = prepare_flows(Path(args.benign_csv), Path(args.exfiltration_csv), out_dir, args.train_fraction)
    feat_15m, _ = build_all(str(flows_path), str(out_dir))
    feat_path = out_dir / "features_15m.csv"
    baseline_dir = str(out_dir)
    build_and_save(feat_path=str(feat_path), out_dir=baseline_dir)
    train(
        feat_path=str(feat_path),
        user_bl_path=str(out_dir / "baselines_user.json"),
        model_path=str(out_dir / "model.joblib"),
        scaler_path=str(out_dir / "scaler.joblib"),
        peer_bl_path=str(out_dir / "baselines_peer.json"),
    )
    features = pd.read_csv(feat_path)
    manifest_path = out_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["feature_window_counts"] = {
        "total": int(len(features)),
        "train": int((features["evaluation_split"] == "train").sum()),
        "test": int((features["evaluation_split"] == "test").sum()),
        "mixed_excluded": int((features["evaluation_split"] == "mixed").sum()),
        "test_exfiltration": int(features.loc[features["evaluation_split"] == "test", "has_exfil"].sum()),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    score_all(
        feat_path=str(feat_path),
        data_dir=baseline_dir,
        out_path=str(out_dir / "alerts.json"),
        evaluation_split="test",
    )
    result = evaluate(data_dir=baseline_dir, out_path=str(out_dir / "evaluation.json"))
    print(f"[uwf] Benchmark complete. Evaluation status: {result.get('evaluation_status', 'unknown')}")
    print(f"[uwf] Artifacts: {out_dir}")


if __name__ == "__main__":
    main()
