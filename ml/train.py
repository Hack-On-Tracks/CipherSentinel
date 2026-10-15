"""Train an Isolation Forest only on withheld benign history."""
from __future__ import annotations
import json, os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler
from baseline import EPSILON

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEATURE_COLS = ["out_z", "ratio_z", "conn_count", "max_duration", "hour_of_week",
                "new_dest_user", "new_dest_org", "ja4_rare", "category_risk"]
CATEGORY_RISK = {"sanctioned": 0., "unknown": .4, "file_transfer": .6,
                 "personal_file_sharing": .8, "anonymiser": 1.}

def _z(row: pd.Series, col: str, baselines: dict) -> float:
    bucket = baselines.get(str(row.user_id), {})
    spec = bucket.get(str(int(row.hour_of_week)), {}).get(col)
    if not spec:
        return 0.0
    return float(np.clip((float(row[col]) - spec["median"]) / (spec["mad"] + EPSILON), -10, 50))

def normalise_features(df: pd.DataFrame, user_bl: dict) -> np.ndarray:
    records = []
    for _, row in df.iterrows():
        records.append({
            "out_z": _z(row, "out_bytes", user_bl), "ratio_z": _z(row, "out_in_ratio", user_bl),
            "conn_count": float(row.get("conn_count", 0)), "max_duration": float(row.get("max_duration", 0)),
            "hour_of_week": float(row.get("hour_of_week", 0)), "new_dest_user": float(row.get("new_dest_user", 0)),
            "new_dest_org": float(row.get("new_dest_org", 0)), "ja4_rare": float(row.get("ja4_rare", 0)),
            "category_risk": CATEGORY_RISK.get(str(row.get("dest_category", "unknown")), .4),
        })
    return pd.DataFrame(records, columns=FEATURE_COLS).fillna(0.).to_numpy(dtype=float)

def train(feat_path=None, user_bl_path=None, model_path=None, scaler_path=None):
    data = os.path.join(REPO, "data")
    feat_path = feat_path or os.path.join(data, "features_15m.csv")
    user_bl_path = user_bl_path or os.path.join(data, "baselines_user.json")
    model_path = model_path or os.path.join(data, "model.joblib")
    scaler_path = scaler_path or os.path.join(data, "scaler.joblib")
    df = pd.read_csv(feat_path)
    with open(user_bl_path) as f: user_bl = json.load(f)
    scenario_text = df.get("scenarios", pd.Series("[]", index=df.index)).fillna("[]").astype(str)
    benign = df[(df.has_exfil.astype(int) == 0) & scenario_text.isin(["[]", ""])].copy()
    X = normalise_features(benign, user_bl)
    scaler = RobustScaler().fit(X)
    model = IsolationForest(n_estimators=200, contamination=.03, random_state=42, n_jobs=-1).fit(scaler.transform(X))
    joblib.dump(model, model_path); joblib.dump(scaler, scaler_path)
    print(f"[train] Isolation Forest trained on {len(benign)} benign windows")
    return model, scaler

if __name__ == "__main__":
    train()
