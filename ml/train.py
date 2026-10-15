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

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO not in sys.path:
    sys.path.insert(0, REPO)
if os.path.join(REPO, "ml") not in sys.path:
    sys.path.insert(0, os.path.join(REPO, "ml"))

from baseline import EPSILON

FEATURE_COLS = [
    "out_z", "ratio_z", "conn_count", "max_duration", "hour_of_week",
    "new_dest_user", "new_dest_org", "ja4_rare", "category_risk"
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


def normalise_features(df: pd.DataFrame, user_bl: dict) -> np.ndarray:
    records = []
    for _, row in df.iterrows():
        records.append({
            "out_z": _z(row, "out_bytes", user_bl),
            "ratio_z": _z(row, "out_in_ratio", user_bl),
            "conn_count": float(row.get("conn_count", 0)),
            "max_duration": float(row.get("max_duration", 0.0)),
            "hour_of_week": float(row.get("hour_of_week", 0)),
            "new_dest_user": float(row.get("new_dest_user", 0)),
            "new_dest_org": float(row.get("new_dest_org", 0)),
            "ja4_rare": float(row.get("ja4_rare", 0)),
            "category_risk": CATEGORY_RISK.get(str(row.get("dest_category", "unknown")), 0.4),
        })
    mat = pd.DataFrame(records, columns=FEATURE_COLS).fillna(0.0).to_numpy(dtype=float)
    return mat


def train(
    feat_path: str | None = None,
    user_bl_path: str | None = None,
    model_path: str | None = None,
    scaler_path: str | None = None,
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

    df = pd.read_csv(feat_path)
    df["window"] = pd.to_datetime(df["window"], utc=True)
    df = df.sort_values("window").reset_index(drop=True)

    with open(user_bl_path) as f:
        user_bl = json.load(f)

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

    X = normalise_features(benign, user_bl)
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
    print(f"[train] Isolation Forest trained on {len(benign)} training windows -> {model_path}")
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
    parser.add_argument("--seed", type=int, default=42, help="Random state seed")
    args = parser.parse_args()

    model_path = os.path.join(args.out_dir, "model.joblib")
    scaler_path = os.path.join(args.out_dir, "scaler.joblib")
    train(
        feat_path=args.features,
        user_bl_path=args.user_bl,
        model_path=model_path,
        scaler_path=scaler_path,
        train_split=args.train_split,
        train_until=args.train_until,
        assume_benign_history=args.assume_benign_history,
        contamination=args.contamination,
        random_state=args.seed,
    )


if __name__ == "__main__":
    main()
