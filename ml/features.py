"""
features.py  -  Convert raw flow records into entity-window features.

Entity windows: 15-minute and 24-hour buckets per user.
Output: data/features_15m.csv  and  data/features_24h.csv
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pandas as pd
import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

WINDOW_MINUTES = 15

UNSANCTIONED = {"personal_file_sharing", "file_transfer", "anonymiser"}

def load_flows(path="data/flows.csv"):
    df = pd.read_csv(path, parse_dates=["ts"])
    return df

def build_windows(df: pd.DataFrame, freq: str, label: str) -> pd.DataFrame:
    """Aggregate flows into time windows per user."""
    df = df.copy()
    df["window"] = df["ts"].dt.floor(freq)

    agg = (
        df.groupby(["user_id", "role", "window"])
        .agg(
            out_bytes=("out_bytes", "sum"),
            in_bytes=("in_bytes", "sum"),
            conn_count=("flow_id", "count"),
            max_duration=("duration", "max"),
            snis=("sni", lambda x: list(x.unique())),
            categories=("dest_category", lambda x: set(x)),
            ja4s=("ja4", lambda x: list(x)),
            scenarios=("scenario", lambda x: list(x.dropna().unique())),
            has_exfil=("label", lambda x: int((x == "exfiltration").any())),
        )
        .reset_index()
    )

    # derived features
    agg["out_in_ratio"] = agg["out_bytes"] / (agg["in_bytes"] + 1)
    agg["hour_of_day"]  = agg["window"].dt.hour
    agg["hour_of_week"] = agg["window"].dt.dayofweek * 24 + agg["window"].dt.hour
    agg["day"]          = agg["window"].dt.date.astype(str)

    # destination policy signal (any unsanctioned dest)
    agg["has_unsanctioned"] = agg["categories"].apply(
        lambda cats: int(bool(cats & UNSANCTIONED))
    )

    # anonymiser flag
    agg["has_anonymiser"] = agg["categories"].apply(
        lambda cats: int("anonymiser" in cats)
    )

    # primary SNI (most bytes - approximated by first heavy one)
    agg["primary_sni"] = agg["snis"].apply(lambda s: s[0] if s else "")
    agg["primary_category"] = agg["categories"].apply(
        lambda cats: (
            "anonymiser" if "anonymiser" in cats
            else "personal_file_sharing" if "personal_file_sharing" in cats
            else "file_transfer" if "file_transfer" in cats
            else "sanctioned"
        )
    )

    # JA4 rarity flag (presence of SYNC fingerprint)
    SYNC_FP = "t13d2020h2_ccccddddeeee_aabbccddeeff"
    agg["ja4_sync_present"] = agg["ja4s"].apply(lambda js: int(SYNC_FP in js))

    # drop list columns (not needed downstream)
    agg = agg.drop(columns=["snis", "categories", "ja4s"])
    agg["window_label"] = label

    return agg

def add_novelty_flags(df: pd.DataFrame) -> pd.DataFrame:
    """Flag first-time user->SNI and org-wide->SNI contacts."""
    df = df.sort_values("window").copy()

    seen_user_sni: dict = {}
    seen_org_sni:  set  = set()

    new_dest_user = []
    new_dest_org  = []

    for _, row in df.iterrows():
        key_user = (row["user_id"], row["primary_sni"])
        key_org  = row["primary_sni"]
        new_dest_user.append(int(key_user not in seen_user_sni))
        new_dest_org.append(int(key_org not in seen_org_sni))
        seen_user_sni[key_user] = True
        seen_org_sni.add(key_org)

    df["new_dest_user"] = new_dest_user
    df["new_dest_org"]  = new_dest_org
    return df

def add_cumulative_out(df: pd.DataFrame, window_days: int = 7) -> pd.DataFrame:
    """Rolling N-day cumulative outbound bytes per (user, primary_sni)."""
    df = df.sort_values(["user_id", "primary_sni", "window"]).copy()
    df["cum_out_7d"] = (
        df.groupby(["user_id", "primary_sni"])["out_bytes"]
        .transform(lambda x: x.rolling(window=window_days * 96, min_periods=1).sum())
    )
    return df

def build_all(flows_path=None, out_dir=None):
    if flows_path is None: flows_path = os.path.join(REPO, "data", "flows.csv")
    if out_dir is None: out_dir = os.path.join(REPO, "data")
    df = load_flows(flows_path)

    # 15-minute windows
    feat_15m = build_windows(df, "15min", "15m")
    feat_15m = add_novelty_flags(feat_15m)
    feat_15m = add_cumulative_out(feat_15m, window_days=7)
    out_15m  = os.path.join(out_dir, "features_15m.csv")
    feat_15m.to_csv(out_15m, index=False)
    print(f"[features] {len(feat_15m)} 15-min windows -> {out_15m}")

    # 24-hour windows (for slow-leak accumulator)
    feat_24h = build_windows(df, "1D", "24h")
    feat_24h = add_novelty_flags(feat_24h)
    feat_24h = add_cumulative_out(feat_24h, window_days=7)
    out_24h  = os.path.join(out_dir, "features_24h.csv")
    feat_24h.to_csv(out_24h, index=False)
    print(f"[features] {len(feat_24h)} 24-hr windows -> {out_24h}")

    return feat_15m, feat_24h

if __name__ == "__main__":
    build_all()
