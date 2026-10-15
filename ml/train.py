"""
train.py  -  Train Isolation Forest on benign history only.

Uses normalized metadata features (z-scores, ratios, novelty flags, category risk).
Never trains on raw IP addresses or user IDs.
Supports chronological time splitting to prevent training-data leakage.
"""

from __future__ import annotations
import argparse
import json
import os
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler

import importlib

try:
    shap = importlib.import_module("shap")
except Exception:
    shap = None



REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO not in sys.path:
    sys.path.insert(0, REPO)
if os.path.join(REPO, "ml") not in sys.path:
    sys.path.insert(0, os.path.join(REPO, "ml"))

from baseline import EPSILON

FEATURE_COLS = [
    "out_bytes_log", "byte_asymmetry", "cum_out_7d_mb_log", "out_z", "peer_z",
    "new_dest_user", "new_dest_org", "new_region_and_destination",
    "bytes_to_novel_dst_log", "ja4_rare", "is_off_hours", "active_hours_dev",
    "conn_count_log", "max_duration_log", "category_risk", "novel_dst_port",
    "risky_dst_port_share"
]

CATEGORY_RISK = {
    "sanctioned": 0.0,
    "unknown": 0.4,
    "file_transfer": 0.6,
    "personal_file_sharing": 0.8,
    "anonymiser": 1.0,
}


def _z(row: pd.Series, col: str, baselines: dict) -> float:
    bucket = baselines.get(str(row.get("user_id", "")), {})
    try:
        hw_key = str(int(row.get("hour_of_week", 0)))
    except Exception:
        hw_key = "0"
    spec = bucket.get(hw_key, {}).get(col)
    if not spec:
        # Fall back to nearest hour if sparse
        candidates = [h for h in bucket if bucket[h].get(col, {}).get("n", 0) >= 1]
        if candidates:
            try:
                hw_int = int(hw_key)
                nearest = min(candidates, key=lambda h: abs(int(h) - hw_int))
                spec = bucket[nearest].get(col)
            except Exception:
                spec = None
    if not spec:
        return 0.0
    med = float(spec.get("median", 0.0))
    m = float(spec.get("mad", 0.0))
    val = float(row.get(col, 0.0))
    return float(np.clip((val - med) / (m + EPSILON), -10, 50))


def _cohort_z(row: pd.Series, col: str, baselines: dict, key: str) -> float:
    bucket = baselines.get(key, {})
    try:
        hw = int(row.get("hour_of_week", 0))
    except Exception:
        hw = 0
    spec = bucket.get(str(hw), {}).get(col)
    if not spec:
        candidates = [h for h in bucket if bucket[h].get(col, {}).get("n", 0) >= 1]
        if candidates:
            nearest = min(candidates, key=lambda h: abs(int(h) - hw))
            spec = bucket[nearest].get(col)
    if not spec:
        return 0.0
    val = float(row.get(col, 0.0))
    return float(np.clip((val - float(spec.get("median", 0.0))) / (float(spec.get("mad", 0.0)) + EPSILON), -10, 50))


def normalise_features(df: pd.DataFrame, user_bl: dict, peer_bl: dict | None = None) -> np.ndarray:
    records = []
    for _, row in df.iterrows():
        records.append({
            "out_bytes_log": float(row.get("out_bytes_log", np.log1p(max(0, float(row.get("out_bytes", 0)))))),
            "byte_asymmetry": float(row.get("byte_asymmetry", 0.0)),
            "cum_out_7d_mb_log": float(row.get("cum_out_7d_mb_log", 0.0)),
            "out_z": _z(row, "out_bytes", user_bl),
            "peer_z": _cohort_z(row, "out_bytes", peer_bl or {}, str(row.get("role", "unassigned"))),
            "new_dest_user": float(row.get("new_dest_user", 0)),
            "new_dest_org": float(row.get("new_dest_org", 0)),
            "new_region_and_destination": float(row.get("new_region_and_destination", 0)),
            "bytes_to_novel_dst_log": float(row.get("bytes_to_novel_dst_log", 0.0)),
            "ja4_rare": float(row.get("ja4_rare", 0)),
            "is_off_hours": float(row.get("is_off_hours", 0)),
            "active_hours_dev": float(row.get("active_hours_dev", 0)),
            "conn_count_log": float(row.get("conn_count_log", 0.0)),
            "max_duration_log": float(row.get("max_duration_log", 0.0)),
            "category_risk": float(row.get("category_risk", CATEGORY_RISK.get(str(row.get("dest_category", "unknown")), 0.4))),
            "novel_dst_port": float(row.get("novel_dst_port", 0)),
            "risky_dst_port_share": float(row.get("risky_dst_port_share", 0)),
        })
    mat = pd.DataFrame(records, columns=FEATURE_COLS).fillna(0.0).to_numpy(dtype=float)
    return mat


def train(
    feat_path: str | None = None,
    user_bl_path: str | None = None,
    model_path: str | None = None,
    scaler_path: str | None = None,
    peer_bl_path: str | None = None,
    train_split: float | None = None,
    train_until: str | None = None,
    assume_benign_history: bool = False,
    contamination: float = 0.03,
    random_state: int = 42,
):
    data = os.path.join(REPO, "data")
    feat_path = feat_path or os.path.join(data, "features_15m.csv")
    user_bl_path = user_bl_path or os.path.join(data, "baselines_user.json")
    model_path = model_path or os.path.join(data, "model.joblib")
    scaler_path = scaler_path or os.path.join(data, "scaler.joblib")
    peer_bl_path = peer_bl_path or os.path.join(os.path.dirname(user_bl_path), "baselines_peer.json")

    df = pd.read_csv(feat_path)
    df["window"] = pd.to_datetime(df["window"], utc=True)
    df = df.sort_values("window").reset_index(drop=True)

    with open(user_bl_path) as f:
        user_bl = json.load(f)
    peer_bl = {}
    if os.path.isfile(peer_bl_path):
        with open(peer_bl_path) as f:
            peer_bl = json.load(f)

    # Time-based splitting to prevent leakage into evaluation
    if "evaluation_split" in df.columns:
        split_df = df[df["evaluation_split"].astype(str) == "train"].copy()
        if split_df.empty:
            raise ValueError("No feature windows are marked evaluation_split=train.")
    elif train_until is not None:
        cutoff = pd.to_datetime(train_until, utc=True)
        split_df = df[df["window"] <= cutoff].copy()
    elif train_split is not None and 0.0 < train_split < 1.0:
        windows = pd.Index(df["window"].drop_duplicates().sort_values())
        split_idx = min(max(int(len(windows) * train_split), 1), len(windows) - 1)
        cutoff = windows[split_idx - 1]
        split_df = df[df["window"] <= cutoff].copy()
    else:
        split_df = df.copy()

    has_labels = int(split_df.get("labeled", 1).iloc[0]) if "labeled" in split_df.columns else 1

    if has_labels:
        benign = split_df[split_df.get("has_exfil", 0).astype(int) == 0].copy()
    else:
        if not assume_benign_history:
            print("[train] Warning: Data is unlabeled. Set --assume-benign-history to fit IF on training period.")
        benign = split_df.copy()

    if benign.empty:
        raise ValueError("No benign training windows available; refusing to fit Isolation Forest on attack data.")

    X = normalise_features(benign, user_bl, peer_bl)
    feature_variability = {
        name: int(pd.Series(X[:, index]).nunique(dropna=True))
        for index, name in enumerate(FEATURE_COLS)
    }
    scaler = RobustScaler().fit(X)
    X_scaled = scaler.transform(X)

    model = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        random_state=random_state,
        n_jobs=-1
    ).fit(X_scaled)

    os.makedirs(os.path.dirname(os.path.abspath(model_path)), exist_ok=True)
    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)

    explainer_path = os.path.join(os.path.dirname(os.path.abspath(model_path)), "explainer.joblib")
    if shap is not None:
        try:
            explainer = shap.TreeExplainer(model)
            joblib.dump(explainer, explainer_path)
            print(f"[train] SHAP TreeExplainer precomputed and saved -> {explainer_path}")
        except Exception as e:
            print(f"[train] Warning: Failed to serialize SHAP TreeExplainer: {e}")

    model_info = {
        "model": "IsolationForest",
        "feature_columns": FEATURE_COLS,
        "feature_count": len(FEATURE_COLS),
        "variable_feature_count": sum(count > 1 for count in feature_variability.values()),
        "feature_unique_values_in_training": feature_variability,
        "training_windows": int(len(benign)),
        "training_start": str(benign["window"].min()),
        "training_end": str(benign["window"].max()),
        "training_period_days": int((benign["window"].max() - benign["window"].min()).days) + 1,
        "contamination": contamination,
        "estimators": 200,
        "random_state": random_state,
        "peer_baseline_used": bool(peer_bl),
        "features_requiring_source_fields": {
            "novel_dst_port": "destination port; zero when unavailable",
            "risky_dst_port_share": "destination port; zero when unavailable",
            "new_region_and_destination": "destination region and SNI; zero when unavailable",
        },
    }
    info_path = os.path.join(os.path.dirname(os.path.abspath(model_path)), "model_info.json")
    with open(info_path, "w", encoding="utf-8") as f:
        json.dump(model_info, f, indent=2)
    print(f"[train] Isolation Forest trained on {len(benign)} training windows -> {model_path}")
    print(f"[train] Using {len(FEATURE_COLS)} features over {model_info['training_period_days']} days -> {info_path}")
    return model, scaler



def main():
    parser = argparse.ArgumentParser(description="Train Isolation Forest on benign baseline history.")
    parser.add_argument("--features", default=os.path.join(REPO, "data", "features_15m.csv"), help="Path to features_15m.csv")
    parser.add_argument("--user-bl", default=os.path.join(REPO, "data", "baselines_user.json"), help="Path to baselines_user.json")
    parser.add_argument("--out-dir", default=os.path.join(REPO, "data"), help="Directory to save model.joblib and scaler.joblib")
    parser.add_argument("--train-split", type=float, default=None, help="Fraction of chronological windows for training (e.g. 0.7)")
    parser.add_argument("--train-until", type=str, default=None, help="Timestamp cutoff for training period")
    parser.add_argument("--assume-benign-history", action="store_true", help="Fit on unlabeled training data assuming clean history")
    parser.add_argument("--contamination", type=float, default=0.03, help="Contamination rate for Isolation Forest")
    parser.add_argument("--peer-bl", default=None, help="Path to training-only peer baselines")
    parser.add_argument("--seed", type=int, default=42, help="Random state seed")
    args = parser.parse_args()

    model_path = os.path.join(args.out_dir, "model.joblib")
    scaler_path = os.path.join(args.out_dir, "scaler.joblib")
    train(
        feat_path=args.features,
        user_bl_path=args.user_bl,
        model_path=model_path,
        scaler_path=scaler_path,
        peer_bl_path=args.peer_bl,
        train_split=args.train_split,
        train_until=args.train_until,
        assume_benign_history=args.assume_benign_history,
        contamination=args.contamination,
        random_state=args.seed,
    )


if __name__ == "__main__":
    main()
