"""
baseline.py  -  Per-user median/MAD baselines and peer-group baselines.

Computes robust z-scores for each entity window against:
  1. The user's own history (self_z)
  2. The user's role-cohort peers (peer_z)

Writes baselines as dicts serialised to JSON for use by score.py.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pandas as pd
import numpy as np
import json

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EPSILON = 1e-9
K_MAD   = 1.4826          # consistency constant for normal distribution

NUMERIC_COLS = ["out_bytes", "in_bytes", "out_in_ratio", "conn_count", "max_duration"]

def mad(x: np.ndarray) -> float:
    return float(np.median(np.abs(x - np.median(x))))

def robust_z(value: float, history: np.ndarray) -> float:
    """Robust z-score using median and MAD."""
    med = float(np.median(history))
    m   = K_MAD * mad(history)
    return (value - med) / (m + EPSILON)

def ewma(values: np.ndarray, alpha: float = 0.2) -> float:
    """Optional drift-aware baseline; never changes the robust default."""
    if len(values) == 0:
        return 0.0
    return float(pd.Series(values).ewm(alpha=alpha, adjust=False).mean().iloc[-1])

def compute_user_baselines(df: pd.DataFrame) -> dict:
    """
    For each user x hour_of_week bucket, store median and MAD of each numeric col.
    Returns a nested dict: baselines[user_id][hour_of_week][col] = {median, mad}
    """
    baselines = {}
    for user_id, udf in df.groupby("user_id"):
        baselines[user_id] = {}
        for hw, hwdf in udf.groupby("hour_of_week"):
            hw_key = int(hw)
            baselines[user_id][hw_key] = {}
            for col in NUMERIC_COLS:
                vals = hwdf[col].dropna().values.astype(float)
                if len(vals) == 0:
                    vals = np.array([0.0])
                baselines[user_id][hw_key][col] = {
                    "median": float(np.median(vals)),
                    "mad":    float(K_MAD * mad(vals)),
                    "n":      int(len(vals)),
                }
    return baselines

def compute_peer_baselines(df: pd.DataFrame) -> dict:
    """
    For each role x hour_of_week bucket, store median and MAD.
    Returns: peer_baselines[role][hour_of_week][col] = {median, mad}
    """
    peer = {}
    for role, rdf in df.groupby("role"):
        peer[role] = {}
        for hw, hwdf in rdf.groupby("hour_of_week"):
            hw_key = int(hw)
            peer[role][hw_key] = {}
            for col in NUMERIC_COLS:
                vals = hwdf[col].dropna().values.astype(float)
                if len(vals) == 0:
                    vals = np.array([0.0])
                peer[role][hw_key][col] = {
                    "median": float(np.median(vals)),
                    "mad":    float(K_MAD * mad(vals)),
                    "n":      int(len(vals)),
                }
    return peer

def score_self(row: pd.Series, baselines: dict) -> float:
    """
    Compute a composite self-baseline z-score for a single window row.
    Averages the z-scores for out_bytes and out_in_ratio (most exfil-relevant).
    Clipped to [0, 100] for the scoring pipeline.
    """
    uid  = str(row["user_id"])
    try:
        hw = int(row["hour_of_week"]) if not pd.isna(row.get("hour_of_week", np.nan)) else 0
    except Exception:
        hw = 0
    user_bl = baselines.get(uid, {})

    # JSON serialises int keys as strings - try both
    hw_str = str(hw)
    # Sparse 15-minute observations often leave an exact weekly hour with
    # fewer than three samples.  Use the nearest sufficiently populated
    # bucket rather than treating an off-hours transfer as unscorable.
    if (hw_str not in user_bl or any(user_bl[hw_str].get(c, {}).get("n", 0) < 3
                                    for c in ["out_bytes", "out_in_ratio"])) and user_bl:
        candidates = [h for h in user_bl if user_bl[h].get("out_bytes", {}).get("n", 0) >= 3]
        hw_str = min(candidates or list(user_bl), key=lambda h: abs(int(h) - hw))

    z_scores = []
    for col in ["out_bytes", "out_in_ratio"]:
        bl = user_bl.get(hw_str, {}).get(col)
        if bl is None or bl["n"] < 3:
            continue
        med = bl["median"]
        m   = bl["mad"]
        val = float(row[col]) if not pd.isna(row.get(col, np.nan)) else 0.0
        z   = (val - med) / (m + EPSILON)
        z_scores.append(z)

    if not z_scores:
        return 0.0
    return float(np.clip(np.mean(z_scores), 0, 100))

def score_peer(row: pd.Series, peer_baselines: dict) -> float:
    """Same logic but against the role cohort."""
    role = str(row["role"])
    try:
        hw = int(row["hour_of_week"]) if not pd.isna(row.get("hour_of_week", np.nan)) else 0
    except Exception:
        hw = 0
    role_bl = peer_baselines.get(role, {})

    hw_str = str(hw)
    if (hw_str not in role_bl or any(role_bl[hw_str].get(c, {}).get("n", 0) < 3
                                    for c in ["out_bytes", "out_in_ratio"])) and role_bl:
        candidates = [h for h in role_bl if role_bl[h].get("out_bytes", {}).get("n", 0) >= 3]
        hw_str = min(candidates or list(role_bl), key=lambda h: abs(int(h) - hw))

    z_scores = []
    for col in ["out_bytes", "out_in_ratio"]:
        bl = role_bl.get(hw_str, {}).get(col)
        if bl is None or bl["n"] < 3:
            continue
        med = bl["median"]
        m   = bl["mad"]
        val = float(row[col]) if not pd.isna(row.get(col, np.nan)) else 0.0
        z   = (val - med) / (m + EPSILON)
        z_scores.append(z)

    if not z_scores:
        return 0.0
    return float(np.clip(np.mean(z_scores), 0, 100))

def build_and_save(feat_path=None, out_dir=None, use_ewma: bool = False):
    if feat_path is None: feat_path = os.path.join(REPO, "data", "features_15m.csv")
    if out_dir is None: out_dir = os.path.join(REPO, "data")
    df = pd.read_csv(feat_path)
    # Scenario rows are withheld: a detector must not learn its test attacks,
    # legitimate controls, or hard-negative evaluation samples as history.
    scenario_text = df.get("scenarios", pd.Series("[]", index=df.index)).fillna("[]").astype(str)
    history = df[(df.get("has_exfil", 0).astype(int) == 0) & scenario_text.isin(["[]", ""])].copy()
    for col in NUMERIC_COLS:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    user_bl = compute_user_baselines(history)
    peer_bl = compute_peer_baselines(history)

    user_path = os.path.join(out_dir, "baselines_user.json")
    peer_path = os.path.join(out_dir, "baselines_peer.json")

    with open(user_path, "w") as f:
        json.dump(user_bl, f)
    with open(peer_path, "w") as f:
        json.dump(peer_bl, f)

    print(f"[baseline] User baselines -> {user_path}")
    print(f"[baseline] Peer baselines -> {peer_path}")
    return user_bl, peer_bl

if __name__ == "__main__":
    build_and_save()
