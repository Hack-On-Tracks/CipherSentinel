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
    group = group.copy()
    for col in ("dest_region", "dest_country"):
        if col not in group:
            group[col] = "unknown"
        group[col] = group[col].fillna("unknown").astype(str)
    totals = group.groupby(["sni", "dest_category", "dest_region", "dest_country"], dropna=False)["out_bytes"].sum()
    if totals.empty:
        return pd.Series({"primary_sni": "unknown", "dest_category": "unknown", "dest_region": "unknown", "dest_country": "unknown"})
    sni, category, region, country = totals.idxmax()
    return pd.Series({"primary_sni": str(sni), "dest_category": str(category), "dest_region": str(region), "dest_country": str(country)})


def build_windows(flows: pd.DataFrame, freq: str, label: str) -> pd.DataFrame:
    flows = flows.copy()
    # ECH/QUIC can hide SNI. Keep the record and let volume/timing/novelty
    # score it as an unknown destination rather than silently dropping it.
    flows["sni"] = flows["sni"].fillna("unknown").astype(str)
    flows["dest_category"] = flows["dest_category"].fillna("unknown").astype(str)
    flows["user_id"] = flows["user_id"].fillna("U-UNKNOWN").astype(str)
    flows["role"] = flows["role"].fillna("unassigned").astype(str)
    flows["scenario"] = flows.get("scenario", pd.Series(None, index=flows.index))
    flows["_risky_bytes"] = flows["out_bytes"].where(
        flows["dest_category"].isin({"personal_file_sharing", "file_transfer", "anonymiser"}), 0
    )

    # Explicit ground truth tracking: do not mark unlabeled real data as benign
    has_labels_col = "label" in flows.columns and not (flows["label"].astype(str).str.lower() == "unlabeled").all()
    flows["is_exfil_flow"] = (flows["label"].astype(str).str.lower() == "exfiltration").astype(int) if "label" in flows.columns else 0
    flows["is_labeled_flow"] = (flows["label"].astype(str).str.lower().isin(["exfiltration", "benign"])).astype(int) if "label" in flows.columns else 0

    flows["window"] = pd.to_datetime(flows["ts"], utc=True, format="mixed").dt.floor(freq)
    base = flows.groupby(["user_id", "role", "window"], sort=True)
    numeric = base.agg(
        out_bytes=("out_bytes", "sum"),
        in_bytes=("in_bytes", "sum"),
        conn_count=("flow_id", "count"),
        max_duration=("duration", "max"),
        risky_bytes=("_risky_bytes", "sum"),
        scenarios=("scenario", lambda x: sorted(set(s for s in x.dropna() if s is not None and str(s) != "nan"))),
        has_exfil=("is_exfil_flow", lambda x: int(x.any())),
        labeled=("is_labeled_flow", lambda x: int(x.any())),
    ).reset_index()
    # Preserve port and geographic context when the source actually supplies it.
    # These are optional because many Zeek exports omit them.
    for source_col, output_col, reducer in [
        ("dst_port", "dst_ports", lambda values: sorted(set(pd.to_numeric(values, errors="coerce").dropna().astype(int)))),
    ]:
        if source_col in flows.columns:
            optional = base[source_col].agg(reducer).reset_index(name=output_col)
            numeric = numeric.merge(optional, on=["user_id", "role", "window"], validate="one_to_one")
    if "evaluation_split" in flows.columns:
        split_values = base["evaluation_split"].agg(
            lambda values: values.iloc[0] if values.nunique(dropna=False) == 1 else "mixed"
        ).reset_index(name="evaluation_split")
        # A coarser aggregation (for example a daily window) can span the
        # training cutoff. Mark it mixed so neither fit nor test accidentally
        # consumes data from both sides of the boundary.
        numeric = numeric.merge(split_values, on=["user_id", "role", "window"], validate="one_to_one")

    if not has_labels_col:
        # Explicit indicator for evaluation that ground truth was not present
        numeric["has_exfil"] = 0
        numeric["labeled"] = 0

    principal = base.apply(_principal, include_groups=False).reset_index()
    out = numeric.merge(principal, on=["user_id", "role", "window"], validate="one_to_one")

    # Causal fingerprint rarity: only prior observations count, never future test data.
    ja4_counts: dict[str, int] = {}
    rarity = []
    for _, flow in flows.sort_values("ts").iterrows():
        fp = str(flow.get("ja4", "unknown"))
        rarity.append(int(fp not in {"unknown", "nan", ""} and ja4_counts.get(fp, 0) < 3))
        if fp not in {"unknown", "nan", ""}:
            ja4_counts[fp] = ja4_counts.get(fp, 0) + 1
    flows["_ja4_rare"] = rarity
    ja4s = flows.groupby(["user_id", "role", "window"], sort=True)["_ja4_rare"].max().reset_index(name="ja4_rare")
    out = out.merge(ja4s, on=["user_id", "role", "window"], validate="one_to_one")

    out["out_in_ratio"] = out.out_bytes / (out.in_bytes + 1)
    out["out_bytes_log"] = __import__("numpy").log1p(out.out_bytes.clip(lower=0))
    out["byte_asymmetry"] = (out.out_bytes - out.in_bytes) / (out.out_bytes + out.in_bytes + 1)
    out["category_risk"] = out.risky_bytes / (out.out_bytes + 1)
    out["conn_count_log"] = __import__("numpy").log1p(out.conn_count.clip(lower=0))
    out["max_duration_log"] = __import__("numpy").log1p(out.max_duration.clip(lower=0))
    out["hour_of_week"] = out.window.dt.dayofweek * 24 + out.window.dt.hour
    out["window_label"] = label
    # Causal user activity-hour deviation: only earlier 30-day windows inform it.
    out = out.sort_values(["user_id", "window"]).copy()
    active_dev = []
    for _, group in out.groupby("user_id", sort=False):
        prior: list[tuple[pd.Timestamp, int]] = []
        for row in group.itertuples():
            cutoff = row.window - pd.Timedelta(days=30)
            prior = [(ts, hour) for ts, hour in prior if ts >= cutoff]
            hour = int(row.window.hour)
            active_dev.append((row.Index, int(bool(prior) and hour not in {h for _, h in prior})) )
            prior.append((row.window, hour))
    dev = dict(active_dev)
    out["active_hours_dev"] = [dev.get(i, 0) for i in out.index]
    out["is_off_hours"] = ((out.window.dt.hour < 7) | (out.window.dt.hour >= 19)).astype(int)
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
    region_seen: set[tuple[str, str]] = set()
    region_dest_flags = []
    for row in df.itertuples():
        region = str(getattr(row, "dest_region", "unknown"))
        destination = str(row.primary_sni)
        key = (region, destination)
        known = region.lower() not in {"unknown", "nan", ""} and destination != "unknown"
        region_dest_flags.append(int(known and key not in region_seen))
        if known:
            region_seen.add(key)
    df["new_region_and_destination"] = region_dest_flags
    if "dst_ports" in df:
        port_seen: dict[str, set[int]] = {}
        novel_ports = []
        for row in df.itertuples():
            uid = str(row.user_id)
            seen = port_seen.setdefault(uid, set())
            values = getattr(row, "dst_ports", [])
            clean = {int(p) for p in values if pd.notna(p)} if isinstance(values, list) else set()
            novel_ports.append(int(bool(clean - seen)))
            seen.update(clean)
        df["novel_dst_port"] = novel_ports
    return df


def add_cumulative_out(df: pd.DataFrame, days: int = 7) -> pd.DataFrame:
    """Elapsed-time rolling volume, by user and destination."""
    df = df.sort_values(["user_id", "primary_sni", "window"]).copy()
    values = pd.Series(index=df.index, dtype=float)
    for _, group in df.groupby(["user_id", "primary_sni"], sort=False):
        indexed = group.set_index("window")["out_bytes"]
        values.loc[group.index] = indexed.rolling(f"{days}D", min_periods=1).sum().to_numpy()
    df["cum_out_7d"] = values
    df["cum_out_7d_mb_log"] = __import__("numpy").log1p(values.clip(lower=0) / 1e6)
    df["bytes_to_novel_dst_log"] = __import__("numpy").log1p(
        df["out_bytes"].where(pd.to_numeric(df.get("new_dest_user", 0), errors="coerce").fillna(0).astype(bool), 0).clip(lower=0)
    )
    if "dst_ports" in df:
        risky = []
        for ports in df["dst_ports"]:
            values = ports if isinstance(ports, list) else []
            clean = {int(p) for p in values if pd.notna(p)}
            risky.append(sum(p in {21, 22, 23, 445, 3389, 5900, 8080, 8443} for p in clean) / max(1, len(clean)))
        df["risky_dst_port_share"] = risky
    else:
        if "novel_dst_port" not in df:
            df["novel_dst_port"] = 0
        df["risky_dst_port_share"] = 0.0
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
