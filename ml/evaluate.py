"""
evaluate.py  -  Compare four detection methods on identical event streams.

Methods:
  A: Fixed outbound threshold (100 MB per window)
  B: Isolation Forest on raw flow features (no baselines)
  C: Self + peer baselines only
  D: Full CipherSentinel fusion

Metrics: precision, recall, F1 per scenario; false alerts per user per week;
         days until first alert for S3 and S5.

Writes: data/evaluation.json
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pandas as pd
import numpy as np
import json
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler
from score import score_window, WEIGHTS
from baseline import score_self, score_peer, EPSILON
from train import FEATURE_COLS, normalise_features

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THRESHOLD_MB = 100       # Method A fixed threshold


def load_all(data_dir=None):
    if data_dir is None: data_dir = os.path.join(REPO, "data")
    df = pd.read_csv(os.path.join(data_dir, "features_15m.csv"))
    with open(os.path.join(data_dir, "baselines_user.json")) as f:
        user_bl = json.load(f)
    with open(os.path.join(data_dir, "baselines_peer.json")) as f:
        peer_bl = json.load(f)
    model  = joblib.load(os.path.join(data_dir, "model.joblib"))
    scaler = joblib.load(os.path.join(data_dir, "scaler.joblib"))
    return df, user_bl, peer_bl, model, scaler


def method_A(row: pd.Series) -> bool:
    return float(row.get("out_bytes", 0)) > THRESHOLD_MB * 1e6


def method_B_scores(df: pd.DataFrame) -> np.ndarray:
    # Deliberately raw comparator (unlike production's normalized model).
    raw_cols = ["out_bytes", "in_bytes", "out_in_ratio", "conn_count", "max_duration",
                "hour_of_week", "new_dest_user", "new_dest_org", "ja4_rare"]
    X = df[raw_cols].fillna(0.0).values.astype(float)
    scaler_b = RobustScaler()
    X_s = scaler_b.fit_transform(X)
    iso_b = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
    iso_b.fit(X_s)
    raw = iso_b.decision_function(X_s)
    return (raw < -0.1).astype(int)


def method_C(row: pd.Series, user_bl: dict, peer_bl: dict) -> bool:
    self_z = score_self(row, user_bl)
    peer_z = score_peer(row, peer_bl)
    return (self_z > 5.0) or (peer_z > 5.0)


def method_D(row: pd.Series, model, scaler, user_bl: dict, peer_bl: dict) -> bool:
    alert = score_window(row, model, scaler, user_bl, peer_bl)
    return alert is not None and alert["risk"] >= 40


def compute_metrics(pred: np.ndarray, truth: np.ndarray, scenario_col=None):
    TP = int(((pred == 1) & (truth == 1)).sum())
    FP = int(((pred == 1) & (truth == 0)).sum())
    FN = int(((pred == 0) & (truth == 1)).sum())
    TN = int(((pred == 0) & (truth == 0)).sum())
    precision = TP / (TP + FP + 1e-9)
    recall    = TP / (TP + FN + 1e-9)
    f1        = 2 * precision * recall / (precision + recall + 1e-9)
    return {
        "TP": TP, "FP": FP, "FN": FN, "TN": TN,
        "precision": round(precision, 3),
        "recall":    round(recall, 3),
        "f1":        round(f1, 3),
    }


def days_to_first_alert(pred: np.ndarray, df: pd.DataFrame, scenario: str):
    mask = df["scenarios"].apply(lambda s: scenario in str(s)).values
    sc_pred = pred[mask]
    if sc_pred.sum() == 0:
        return None
    return int(np.argmax(sc_pred))


def run(data_dir=None, out_path=None):
    if data_dir is None: data_dir = os.path.join(REPO, "data")
    if out_path is None: out_path = os.path.join(REPO, "data", "evaluation.json")

    df, user_bl, peer_bl, model, scaler = load_all(data_dir)

    truth = df["has_exfil"].fillna(0).astype(int).values

    pred_A = df.apply(method_A, axis=1).astype(int).values
    pred_B = method_B_scores(df)
    pred_C = df.apply(lambda r: int(method_C(r, user_bl, peer_bl)), axis=1).values
    pred_D = df.apply(lambda r: int(method_D(r, model, scaler, user_bl, peer_bl)), axis=1).values

    results = {}
    for name, pred in [("A_threshold", pred_A), ("B_iso_raw", pred_B),
                       ("C_baselines_only", pred_C), ("D_full_fusion", pred_D)]:
        results[name] = compute_metrics(pred, truth)

    n_users = df["user_id"].nunique()
    n_days  = max(df["window"].apply(lambda w: str(w)[:10]).nunique(), 1)
    n_weeks = n_days / 7.0

    for sc in ["S3", "S5"]:
        for name, pred in [("A_threshold", pred_A), ("B_iso_raw", pred_B),
                           ("C_baselines_only", pred_C), ("D_full_fusion", pred_D)]:
            d = days_to_first_alert(pred, df, sc)
            results[name][f"days_to_first_{sc}"] = d

    for name, pred in [("A_threshold", pred_A), ("B_iso_raw", pred_B),
                       ("C_baselines_only", pred_C), ("D_full_fusion", pred_D)]:
        results[name]["false_alerts_per_user_per_week"] = round(
            results[name]["FP"] / max(n_users * n_weeks, 1), 2
        )

    output = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "caveat": "All attacks are synthetic; results show coherence, not real-world performance.",
        "methods": {
            "A_threshold":      "Fixed 100 MB/window threshold",
            "B_iso_raw":        "Isolation Forest on raw flow features, no baselines",
            "C_baselines_only": "Self + peer baselines only",
            "D_full_fusion":    "Full CipherSentinel: baselines + IF + policy + accumulator",
        },
        "results": results,
    }

    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"[evaluate] Results -> {out_path}")
    return output


if __name__ == "__main__":
    run()
