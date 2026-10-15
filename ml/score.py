"""Auditable five-signal fusion.  It never reads encrypted payload bytes."""
from __future__ import annotations
import json, os, sys
import joblib
import numpy as np
import pandas as pd

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO not in sys.path:
    sys.path.insert(0, REPO)
from api.config import (WEIGHTS, SEVERITY_HIGH, SEVERITY_REVIEW, DEST_POLICY_WEIGHTS,
                        CATEGORY_LABELS, SLOW_LEAK_CEILING_BYTES)
from baseline import score_self, score_peer
from train import normalise_features
RECOMMENDED_ACTION = "Confirm with the user's manager before any restriction"

def _severity(risk: int) -> str:
    return "high" if risk >= SEVERITY_HIGH else "review" if risk >= SEVERITY_REVIEW else "info"

def _window_label(value) -> str:
    start = pd.Timestamp(value)
    return f"{start:%Y-%m-%dT%H:%M}/{(start + pd.Timedelta(minutes=15)):%H:%M}"

def _baseline_out(row: pd.Series, user_bl: dict) -> float:
    item = user_bl.get(str(row.user_id), {}).get(str(int(row.hour_of_week)), {}).get("out_bytes", {})
    return float(item.get("median", 0.0))

def _iso(row: pd.Series, model, scaler, user_bl: dict) -> float:
    value = float(model.decision_function(scaler.transform(normalise_features(pd.DataFrame([row]), user_bl)))[0])
    # Decision scores are unbounded and model-specific; map the normal boundary
    # and a materially negative score into a transparent 0..1 contribution.
    return float(np.clip((-value + .03) / .18, 0, 1))

def _trusted_build(row: pd.Series) -> bool:
    return (str(row.get("role")) == "engineer" and str(row.get("dest_category")) == "sanctioned"
            and str(row.get("primary_sni")) in {"s3.amazonaws.com", "storage.googleapis.com", "github.com"}
            and 8 <= pd.Timestamp(row.window).hour < 20 and not bool(row.get("ja4_rare", 0)))

def score_window(row: pd.Series, model, scaler, user_bl: dict, peer_bl: dict):
    """Return one exact-contract alert, or None for an informational window."""
    # Known engineering build paths are an explicit allow-list policy.  This is
    # based only on destination, role, time, and TLS fingerprint metadata.
    if _trusted_build(row):
        return None
    out_bytes = float(row.get("out_bytes", 0)); out_mb = out_bytes / 1e6
    sni = str(row.get("primary_sni", "unknown")); category = str(row.get("dest_category", "unknown"))
    first = bool(row.get("new_dest_user", 0))
    self_z, peer_z = score_self(row, user_bl), score_peer(row, peer_bl)
    self_points = WEIGHTS["self_deviation"] * min(self_z / 8, 1)
    peer_points = WEIGHTS["peer_deviation"] * min(peer_z / 8, 1)
    policy_points = WEIGHTS["destination_policy"] * min(1., DEST_POLICY_WEIGHTS.get(category, .4) + (.2 if first else 0))
    try: iso_value = _iso(row, model, scaler, user_bl)
    except Exception: iso_value = 0.
    iso_points = WEIGHTS["isolation_forest"] * iso_value
    cumulative = float(row.get("cum_out_7d", 0))
    slow_points = (WEIGHTS["slow_leak"] * min(cumulative / SLOW_LEAK_CEILING_BYTES, 1)
                   if category in {"personal_file_sharing", "file_transfer", "anonymiser"} else 0.)
    total = self_points + policy_points + iso_points + peer_points + slow_points
    risk = int(round(np.clip(total, 0, 100)))
    severity = _severity(risk)
    if severity == "info": return None
    median_mb = _baseline_out(row, user_bl) / 1e6
    signals = [
        {"name": "self_deviation", "points": round(self_points, 1),
         "detail": f"{out_mb:.0f} MB out vs median {median_mb:.1f} MB (z = {self_z:.1f})"},
        {"name": "destination_policy", "points": round(policy_points, 1),
         "detail": f"{'first contact, ' if first else ''}category {CATEGORY_LABELS.get(category, 'unknown destination')} ({sni})"},
        {"name": "isolation_forest", "points": round(iso_points, 1),
         "detail": f"metadata pattern anomaly {iso_value:.2f} from bytes, timing, ratio, novelty, and JA4"},
        {"name": "peer_deviation", "points": round(peer_points, 1),
         "detail": f"{out_mb:.0f} MB out; z = {peer_z:.1f} against {row.role} role cohort"},
        {"name": "slow_leak", "points": round(slow_points, 1),
         "detail": f"{cumulative / 1e6:.0f} MB over 7 days to {sni}"},
    ]
    # This shape is intentionally sacred: consumers must not depend on extras.
    return {"id": f"a_{int(row.name):04d}", "entity": str(row.user_id), "role": str(row.role),
            "window": _window_label(row.window), "risk": risk, "severity": severity, "signals": signals,
            "destination": {"sni": sni, "first_seen_for_user": first},
            "recommended_action": RECOMMENDED_ACTION}

def score_all(feat_path=None, user_bl_path=None, peer_bl_path=None, model_path=None, scaler_path=None, out_path=None):
    data = os.path.join(REPO, "data")
    feat_path = feat_path or os.path.join(data, "features_15m.csv")
    user_bl_path = user_bl_path or os.path.join(data, "baselines_user.json")
    peer_bl_path = peer_bl_path or os.path.join(data, "baselines_peer.json")
    model_path = model_path or os.path.join(data, "model.joblib")
    scaler_path = scaler_path or os.path.join(data, "scaler.joblib")
    out_path = out_path or os.path.join(data, "alerts.json")
    df = pd.read_csv(feat_path)
    with open(user_bl_path) as f: user_bl = json.load(f)
    with open(peer_bl_path) as f: peer_bl = json.load(f)
    model, scaler = joblib.load(model_path), joblib.load(scaler_path)
    alerts = [a for _, row in df.iterrows() if (a := score_window(row, model, scaler, user_bl, peer_bl))]
    with open(out_path, "w") as f: json.dump(alerts, f, indent=2)
    print(f"[score] {len(alerts)} review-or-higher alerts -> {out_path}")
    return alerts

if __name__ == "__main__": score_all()
