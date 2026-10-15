"""
train.py  -  Fit an Isolation Forest on benign-history features.

Trains on normalised features (z-scored against user baselines) so the
model learns behaviour, not raw byte volumes.
Saves model.joblib for use by score.py.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pandas as pd
import numpy as np
import joblib
import json
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler
from baseline import EPSILON

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONTAMINATION = 0.03     # expected fraction of anomalies in training data
N_ESTIMATORS  = 200
RANDOM_STATE  = 42

FEATURE_COLS = [
    "out_bytes", "in_bytes", "out_in_ratio", "conn_count",
    "max_duration", "hour_of_day", "has_unsanctioned",
    "has_anonymiser", "new_dest_user", "new_dest_org",
    "ja4_sync_present",
]

def normalise_features(df: pd.DataFrame, user_bl: dict) -> np.ndarray:
    """
    Replace raw out_bytes and out_in_ratio with their self-z-scores.
    Other binary/count features are left as is.
    """
    X = df[FEATURE_COLS].copy().fillna(0.0)

    for col in ["out_bytes", "out_in_ratio"]:
        zs = []
        for _, row in df.iterrows():
            uid = row["user_id"]
            hw  = int(row.get("hour_of_week", 0))
            bl  = user_bl.get(str(uid), {}).get(str(hw), {}).get(col)
            if bl is None:
                # Try int key as well
                bl = user_bl.get(str(uid), {}).get(hw, {}).get(col)
            if bl is None:
                zs.append(0.0)
            else:
                z = (float(row[col]) - bl["median"]) / (bl["mad"] + EPSILON)
                zs.append(float(np.clip(z, -10, 50)))
        X[col] = zs

    return X.values

def train(feat_path=None,
          user_bl_path=None,
          model_path=None,
          scaler_path=None):

    if feat_path is None:    feat_path    = os.path.join(REPO, "data", "features_15m.csv")
    if user_bl_path is None: user_bl_path = os.path.join(REPO, "data", "baselines_user.json")
    if model_path is None:   model_path   = os.path.join(REPO, "data", "model.joblib")
    if scaler_path is None:  scaler_path  = os.path.join(REPO, "data", "scaler.joblib")

    df = pd.read_csv(feat_path)

    with open(user_bl_path) as f:
        user_bl = json.load(f)

    # train ONLY on benign windows; the injected exfil rows are held out
    benign = df[df["has_exfil"] == 0].copy()
    print(f"[train] Benign windows: {len(benign)}")

    X = normalise_features(benign, user_bl)

    scaler = RobustScaler()
    X_scaled = scaler.fit_transform(X)

    iso = IsolationForest(
        n_estimators=N_ESTIMATORS,
        contamination=CONTAMINATION,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    iso.fit(X_scaled)
    print(f"[train] Isolation Forest fitted ({N_ESTIMATORS} trees)")

    joblib.dump(iso, model_path)
    joblib.dump(scaler, scaler_path)
    print(f"[train] Model  -> {model_path}")
    print(f"[train] Scaler -> {scaler_path}")

    return iso, scaler

if __name__ == "__main__":
    train()
