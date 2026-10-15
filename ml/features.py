"""Metadata-only flow aggregation for CipherSentinel."""
from __future__ import annotations
import argparse
import os
import sys
import pandas as pd

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_flows(path: str = "data/flows.csv") -> pd.DataFrame:
    return pd.read_csv(path, parse_dates=["ts"])


def _principal(group: pd.DataFrame) -> pd.Series:
    """Destination carrying the most outbound bytes in a mixed window."""
    totals = group.groupby(["sni", "dest_category"], dropna=False)["out_bytes"].sum()
    if totals.empty:
        return pd.Series({"primary_sni": "unknown", "dest_category": "unknown"})
    sni, category = totals.idxmax()
    return pd.Series({"primary_sni": str(sni), "dest_category": str(category)})


def build_windows(flows: pd.DataFrame, freq: str, label: str) -> pd.DataFrame:
    flows = flows.copy()
    # ECH/QUIC can hide SNI. Keep the record and let volume/timing/novelty
    # score it as an unknown destination rather than silently dropping it.
    flows["sni"] = flows["sni"].fillna("unknown").astype(str)
    flows["dest_category"] = flows["dest_category"].fillna("unknown").astype(str)
    flows["user_id"] = flows["user_id"].fillna("U-UNKNOWN").astype(str)
    flows["role"] = flows["role"].fillna("unassigned").astype(str)
    flows["scenario"] = flows.get("scenario", pd.Series(None, index=flows.index))

    # Explicit ground truth tracking: do not mark unlabeled real data as benign
    has_labels_col = "label" in flows.columns and not (flows["label"].astype(str).str.lower() == "unlabeled").all()
    flows["is_exfil_flow"] = (flows["label"].astype(str).str.lower() == "exfiltration").astype(int) if "label" in flows.columns else 0
    flows["is_labeled_flow"] = (flows["label"].astype(str).str.lower().isin(["exfiltration", "benign"])).astype(int) if "label" in flows.columns else 0

    flows["window"] = pd.to_datetime(flows["ts"], utc=True).dt.floor(freq)
    base = flows.groupby(["user_id", "role", "window"], sort=True)
    numeric = base.agg(
        out_bytes=("out_bytes", "sum"),
        in_bytes=("in_bytes", "sum"),
        conn_count=("flow_id", "count"),
        max_duration=("duration", "max"),
        scenarios=("scenario", lambda x: sorted(set(s for s in x.dropna() if s is not None and str(s) != "nan"))),
        has_exfil=("is_exfil_flow", lambda x: int(x.any())),
        labeled=("is_labeled_flow", lambda x: int(x.any())),
    ).reset_index()

    if not has_labels_col:
        # Explicit indicator for evaluation that ground truth was not present
        numeric["has_exfil"] = 0
        numeric["labeled"] = 0

    principal = base.apply(_principal, include_groups=False).reset_index()
    out = numeric.merge(principal, on=["user_id", "role", "window"], validate="one_to_one")

    # JA4 rarity calculation
    ja4_series = flows["ja4"].fillna("unknown").astype(str)
    ja4_counts = ja4_series.value_counts()
    rare = set(ja4_counts[ja4_counts <= max(2, int(len(flows) * .01))].index)
    if "unknown" in rare:
        rare.remove("unknown")  # Unknown is unobserved, not an anomaly fingerprint

    ja4s = base["ja4"].agg(list).reset_index(name="ja4s")
    out = out.merge(ja4s, on=["user_id", "role", "window"], validate="one_to_one")
    out["ja4_rare"] = out.ja4s.apply(lambda values: int(any(v in rare for v in values if str(v) != "unknown")))
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
        user_flags.append(int(pair not in user_seen and str(row.primary_sni) != "unknown"))
        org_flags.append(int(str(row.primary_sni) not in org_seen and str(row.primary_sni) != "unknown"))
        user_seen.add(pair)
        org_seen.add(str(row.primary_sni))
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


def main():
    parser = argparse.ArgumentParser(description="Build window features from flow logs.")
    parser.add_argument("--flows", default=os.path.join(REPO, "data", "flows.csv"), help="Path to flows.csv")
    parser.add_argument("--out-dir", default=os.path.join(REPO, "data"), help="Output directory")
    args = parser.parse_args()
    build_all(flows_path=args.flows, out_dir=args.out_dir)


if __name__ == "__main__":
    main()
