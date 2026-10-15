"""
score.py  -  Five-signal fusion into a 0-100 risk score with evidence cards.

Signals (weights from config):
  1. Self-baseline deviation     (30 pts)
  2. Destination policy          (25 pts)
  3. Isolation Forest            (20 pts)
  4. Peer-group deviation        (15 pts)
  5. Slow-leak accumulation      (10 pts)

Output:  data/alerts.json  -  list of alert objects matching the API contract.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pandas as pd
import numpy as np
import json
import joblib
from baseline import score_self, score_peer, EPSILON
from train import FEATURE_COLS, normalise_features

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── weights (must sum to 100) ────────────────────────────────────────────────
WEIGHTS = {
    "self_deviation":     30,
    "destination_policy": 25,
    "isolation_forest":   20,
    "peer_deviation":     15,
    "slow_leak":          10,
}
assert sum(WEIGHTS.values()) == 100

# Severity bands
SEVERITY = [(70, "high"), (40, "review"), (0, "info")]

RECOMMENDED_ACTIONS = {
    "high":   "Escalate to security team; confirm with the user's manager before any restriction.",
    "review": "Investigate further; check with the user whether transfer was authorised.",
    "info":   "Log for context; no immediate action needed.",
}

CATEGORY_LABELS = {
    "personal_file_sharing": "personal file-sharing service",
    "file_transfer":         "public file-transfer site",
    "anonymiser":            "anonymising service",
    "sanctioned":            "sanctioned service",
    "unknown":               "unknown destination",
}

DEST_POLICY_WEIGHTS = {
    "anonymiser":            1.0,
    "personal_file_sharing": 0.8,
    "file_transfer":         0.6,
    "unknown":               0.4,
    "sanctioned":            0.0,
}


def iso_score(row_df: pd.DataFrame, model, scaler, user_bl: dict) -> float:
    """Return a 0-1 anomaly score from the Isolation Forest."""
    X = normalise_features(row_df, user_bl)
    X_s = scaler.transform(X)
    raw = model.decision_function(X_s)[0]
    return float(np.clip(0.5 - raw, 0, 1))


def _get_severity(risk: float) -> str:
    for threshold, label in SEVERITY:
        if risk >= threshold:
            return label
    return "info"


def score_window(row: pd.Series, model, scaler, user_bl: dict, peer_bl: dict):
    """
    Compute a risk score for a single entity window row.
    Returns an alert dict or None if score < 40 (info only).
    """
    signals = []
    total   = 0.0

    # ── Signal 1: Self-baseline deviation ───────────────────────────────────
    self_z = score_self(row, user_bl)
    self_contrib = min(self_z / 10.0, 1.0) * WEIGHTS["self_deviation"]
    total += self_contrib
    out_mb  = float(row.get("out_bytes", 0)) / 1e6
    uid     = str(row["user_id"])
    hw      = int(row.get("hour_of_week", 0)) if not pd.isna(row.get("hour_of_week", 0)) else 0
    bl_info = user_bl.get(uid, {}).get(str(hw), {}).get("out_bytes", {})
    if not bl_info:
        bl_info = user_bl.get(uid, {}).get(hw, {}).get("out_bytes", {})
    med_mb  = bl_info.get("median", 0) / 1e6 if bl_info else 0
    signals.append({
        "name":   "self_deviation",
        "points": round(self_contrib, 1),
        "detail": f"{out_mb:.0f} MB out vs median {med_mb:.1f} MB (z = {self_z:.1f})",
    })

    # ── Signal 2: Destination policy ────────────────────────────────────────
    cat    = str(row.get("primary_category", "sanctioned"))
    policy_factor = DEST_POLICY_WEIGHTS.get(cat, 0.0)
    novelty_boost = 0.2 if row.get("new_dest_user", 0) else 0.0
    policy_contrib = min((policy_factor + novelty_boost), 1.0) * WEIGHTS["destination_policy"]
    total += policy_contrib
    sni       = str(row.get("primary_sni", "unknown"))
    cat_label = CATEGORY_LABELS.get(cat, cat)
    new_flag  = "; first contact for this user" if row.get("new_dest_user", 0) else ""
    signals.append({
        "name":   "destination_policy",
        "points": round(policy_contrib, 1),
        "detail": f"{sni} ({cat_label}{new_flag})",
    })

    # ── Signal 3: Isolation Forest ──────────────────────────────────────────
    try:
        row_df = pd.DataFrame([row])
        if "user_id" not in row_df.columns:
            row_df["user_id"] = row["user_id"]
        if "hour_of_week" not in row_df.columns:
            row_df["hour_of_week"] = hw
        # fill missing feature cols
        for col in FEATURE_COLS:
            if col not in row_df.columns:
                row_df[col] = 0.0
        iso_raw     = iso_score(row_df, model, scaler, user_bl)
        iso_contrib = iso_raw * WEIGHTS["isolation_forest"]
    except Exception:
        iso_raw     = 0.0
        iso_contrib = 0.0
    total += iso_contrib
    signals.append({
        "name":   "isolation_forest",
        "points": round(iso_contrib, 1),
        "detail": f"anomaly score {iso_raw:.2f} (0 = normal, 1 = anomalous)",
    })

    # ── Signal 4: Peer-group deviation ──────────────────────────────────────
    peer_z       = score_peer(row, peer_bl)
    peer_contrib = min(peer_z / 10.0, 1.0) * WEIGHTS["peer_deviation"]
    total += peer_contrib
    signals.append({
        "name":   "peer_deviation",
        "points": round(peer_contrib, 1),
        "detail": f"z = {peer_z:.1f} vs role cohort ({row.get('role','?')})",
    })

    # ── Signal 5: Slow-leak accumulation ────────────────────────────────────
    cum_7d_mb   = float(row.get("cum_out_7d", 0)) / 1e6
    if cat in {"personal_file_sharing", "file_transfer", "anonymiser"}:
        slow_factor = min(cum_7d_mb / 400.0, 1.0)
    else:
        slow_factor = 0.0
    slow_contrib = slow_factor * WEIGHTS["slow_leak"]
    total += slow_contrib
    signals.append({
        "name":   "slow_leak",
        "points": round(slow_contrib, 1),
        "detail": f"{cum_7d_mb:.0f} MB cumulative (7-day) to {sni}",
    })

    # ── Fusion ───────────────────────────────────────────────────────────────
    risk     = round(float(np.clip(total, 0, 100)), 1)
    severity = _get_severity(risk)

    if severity == "info":
        return None

    scenario_val = row.get("scenarios", None)
    if isinstance(scenario_val, str):
        import ast
        try:
            scenario_val = ast.literal_eval(scenario_val)
        except Exception:
            scenario_val = [scenario_val] if scenario_val else []

    alert = {
        "id":       f"a_{abs(hash(str(row.name) + str(row['user_id']))) % 10000:04d}",
        "entity":   str(row["user_id"]),
        "role":     str(row.get("role", "unknown")),
        "window":   str(row.get("window", "")),
        "risk":     risk,
        "severity": severity,
        "signals":  signals,
        "destination": {
            "sni":               sni,
            "category":          cat,
            "first_seen_for_user": bool(row.get("new_dest_user", False)),
            "first_seen_for_org":  bool(row.get("new_dest_org", False)),
        },
        "out_mb":   round(out_mb, 2),
        "recommended_action": RECOMMENDED_ACTIONS[severity],
        "scenario": scenario_val,
        "has_exfil": int(row.get("has_exfil", 0)),
    }
    return alert


def score_all(
    feat_path=None,
    user_bl_path=None,
    peer_bl_path=None,
    model_path=None,
    scaler_path=None,
    out_path=None,
):
    if feat_path is None:    feat_path    = os.path.join(REPO, "data", "features_15m.csv")
    if user_bl_path is None: user_bl_path = os.path.join(REPO, "data", "baselines_user.json")
    if peer_bl_path is None: peer_bl_path = os.path.join(REPO, "data", "baselines_peer.json")
    if model_path is None:   model_path   = os.path.join(REPO, "data", "model.joblib")
    if scaler_path is None:  scaler_path  = os.path.join(REPO, "data", "scaler.joblib")
    if out_path is None:     out_path     = os.path.join(REPO, "data", "alerts.json")

    df = pd.read_csv(feat_path)
    with open(user_bl_path) as f:
        user_bl = json.load(f)
    with open(peer_bl_path) as f:
        peer_bl = json.load(f)

    model  = joblib.load(model_path)
    scaler = joblib.load(scaler_path)

    alerts = []
    for _, row in df.iterrows():
        alert = score_window(row, model, scaler, user_bl, peer_bl)
        if alert:
            alerts.append(alert)

    alerts.sort(key=lambda a: a["window"], reverse=True)

    # ensure unique IDs
    seen_ids: dict = {}
    for a in alerts:
        base = a["id"]
        if base in seen_ids:
            seen_ids[base] += 1
            a["id"] = f"{base}_{seen_ids[base]}"
        else:
            seen_ids[base] = 0

    with open(out_path, "w") as f:
        json.dump(alerts, f, indent=2, default=str)

    print(f"[score] {len(alerts)} alerts -> {out_path}")
    return alerts


if __name__ == "__main__":
    score_all()
