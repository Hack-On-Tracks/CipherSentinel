"""
evaluate.py  -  Compare four detection methods on identical event streams.

Methods:
  A: Fixed outbound threshold (100 MB per window)
  B: Isolation Forest on raw flow features (no baselines)
  C: Self + peer baselines only
  D: Full CipherSentinel fusion

Metrics:
  Precision, recall, F1, PR-AUC (average precision), confusion matrix,
  false alerts per user per week, and days/time to first alert for slow exfiltration.

Handles unlabeled real datasets cleanly by marking supervised metrics unavailable
rather than fabricating ground-truth labels.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO not in sys.path:
    sys.path.insert(0, REPO)
if os.path.join(REPO, "ml") not in sys.path:
    sys.path.insert(0, os.path.join(REPO, "ml"))

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import average_precision_score
from sklearn.preprocessing import RobustScaler

from baseline import EPSILON, score_peer, score_self
from score import WEIGHTS, score_window
from train import FEATURE_COLS, normalise_features

THRESHOLD_MB = 100  # Method A fixed threshold


def load_all(data_dir=None):
    if data_dir is None:
        data_dir = os.path.join(REPO, "data")
    df = pd.read_csv(os.path.join(data_dir, "features_15m.csv"))
    with open(os.path.join(data_dir, "baselines_user.json")) as f:
        user_bl = json.load(f)
    with open(os.path.join(data_dir, "baselines_peer.json")) as f:
        peer_bl = json.load(f)

    model_path = os.path.join(data_dir, "model.joblib")
    scaler_path = os.path.join(data_dir, "scaler.joblib")
    model = joblib.load(model_path) if os.path.isfile(model_path) else None
    scaler = joblib.load(scaler_path) if os.path.isfile(scaler_path) else None

    manifest = {}
    manifest_path = os.path.join(data_dir, "manifest.json")
    if os.path.isfile(manifest_path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

    return df, user_bl, peer_bl, model, scaler, manifest


def method_A(row: pd.Series) -> bool:
    return float(row.get("out_bytes", 0)) > THRESHOLD_MB * 1e6


def method_B_scores(train_df: pd.DataFrame, eval_df: pd.DataFrame):
    raw_cols = [
        "out_bytes", "in_bytes", "out_in_ratio", "conn_count", "max_duration",
        "hour_of_week", "new_dest_user", "new_dest_org", "ja4_rare"
    ]
    train_df = train_df.copy()
    eval_df = eval_df.copy()
    for c in raw_cols:
        if c not in train_df.columns:
            train_df[c] = 0.0
        if c not in eval_df.columns:
            eval_df[c] = 0.0
    X_train = train_df[raw_cols].fillna(0.0).values.astype(float)
    X_eval = eval_df[raw_cols].fillna(0.0).values.astype(float)
    scaler_b = RobustScaler()
    X_train_s = scaler_b.fit_transform(X_train)
    X_eval_s = scaler_b.transform(X_eval)
    iso_b = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
    iso_b.fit(X_train_s)
    raw = iso_b.decision_function(X_eval_s)
    return (raw < 0).astype(int), -raw


def method_C(row: pd.Series, user_bl: dict, peer_bl: dict) -> bool:
    self_z = score_self(row, user_bl)
    peer_z = score_peer(row, peer_bl)
    return (self_z > 5.0) or (peer_z > 5.0)


def method_D(row: pd.Series, model, scaler, user_bl: dict, peer_bl: dict) -> Tuple[bool, int]:
    alert = score_window(row, model, scaler, user_bl, peer_bl, include_info=True)
    if alert is None:
        return False, 0
    return alert["risk"] >= 40, alert["risk"]


def compute_metrics(pred: np.ndarray, truth: np.ndarray, raw_scores: Optional[np.ndarray] = None):
    TP = int(((pred == 1) & (truth == 1)).sum())
    FP = int(((pred == 1) & (truth == 0)).sum())
    FN = int(((pred == 0) & (truth == 1)).sum())
    TN = int(((pred == 0) & (truth == 0)).sum())

    precision = TP / (TP + FP + 1e-9)
    recall = TP / (TP + FN + 1e-9)
    f1 = 2 * precision * recall / (precision + recall + 1e-9)

    pr_auc = None
    if raw_scores is not None and truth.sum() > 0:
        try:
            pr_auc = round(float(average_precision_score(truth, raw_scores)), 4)
        except Exception:
            pr_auc = None

    return {
        "TP": TP,
        "FP": FP,
        "FN": FN,
        "TN": TN,
        "confusion_matrix": [[TN, FP], [FN, TP]],
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "pr_auc": pr_auc,
    }


def days_to_first_alert(pred: np.ndarray, df: pd.DataFrame, scenario: str) -> Optional[int]:
    """Calculate elapsed days from scenario start to first raised alert."""
    if "scenarios" not in df.columns:
        return None
    sc_mask = df["scenarios"].apply(lambda s: scenario in str(s)).values
    if not sc_mask.any():
        return None

    matching_df = df[sc_mask].copy()
    matching_pred = pred[sc_mask]

    if matching_pred.sum() == 0:
        return None

    matching_df["window_dt"] = pd.to_datetime(matching_df["window"], utc=True)
    first_event_time = matching_df["window_dt"].min()
    first_alert_idx = int(np.argmax(matching_pred))
    first_alert_time = matching_df.iloc[first_alert_idx]["window_dt"]

    elapsed_days = (first_alert_time - first_event_time).total_seconds() / 86400.0
    return max(0, int(round(elapsed_days)))


def run(data_dir=None, out_path=None, test_from=None):
    if data_dir is None:
        data_dir = os.path.join(REPO, "data")
    if out_path is None:
        out_path = os.path.join(data_dir, "evaluation.json")

    df, user_bl, peer_bl, model, scaler, manifest = load_all(data_dir)
    df["window_dt"] = pd.to_datetime(df["window"], utc=True)
    df = df.sort_values("window_dt").reset_index(drop=True)

    # Optional test period filter
    if "evaluation_split" in df.columns:
        train_df = df[df["evaluation_split"].astype(str) == "train"].copy()
        eval_df = df[df["evaluation_split"].astype(str) == "test"].copy()
        if train_df.empty or eval_df.empty:
            raise ValueError("Preassigned evaluation split must contain both train and test windows.")
    elif test_from is not None:
        test_dt = pd.to_datetime(test_from, utc=True)
        eval_df = df[df["window_dt"] >= test_dt].copy()
        train_df = df[df["window_dt"] < test_dt].copy()
    else:
        eval_df = df.copy()
        train_df = df.copy()

    # Check whether ground-truth labels are available
    has_labels = True
    if "labeled" in eval_df.columns and int(eval_df["labeled"].max()) == 0:
        has_labels = False
    elif manifest.get("label_availability") == "unlabeled":
        has_labels = False

    truth = eval_df.get("has_exfil", pd.Series(0, index=eval_df.index)).fillna(0).astype(int).values

    # Compute predictions
    pred_A = eval_df.apply(method_A, axis=1).astype(int).values
    score_A = eval_df.get("out_bytes", pd.Series(0, index=eval_df.index)).fillna(0).values.astype(float)

    pred_B, score_B = method_B_scores(train_df, eval_df)
    pred_C = eval_df.apply(lambda r: int(method_C(r, user_bl, peer_bl)), axis=1).values
    score_C = eval_df.apply(lambda r: max(score_self(r, user_bl), score_peer(r, peer_bl)), axis=1).values

    d_results = [method_D(r, model, scaler, user_bl, peer_bl) for _, r in eval_df.iterrows()]
    pred_D = np.array([int(res[0]) for res in d_results])
    score_D = np.array([float(res[1]) for res in d_results])

    n_users = max(eval_df["user_id"].nunique(), 1)
    n_days = max(eval_df["window_dt"].dt.date.nunique(), 1)
    n_weeks = max(n_days / 7.0, 1.0 / 7.0)

    if not has_labels:
        # Unlabeled real traffic evaluation report
        output = {
            "generated_at": pd.Timestamp.now(tz="UTC").isoformat(),
            "evaluation_status": "labels_unavailable",
            "caveat": "Real unlabeled traffic: ground-truth labels are not provided. Supervised metrics (precision, recall, F1, PR-AUC) cannot be fabricated without verified ground truth.",
            "operational_telemetry": {
                "total_windows_evaluated": len(eval_df),
                "unique_entities": n_users,
                "observation_days": n_days,
                "alerts_fired_method_D": int(pred_D.sum()),
                "alerts_per_entity_per_week": round(float(pred_D.sum()) / (n_users * n_weeks), 2),
                "alerts_fired_method_A": int(pred_A.sum()),
                "alerts_fired_method_C": int(pred_C.sum()),
            },
            "manifest": manifest,
        }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)
        print(f"[evaluate] Operational telemetry (unlabeled) -> {out_path}")
        return output

    # Labeled dataset evaluation
    results = {}
    preds = [
        ("A_threshold", pred_A, score_A),
        ("B_iso_raw", pred_B, score_B),
        ("C_baselines_only", pred_C, score_C),
        ("D_full_fusion", pred_D, score_D),
    ]

    for name, pred, scores in preds:
        results[name] = compute_metrics(pred, truth, raw_scores=scores)
        results[name]["false_alerts_per_user_per_week"] = round(
            float(results[name]["FP"]) / (n_users * n_weeks), 2
        )

    # Time-to-first-alert for slow-leak scenarios
    for sc in ["S3", "S5"]:
        for name, pred, _ in preds:
            d = days_to_first_alert(pred, eval_df, sc)
            results[name][f"days_to_first_{sc}"] = d

    output = {
        "generated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        "evaluation_status": "evaluated",
        "caveat": manifest.get(
            "evaluation_caveat",
            "Synthetic/injected scenarios demonstrate detector coherence and trade-offs under MITRE ATT&CK T1567.",
        ),
        "methods": {
            "A_threshold": "Fixed 100 MB/window threshold",
            "B_iso_raw": "Isolation Forest on raw flow features, no baselines",
            "C_baselines_only": "Self + peer baselines only",
            "D_full_fusion": "Full CipherSentinel: baselines + IF + policy + accumulator",
        },
        "test_period": {
            "window_count": len(eval_df),
            "entity_count": n_users,
            "days": n_days,
            "test_from": test_from,
            "split": "preassigned train/test" if "evaluation_split" in df.columns else "timestamp" if test_from else "all rows",
        },
        "results": results,
        "manifest": manifest,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"[evaluate] Results -> {out_path}")
    return output


def main():
    parser = argparse.ArgumentParser(description="Evaluate detection methods on feature windows.")
    parser.add_argument("--data-dir", default=os.path.join(REPO, "data"), help="Directory containing features and models")
    parser.add_argument("--out-path", default=None, help="Output path for evaluation.json")
    parser.add_argument("--test-from", default=None, help="Evaluate only on test windows from this ISO timestamp onward")
    args = parser.parse_args()

    run(data_dir=args.data_dir, out_path=args.out_path, test_from=args.test_from)


if __name__ == "__main__":
    main()
