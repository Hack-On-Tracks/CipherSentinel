"""Metadata-only flow aggregation for CipherSentinel."""
from __future__ import annotations
import os
import pandas as pd

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_flows(path: str = "data/flows.csv") -> pd.DataFrame:
    return pd.read_csv(path, parse_dates=["ts"])

def _principal(group: pd.DataFrame) -> pd.Series:
    """Destination carrying the most outbound bytes in a mixed window."""
    totals = group.groupby(["sni", "dest_category"], dropna=False)["out_bytes"].sum()
    sni, category = totals.idxmax()
    return pd.Series({"primary_sni": sni, "dest_category": category})

def build_windows(flows: pd.DataFrame, freq: str, label: str) -> pd.DataFrame:
    flows = flows.copy()
    # ECH/QUIC can hide SNI.  Keep the record and let volume/timing/novelty
    # score it as an unknown destination rather than silently dropping it.
    flows["sni"] = flows["sni"].fillna("unknown")
    flows["dest_category"] = flows["dest_category"].fillna("unknown")
    flows["window"] = flows["ts"].dt.floor(freq)
    base = flows.groupby(["user_id", "role", "window"], sort=True)
    numeric = base.agg(
        out_bytes=("out_bytes", "sum"), in_bytes=("in_bytes", "sum"),
        conn_count=("flow_id", "count"), max_duration=("duration", "max"),
        scenarios=("scenario", lambda x: sorted(set(x.dropna()))),
        has_exfil=("label", lambda x: int((x == "exfiltration").any())),
    ).reset_index()
    principal = base.apply(_principal, include_groups=False).reset_index()
    out = numeric.merge(principal, on=["user_id", "role", "window"], validate="one_to_one")
    ja4_counts = flows.groupby("ja4")["flow_id"].count()
    rare = set(ja4_counts[ja4_counts <= max(2, int(len(flows) * .01))].index)
    ja4s = base["ja4"].agg(list).reset_index(name="ja4s")
    out = out.merge(ja4s, on=["user_id", "role", "window"], validate="one_to_one")
    out["ja4_rare"] = out.ja4s.apply(lambda values: int(any(v in rare for v in values)))
    out = out.drop(columns="ja4s")
    out["out_in_ratio"] = out.out_bytes / (out.in_bytes + 1)
    out["hour_of_week"] = out.window.dt.dayofweek * 24 + out.window.dt.hour
    out["window_label"] = label
    return out

def add_novelty_flags(df: pd.DataFrame) -> pd.DataFrame:
    """Causal first-contact flags, ordered by timestamp."""
    df = df.sort_values(["window", "user_id", "primary_sni"]).copy()
    user_seen, org_seen = set(), set()
    user_flags, org_flags = [], []
    for row in df.itertuples():
        pair = (str(row.user_id), str(row.primary_sni))
        user_flags.append(int(pair not in user_seen))
        org_flags.append(int(row.primary_sni not in org_seen))
        user_seen.add(pair); org_seen.add(str(row.primary_sni))
    df["new_dest_user"], df["new_dest_org"] = user_flags, org_flags
    return df

def add_cumulative_out(df: pd.DataFrame, days: int = 7) -> pd.DataFrame:
    """Elapsed-time rolling volume, by user and destination."""
    df = df.sort_values(["user_id", "primary_sni", "window"]).copy()
    values = pd.Series(index=df.index, dtype=float)
    for _, group in df.groupby(["user_id", "primary_sni"], sort=False):
        indexed = group.set_index("window")["out_bytes"]
        values.loc[group.index] = indexed.rolling(f"{days}D", min_periods=1).sum().to_numpy()
    df["cum_out_7d"] = values
    return df.sort_values(["window", "user_id"]).reset_index(drop=True)

def build_all(flows_path: str | None = None, out_dir: str | None = None):
    flows_path = flows_path or os.path.join(REPO, "data", "flows.csv")
    out_dir = out_dir or os.path.join(REPO, "data")
    os.makedirs(out_dir, exist_ok=True)
    flows = load_flows(flows_path)
    results = []
    for freq, label, filename in [("15min", "15m", "features_15m.csv"), ("1D", "24h", "features_24h.csv")]:
        result = add_cumulative_out(add_novelty_flags(build_windows(flows, freq, label)))
        destination = os.path.join(out_dir, filename)
        result.to_csv(destination, index=False)
        print(f"[features] {len(result)} {label} windows -> {destination}")
        results.append(result)
    return tuple(results)

if __name__ == "__main__":
    build_all()
