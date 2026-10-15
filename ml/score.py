"""
score.py  -  Auditable five-signal fusion. It never reads encrypted payload bytes.

Computes a 0-100 risk score from five auditable signals with fixed weights:
  1. Self-baseline deviation (30)
  2. Destination policy & novelty (25)
  3. Isolation Forest metadata anomaly (20)
  4. Peer-group cohort deviation (15)
  5. Slow-leak 7-day accumulator (10)

Supports configurable sixth parameter/signal via api/config.py if enabled.
Outputs valid alert JSON matching the project's exact contract.
"""

from __future__ import annotations
import argparse
import json
import os
import sys
import joblib
import numpy as np
import pandas as pd

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO not in sys.path:
    sys.path.insert(0, REPO)
if os.path.join(REPO, "ml") not in sys.path:
    sys.path.insert(0, os.path.join(REPO, "ml"))

from api.config import (
    WEIGHTS, SEVERITY_HIGH, SEVERITY_REVIEW, DEST_POLICY_WEIGHTS,
    CATEGORY_LABELS, SLOW_LEAK_CEILING_BYTES
)
from baseline import score_self, score_peer
from train import normalise_features

RECOMMENDED_ACTION = "Confirm with the user's manager before any restriction"


def _severity(risk: int) -> str:
    return "high" if risk >= SEVERITY_HIGH else "review" if risk >= SEVERITY_REVIEW else "info"


def _window_label(value) -> str:
    start = pd.Timestamp(value)
    return f"{start:%Y-%m-%dT%H:%M}/{(start + pd.Timedelta(minutes=15)):%H:%M}"


def _baseline_out(row: pd.Series, user_bl: dict) -> float:
    try:
        hw_key = str(int(row.get("hour_of_week", 0)))
    except Exception:
        hw_key = "0"
    item = user_bl.get(str(row.get("user_id", "")), {}).get(hw_key, {}).get("out_bytes", {})
    return float(item.get("median", 0.0))


def _iso(row: pd.Series, model, scaler, user_bl: dict) -> float:
    if model is None or scaler is None:
        return 0.0
    try:
        norm_mat = normalise_features(pd.DataFrame([row]), user_bl)
        scaled_mat = scaler.transform(norm_mat)
        value = float(model.decision_function(scaled_mat)[0])
        # Map decision score into 0..1 range
        return float(np.clip((-value + 0.03) / 0.18, 0, 1))
    except Exception:
        return 0.0


def _trusted_build(row: pd.Series) -> bool:
    """Explicit allow-list policy for known CI/CD engineering build artifacts."""
    return (
        str(row.get("role")) == "engineer"
        and str(row.get("dest_category")) == "sanctioned"
        and str(row.get("primary_sni")) in {"s3.amazonaws.com", "storage.googleapis.com", "github.com"}
        and 8 <= pd.Timestamp(row.window).hour < 20
        and not bool(row.get("ja4_rare", 0))
    )


def score_window(
    row: pd.Series,
    model,
    scaler,
    user_bl: dict,
    peer_bl: dict,
    allow_trusted_build: bool = True,
    sixth_signal_fn: callable | None = None,
    include_info: bool = False,
):
    """
    Score one 15-minute entity window against the five signals.
    Returns alert dict if severity >= review (risk >= 40), else None.
    """
    if allow_trusted_build and _trusted_build(row):
        return None

    out_bytes = float(row.get("out_bytes", 0))
    out_mb = out_bytes / 1e6
    sni = str(row.get("primary_sni", "unknown"))
    category = str(row.get("dest_category", "unknown"))
    first = bool(row.get("new_dest_user", 0))

    self_z = score_self(row, user_bl)
    peer_z = score_peer(row, peer_bl)

    self_points = WEIGHTS["self_deviation"] * min(self_z / 8.0, 1.0)
    peer_points = WEIGHTS["peer_deviation"] * min(peer_z / 8.0, 1.0)

    policy_weight = DEST_POLICY_WEIGHTS.get(category, 0.4) + (0.2 if first and category != "sanctioned" else 0.0)
    policy_points = WEIGHTS["destination_policy"] * min(1.0, policy_weight)

    iso_value = _iso(row, model, scaler, user_bl)
    iso_points = WEIGHTS["isolation_forest"] * iso_value

    cumulative = float(row.get("cum_out_7d", 0))
    slow_points = (
        WEIGHTS["slow_leak"] * min(cumulative / SLOW_LEAK_CEILING_BYTES, 1.0)
        if category in {"personal_file_sharing", "file_transfer", "anonymiser"}
        else 0.0
    )

    total = self_points + policy_points + iso_points + peer_points + slow_points

    # Configurable sixth parameter/signal hook
    sixth_points = 0.0
    sixth_detail = None
    if sixth_signal_fn is not None:
        try:
            s6_res = sixth_signal_fn(row)
            if s6_res and isinstance(s6_res, dict):
                sixth_points = float(s6_res.get("points", 0.0))
                sixth_detail = str(s6_res.get("detail", ""))
                total += sixth_points
        except Exception:
            pass

    risk = int(round(np.clip(total, 0, 100)))
    severity = _severity(risk)
    if severity == "info" and not include_info:
        return None

    median_mb = _baseline_out(row, user_bl) / 1e6

    signals = [
        {
            "name": "self_deviation",
            "points": round(self_points, 1),
            "detail": f"{out_mb:.0f} MB out vs median {median_mb:.1f} MB (z = {self_z:.1f})",
        },
        {
            "name": "destination_policy",
            "points": round(policy_points, 1),
            "detail": f"{'first contact, ' if first else ''}category {CATEGORY_LABELS.get(category, 'unknown destination')} ({sni})",
        },
        {
            "name": "isolation_forest",
            "points": round(iso_points, 1),
            "detail": f"metadata pattern anomaly {iso_value:.2f} from bytes, timing, ratio, novelty, and JA4",
        },
        {
            "name": "peer_deviation",
            "points": round(peer_points, 1),
            "detail": f"{out_mb:.0f} MB out; z = {peer_z:.1f} against {row.get('role', 'unassigned')} role cohort",
        },
        {
            "name": "slow_leak",
            "points": round(slow_points, 1),
            "detail": f"{cumulative / 1e6:.0f} MB over 7 days to {sni}",
        },
    ]

    if sixth_detail is not None:
        signals.append({
            "name": "sixth_signal",
            "points": round(sixth_points, 1),
            "detail": sixth_detail,
        })

    row_id = getattr(row, "name", 0)
    try:
        row_id_int = int(row_id)
    except Exception:
        row_id_int = 0

    return {
        "id": f"a_{row_id_int:04d}",
        "entity": str(row.get("user_id", "U-UNKNOWN")),
        "role": str(row.get("role", "unassigned")),
        "window": _window_label(row["window"]),
        "risk": risk,
        "severity": severity,
        "signals": signals,
        "destination": {"sni": sni, "first_seen_for_user": first},
        "recommended_action": RECOMMENDED_ACTION,
    }


def score_all(
    feat_path=None,
    user_bl_path=None,
    peer_bl_path=None,
    model_path=None,
    scaler_path=None,
    out_path=None,
    data_dir=None,
    evaluation_split: str | None = None,
    test_from: str | None = None,
):
    base_data = data_dir or os.path.join(REPO, "data")
    feat_path = feat_path or os.path.join(base_data, "features_15m.csv")
    user_bl_path = user_bl_path or os.path.join(base_data, "baselines_user.json")
    peer_bl_path = peer_bl_path or os.path.join(base_data, "baselines_peer.json")
    model_path = model_path or os.path.join(base_data, "model.joblib")
    scaler_path = scaler_path or os.path.join(base_data, "scaler.joblib")
    out_path = out_path or os.path.join(base_data, "alerts.json")

    df = pd.read_csv(feat_path)
    if evaluation_split is not None and "evaluation_split" in df.columns:
        df = df[df["evaluation_split"].astype(str) == evaluation_split].copy()
    elif test_from is not None:
        df["window_dt"] = pd.to_datetime(df["window"], utc=True)
        df = df[df["window_dt"] >= pd.to_datetime(test_from, utc=True)].copy()
    with open(user_bl_path) as f:
        user_bl = json.load(f)
    with open(peer_bl_path) as f:
        peer_bl = json.load(f)

    model = joblib.load(model_path) if os.path.isfile(model_path) else None
    scaler = joblib.load(scaler_path) if os.path.isfile(scaler_path) else None

    alerts = []
    for _, row in df.iterrows():
        a = score_window(row, model, scaler, user_bl, peer_bl)
        if a is not None:
            alerts.append(a)

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(alerts, f, indent=2)

    high_count = sum(1 for a in alerts if a["severity"] == "high")
    review_count = sum(1 for a in alerts if a["severity"] == "review")
    print(f"[score] {len(alerts)} alerts ({high_count} high, {review_count} review) -> {out_path}")
    return alerts


def main():
    parser = argparse.ArgumentParser(description="Score 15m windows and generate auditable alerts.")
    parser.add_argument("--features", default=None, help="Path to features_15m.csv")
    parser.add_argument("--data-dir", default=None, help="Data directory with baselines and model")
    parser.add_argument("--out-path", default=None, help="Path to write alerts.json")
    parser.add_argument("--evaluation-split", choices=["train", "test"], default=None,
                        help="Optionally score only one preassigned split")
    parser.add_argument("--test-from", default=None, help="Optionally score only windows at or after this ISO timestamp")
    args = parser.parse_args()

    score_all(
        feat_path=args.features,
        data_dir=args.data_dir,
        out_path=args.out_path,
        evaluation_split=args.evaluation_split,
        test_from=args.test_from,
    )


if __name__ == "__main__":
    main()
