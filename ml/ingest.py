"""
ingest.py  -  Ingestion and normalization for real network metadata.

Supports:
1. Zeek logs (conn.log and ssl.log in both TSV and JSON/JSON-lines formats).
2. Generic Flow CSV files (NetFlow/IPFIX/benchmark CSVs).
3. Identity resolution (asset table mapping src_ip -> user_id, role, or deterministic pseudonymization).
4. Local destination categorization (SNI -> policy category).
5. Ground-truth label merging or explicit unlabeled tracking.
6. Dataset manifest generation (recording provenance, schema mapping, and license).

Strictly metadata-only: zero payload, packet-capture bytes, or credentials collected.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO not in sys.path:
    sys.path.insert(0, REPO)

from api.config import DEST_CATEGORIES


# ── Zeek TSV / JSON Parsers ───────────────────────────────────────────────────

def detect_zeek_format(path: str | Path) -> str:
    """Detect whether a Zeek log file is TSV or JSON."""
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line_str = line.strip()
            if not line_str:
                continue
            if line_str.startswith("{") or line_str.startswith("["):
                return "json"
            if line_str.startswith("#separator") or line_str.startswith("#fields"):
                return "tsv"
            # Fallback check
            if "\t" in line_str:
                return "tsv"
    return "json"


def parse_zeek_tsv(path: str | Path) -> pd.DataFrame:
    """
    Parse a native Zeek TSV log file with comment headers:
      #separator \x09
      #fields    ts uid id.orig_h ...
      #types     time string addr ...
    Handles '-' as null values.
    """
    fields: Optional[List[str]] = None
    delimiter = "\t"
    data_lines: List[List[str]] = []

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line_clean = line.rstrip("\r\n")
            if not line_clean:
                continue
            if line_clean.startswith("#separator"):
                # E.g. #separator \x09
                parts = line_clean.split(None, 1)
                if len(parts) > 1:
                    raw_sep = parts[1]
                    if "\\x09" in raw_sep:
                        delimiter = "\t"
                    elif "\\x20" in raw_sep:
                        delimiter = " "
                continue
            if line_clean.startswith("#fields"):
                parts = line_clean.split()
                fields = parts[1:]
                continue
            if line_clean.startswith("#"):
                # Header or footer metadata (#types, #open, #close)
                continue

            # Data line
            tokens = line_clean.split(delimiter)
            data_lines.append(tokens)

    if not fields:
        # If no #fields header was present, try reading with standard read_csv
        return pd.read_csv(path, sep="\t", comment="#", na_values=["-", "(empty)"])

    df = pd.DataFrame(data_lines, columns=fields)
    # Replace Zeek null placeholder '-' and '(empty)' with None/NaN
    df = df.replace({"-": None, "(empty)": None})
    return df


def parse_zeek_json(path: str | Path) -> pd.DataFrame:
    """Parse Zeek log in JSON or JSON-lines format."""
    records = []
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        first_char = f.read(1)
        f.seek(0)
        if first_char == "[":
            # JSON array
            return pd.read_json(path)
        # JSON lines
        for line in f:
            line_str = line.strip()
            if not line_str:
                continue
            try:
                records.append(json.loads(line_str))
            except json.JSONDecodeError:
                continue
    return pd.DataFrame(records)


def load_zeek_log(path: str | Path) -> pd.DataFrame:
    """Load Zeek log in either format automatically."""
    fmt = detect_zeek_format(path)
    if fmt == "tsv":
        return parse_zeek_tsv(path)
    return parse_zeek_json(path)


# ── Timestamp & Identity Normalization ────────────────────────────────────────

def normalize_timestamp(val: Any) -> pd.Timestamp:
    """Convert float epoch, string epoch, or ISO string to UTC Timestamp."""
    if pd.isna(val) or val is None:
        return pd.Timestamp.now(tz="UTC")
    try:
        # Check if numeric float/int epoch
        fval = float(val)
        return pd.to_datetime(fval, unit="s", utc=True)
    except (ValueError, TypeError):
        pass
    try:
        return pd.to_datetime(val, utc=True)
    except Exception:
        return pd.Timestamp.now(tz="UTC")


def pseudonymize_ip(ip: str, prefix: str = "U-IP") -> str:
    """Deterministic, non-reversible pseudonym identifier for an IP address."""
    clean_ip = str(ip).strip()
    h = hashlib.sha256(clean_ip.encode("utf-8")).hexdigest()[:6]
    return f"{prefix}-{h}"


def load_identity_map(path: Optional[str | Path]) -> Dict[str, Dict[str, str]]:
    """
    Load an asset/identity mapping file (CSV or JSON).
    Maps IP address -> {"user_id": str, "role": str}.
    """
    if not path or not os.path.isfile(path):
        return {}
    p = Path(path)
    if p.suffix == ".json":
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    # CSV with columns: ip, user_id, role
    df = pd.read_csv(p)
    col_map = {c.lower(): c for c in df.columns}
    ip_col = col_map.get("ip") or col_map.get("src_ip")
    uid_col = col_map.get("user_id") or col_map.get("entity")
    role_col = col_map.get("role") or col_map.get("department")
    mapping = {}
    if ip_col and uid_col:
        for _, row in df.iterrows():
            ip_val = str(row[ip_col]).strip()
            uid_val = str(row[uid_col]).strip()
            role_val = str(row[role_col]).strip() if role_col else "unassigned"
            mapping[ip_val] = {"user_id": uid_val, "role": role_val}
    return mapping


def match_dest_category(sni: str, policy: Optional[Dict[str, str]] = None) -> str:
    """
    Map SNI domain to a destination policy category using the policy dict.
    Supports exact domain and parent-domain matching (e.g. sub.mega.nz -> personal_file_sharing).
    """
    if not sni or sni == "unknown":
        return "unknown"
    cat_policy = policy or DEST_CATEGORIES
    sni_lower = sni.lower().strip()
    if sni_lower in cat_policy:
        return cat_policy[sni_lower]
    # Check parent domain suffix (e.g. upload.dropbox.com -> dropbox.com)
    parts = sni_lower.split(".")
    for i in range(1, len(parts) - 1):
        parent = ".".join(parts[i:])
        if parent in cat_policy:
            return cat_policy[parent]
    return "unknown"


# ── Core Zeek Ingestion ───────────────────────────────────────────────────────

def ingest_zeek(
    conn_log: str | Path,
    ssl_log: Optional[str | Path] = None,
    identity_map_path: Optional[str | Path] = None,
    labels_path: Optional[str | Path] = None,
    category_policy: Optional[Dict[str, str]] = None,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Ingest Zeek conn.log and ssl.log, join on UID, and produce canonical flows DataFrame.
    """
    conn_df = load_zeek_log(conn_log)
    if conn_df.empty:
        raise ValueError(f"conn.log at {conn_log} is empty or invalid.")

    # Flatten nested columns if JSON has 'id.orig_h' as dict
    if "id" in conn_df.columns and isinstance(conn_df["id"].iloc[0], dict):
        id_series = conn_df["id"]
        conn_df["id.orig_h"] = id_series.apply(lambda d: d.get("orig_h") if isinstance(d, dict) else None)
        conn_df["id.resp_h"] = id_series.apply(lambda d: d.get("resp_h") if isinstance(d, dict) else None)
        conn_df["id.resp_p"] = id_series.apply(lambda d: d.get("resp_p") if isinstance(d, dict) else None)

    # Normalize conn.log column names
    col_map = {c.lower(): c for c in conn_df.columns}
    ts_col = col_map.get("ts", "ts")
    uid_col = col_map.get("uid", "uid")
    orig_h_col = col_map.get("id.orig_h") or col_map.get("orig_h") or col_map.get("id_orig_h")
    resp_h_col = col_map.get("id.resp_h") or col_map.get("resp_h") or col_map.get("id_resp_h")
    duration_col = col_map.get("duration", "duration")
    orig_bytes_col = col_map.get("orig_bytes") or col_map.get("orig_ip_bytes")
    resp_bytes_col = col_map.get("resp_bytes") or col_map.get("resp_ip_bytes")

    # Load ssl.log if provided
    ssl_df = pd.DataFrame()
    if ssl_log and os.path.isfile(ssl_log):
        ssl_raw = load_zeek_log(ssl_log)
        if not ssl_raw.empty:
            ssl_cols = {c.lower(): c for c in ssl_raw.columns}
            ssl_uid = ssl_cols.get("uid", "uid")
            ssl_sni = ssl_cols.get("server_name") or ssl_cols.get("host")
            ssl_ja4 = ssl_cols.get("ja4") or ssl_cols.get("ja3")

            ssl_sub = pd.DataFrame()
            if ssl_uid in ssl_raw.columns:
                ssl_sub["uid"] = ssl_raw[ssl_uid]
                ssl_sub["sni"] = ssl_raw[ssl_sni] if ssl_sni and ssl_sni in ssl_raw.columns else "unknown"
                ssl_sub["ja4"] = ssl_raw[ssl_ja4] if ssl_ja4 and ssl_ja4 in ssl_raw.columns else "unknown"
                ssl_df = ssl_sub.drop_duplicates(subset=["uid"])

    # Merge conn and ssl on uid
    if not ssl_df.empty and uid_col in conn_df.columns:
        merged = pd.merge(conn_df, ssl_df, left_on=uid_col, right_on="uid", how="left")
    else:
        merged = conn_df.copy()
        merged["sni"] = "unknown"
        merged["ja4"] = "unknown"

    merged["sni"] = merged["sni"].fillna("unknown").astype(str).replace({"": "unknown", "-": "unknown", "None": "unknown"})
    merged["ja4"] = merged["ja4"].fillna("unknown").astype(str).replace({"": "unknown", "-": "unknown", "None": "unknown"})

    # Parse timestamps
    ts_series = merged[ts_col].apply(normalize_timestamp) if ts_col in merged.columns else pd.Series(pd.Timestamp.now(tz="UTC"), index=merged.index)

    # IP resolution & identity mapping
    orig_ips = merged[orig_h_col].fillna("0.0.0.0").astype(str) if orig_h_col else pd.Series("0.0.0.0", index=merged.index)
    identity_map = load_identity_map(identity_map_path)

    user_ids: List[str] = []
    roles: List[str] = []
    for ip in orig_ips:
        clean = ip.strip()
        if clean in identity_map:
            user_ids.append(identity_map[clean].get("user_id", pseudonymize_ip(clean)))
            roles.append(identity_map[clean].get("role", "unassigned"))
        else:
            user_ids.append(pseudonymize_ip(clean))
            roles.append("unassigned")

    # Byte counts & duration
    out_b = pd.to_numeric(merged[orig_bytes_col], errors="coerce").fillna(0).clip(lower=0).astype(int) if orig_bytes_col else pd.Series(0, index=merged.index)
    in_b = pd.to_numeric(merged[resp_bytes_col], errors="coerce").fillna(0).clip(lower=0).astype(int) if resp_bytes_col else pd.Series(0, index=merged.index)
    dur = pd.to_numeric(merged[duration_col], errors="coerce").fillna(0.0).clip(lower=0.0).round(2) if duration_col else pd.Series(0.0, index=merged.index)

    # Destination categorization
    categories = [match_dest_category(s, category_policy) for s in merged["sni"]]

    # Labels & scenarios
    labels = ["unlabeled"] * len(merged)
    scenarios = [None] * len(merged)
    has_labels = False

    if labels_path and os.path.isfile(labels_path):
        lbl_df = pd.read_csv(labels_path)
        lbl_cols = {c.lower(): c for c in lbl_df.columns}
        if "uid" in lbl_cols and uid_col in merged.columns:
            lbl_map = lbl_df.set_index(lbl_cols["uid"])[lbl_cols.get("label", "label")].to_dict()
            sc_map = lbl_df.set_index(lbl_cols["uid"])[lbl_cols.get("scenario", "scenario")].to_dict() if "scenario" in lbl_cols else {}
            labels = [str(lbl_map.get(u, "benign")) for u in merged[uid_col]]
            scenarios = [sc_map.get(u, None) for u in merged[uid_col]]
            has_labels = True

    canonical = pd.DataFrame({
        "ts": ts_series,
        "user_id": user_ids,
        "role": roles,
        "src_ip": orig_ips,
        "sni": merged["sni"],
        "dest_category": categories,
        "out_bytes": out_b,
        "in_bytes": in_b,
        "duration": dur,
        "ja4": merged["ja4"],
        "label": labels,
        "scenario": scenarios,
    })

    canonical = canonical.sort_values("ts").reset_index(drop=True)
    canonical["flow_id"] = canonical.index.map(lambda i: f"f_{i:06d}")

    stats = {
        "flow_count": len(canonical),
        "entity_count": canonical["user_id"].nunique(),
        "time_start": str(canonical["ts"].min()),
        "time_end": str(canonical["ts"].max()),
        "labeled": has_labels,
        "label_counts": canonical["label"].value_counts().to_dict(),
        "sni_known_ratio": round(float((canonical["sni"] != "unknown").mean()), 4),
        "dest_categories": canonical["dest_category"].value_counts().to_dict(),
    }
    return canonical, stats


# ── Flow CSV Ingestion Fallback ───────────────────────────────────────────────

def ingest_flow_csv(
    csv_path: str | Path,
    identity_map_path: Optional[str | Path] = None,
    category_policy: Optional[Dict[str, str]] = None,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Ingest a flow CSV (e.g. CIC-IDS2017, NetFlow, or IPFIX export) and normalize
    into the canonical flow schema.
    """
    df = pd.read_csv(csv_path)
    col_lookup = {c.strip().lower().replace(" ", "_"): c for c in df.columns}

    # Find matching columns
    def find_col(candidates: List[str]) -> Optional[str]:
        for cand in candidates:
            if cand in col_lookup:
                return col_lookup[cand]
        return None

    c_ts = find_col(["ts", "timestamp", "time", "flow_start", "starttime"])
    c_src = find_col(["src_ip", "source_ip", "id.orig_h", "srcip", "sourceip", "src"])
    c_out = find_col(["out_bytes", "totlen_fwd_pkts", "total_length_of_fwd_packets", "orig_bytes", "bytes_sent", "fwd_bytes", "bytesout"])
    c_in = find_col(["in_bytes", "totlen_bwd_pkts", "total_length_of_bwd_packets", "resp_bytes", "bytes_received", "bwd_bytes", "bytesin"])
    c_dur = find_col(["duration", "flow_duration", "dur"])
    c_sni = find_col(["sni", "server_name", "host", "destination_host", "dest_host"])
    c_ja4 = find_col(["ja4", "ja3", "fingerprint"])
    c_lbl = find_col(["label", "class", "attack"])
    c_sc = find_col(["scenario", "scenario_id"])

    ts_series = df[c_ts].apply(normalize_timestamp) if c_ts else pd.Series(pd.Timestamp.now(tz="UTC"), index=df.index)
    src_ips = df[c_src].fillna("0.0.0.0").astype(str) if c_src else pd.Series("0.0.0.0", index=df.index)

    identity_map = load_identity_map(identity_map_path)
    user_ids, roles = [], []
    for ip in src_ips:
        clean = ip.strip()
        if clean in identity_map:
            user_ids.append(identity_map[clean].get("user_id", pseudonymize_ip(clean)))
            roles.append(identity_map[clean].get("role", "unassigned"))
        else:
            user_ids.append(pseudonymize_ip(clean))
            roles.append("unassigned")

    out_b = pd.to_numeric(df[c_out], errors="coerce").fillna(0).clip(lower=0).astype(int) if c_out else pd.Series(0, index=df.index)
    in_b = pd.to_numeric(df[c_in], errors="coerce").fillna(0).clip(lower=0).astype(int) if c_in else pd.Series(0, index=df.index)

    # Durations in NetFlow/CIC-IDS are often microseconds; convert to seconds if max > 1e5
    if c_dur:
        dur_raw = pd.to_numeric(df[c_dur], errors="coerce").fillna(0.0).clip(lower=0.0)
        if dur_raw.max() > 100_000:
            dur = (dur_raw / 1_000_000.0).round(2)
        else:
            dur = dur_raw.round(2)
    else:
        dur = pd.Series(0.0, index=df.index)

    sni_series = df[c_sni].fillna("unknown").astype(str).replace({"": "unknown", "-": "unknown"}) if c_sni else pd.Series("unknown", index=df.index)
    ja4_series = df[c_ja4].fillna("unknown").astype(str).replace({"": "unknown", "-": "unknown"}) if c_ja4 else pd.Series("unknown", index=df.index)
    cats = [match_dest_category(s, category_policy) for s in sni_series]

    has_labels = False
    if c_lbl:
        has_labels = True
        raw_labels = df[c_lbl].astype(str).str.lower()
        norm_labels = raw_labels.apply(lambda l: "exfiltration" if any(k in l for k in ["exfil", "theft", "attack", "malicious"]) else "benign")
    else:
        norm_labels = pd.Series("unlabeled", index=df.index)

    scenarios = df[c_sc].tolist() if c_sc else [None] * len(df)

    canonical = pd.DataFrame({
        "ts": ts_series,
        "user_id": user_ids,
        "role": roles,
        "src_ip": src_ips,
        "sni": sni_series,
        "dest_category": cats,
        "out_bytes": out_b,
        "in_bytes": in_b,
        "duration": dur,
        "ja4": ja4_series,
        "label": norm_labels,
        "scenario": scenarios,
    })

    canonical = canonical.sort_values("ts").reset_index(drop=True)
    canonical["flow_id"] = canonical.index.map(lambda i: f"f_{i:06d}")

    stats = {
        "flow_count": len(canonical),
        "entity_count": canonical["user_id"].nunique(),
        "time_start": str(canonical["ts"].min()),
        "time_end": str(canonical["ts"].max()),
        "labeled": has_labels,
        "label_counts": canonical["label"].value_counts().to_dict(),
        "sni_known_ratio": round(float((canonical["sni"] != "unknown").mean()), 4),
        "dest_categories": canonical["dest_category"].value_counts().to_dict(),
    }
    return canonical, stats


# ── Manifest Generation ───────────────────────────────────────────────────────

def write_manifest(
    out_dir: str | Path,
    dataset_id: str,
    source_type: str,
    provenance: str,
    license_str: str,
    stats: Dict[str, Any],
    train_split: Optional[float] = None,
    train_cutoff: Optional[str] = None,
) -> Path:
    """Create a persistent dataset manifest recording provenance and schema mappings."""
    manifest_path = Path(out_dir) / "manifest.json"
    manifest = {
        "dataset_id": dataset_id,
        "source_type": source_type,
        "provenance": provenance,
        "license": license_str,
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        "metadata_only_verified": True,
        "payload_inspection_performed": False,
        "flow_count": stats.get("flow_count", 0),
        "entity_count": stats.get("entity_count", 0),
        "time_range": {
            "start": stats.get("time_start"),
            "end": stats.get("time_end"),
        },
        "label_availability": "ground_truth" if stats.get("labeled") else "unlabeled",
        "train_split": train_split,
        "train_cutoff": train_cutoff,
        "schema_mapping": {
            "flow_id": "Canonical flow sequence string (f_000001)",
            "ts": "ISO-8601 UTC timestamp",
            "user_id": "Pseudonymous identity (U-IP-xxxx or mapped entity)",
            "role": "Role cohort (department or unassigned)",
            "src_ip": "Source network address",
            "sni": "TLS Server Name Indication (or unknown)",
            "dest_category": "Policy categorization (sanctioned, personal_file_sharing, etc.)",
            "out_bytes": "Egress bytes sent by originator",
            "in_bytes": "Ingress bytes received from responder",
            "duration": "Flow duration in seconds",
            "ja4": "Client TLS fingerprint (or unknown)",
            "label": "benign | exfiltration | unlabeled",
            "scenario": "Labelled scenario tag or null",
        },
        "stats": stats,
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    return manifest_path


def main():
    parser = argparse.ArgumentParser(description="Ingest real Zeek logs or Flow CSV into CipherSentinel schema.")
    parser.add_argument("--conn-log", help="Path to Zeek conn.log (TSV or JSON)")
    parser.add_argument("--ssl-log", help="Path to Zeek ssl.log (TSV or JSON)")
    parser.add_argument("--flow-csv", help="Path to generic Flow CSV fallback")
    parser.add_argument("--identity-map", help="Path to IP-to-entity mapping CSV or JSON")
    parser.add_argument("--labels", help="Path to ground truth labels CSV")
    parser.add_argument("--dataset-id", default="real_network_data", help="Identifier for dataset manifest")
    parser.add_argument("--provenance", default="User-provided network capture / Zeek export", help="Data source provenance")
    parser.add_argument("--license", default="Proprietary / User authorized enterprise telemetry", help="Data license")
    parser.add_argument("--out-dir", default="data/real", help="Output directory")
    args = parser.parse_args()

    out_path = Path(args.out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    if args.conn_log:
        df, stats = ingest_zeek(
            conn_log=args.conn_log,
            ssl_log=args.ssl_log,
            identity_map_path=args.identity_map,
            labels_path=args.labels,
        )
        source_type = "zeek_logs"
    elif args.flow_csv:
        df, stats = ingest_flow_csv(
            csv_path=args.flow_csv,
            identity_map_path=args.identity_map,
        )
        source_type = "flow_csv"
    else:
        parser.error("Must provide either --conn-log (with optional --ssl-log) or --flow-csv.")

    flows_file = out_path / "flows.csv"
    df.to_csv(flows_file, index=False)
    print(f"[ingest] Wrote {len(df)} canonical flows to {flows_file}")

    manifest_file = write_manifest(
        out_dir=out_path,
        dataset_id=args.dataset_id,
        source_type=source_type,
        provenance=args.provenance,
        license_str=args.license,
        stats=stats,
    )
    print(f"[ingest] Manifest created at {manifest_file}")


if __name__ == "__main__":
    main()
