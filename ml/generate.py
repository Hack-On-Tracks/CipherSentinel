"""
generate.py  -  Synthetic Zeek-style flow generator for CipherSentinel.

Produces 30 pseudonymous users across five roles over 30 days.
Injects four priority-ordered scenarios (S1-S4) with full ground-truth labels.
Outputs: data/flows.csv  and  data/ground_truth.csv
"""

import numpy as np
import pandas as pd
import random
import argparse
from datetime import datetime, timedelta
import os

SEED = 42
rng  = np.random.default_rng(SEED)
random.seed(SEED)

# ── role definitions ──────────────────────────────────────────────────────────
ROLES = {
    "engineer":   {"n": 8,  "work_hours": (8,20),  "upload_mb_median": 150, "upload_mb_mad": 80},
    "finance":    {"n": 6,  "work_hours": (9,18),   "upload_mb_median": 10,  "upload_mb_mad": 5},
    "design":     {"n": 5,  "work_hours": (9,18),   "upload_mb_median": 18,  "upload_mb_mad": 8},
    "hr":         {"n": 5,  "work_hours": (9,17),   "upload_mb_median": 8,   "upload_mb_mad": 4},
    "sales":      {"n": 6,  "work_hours": (8,19),   "upload_mb_median": 20,  "upload_mb_mad": 10},
}

# Destination category mix per role  {sni: category}
DEST_PROFILES = {
    "engineer":  [
        ("github.com","sanctioned",0.3),("s3.amazonaws.com","sanctioned",0.2),
        ("storage.googleapis.com","sanctioned",0.15),("drive.google.com","sanctioned",0.1),
        ("npmjs.com","sanctioned",0.1),("onedrive.live.com","sanctioned",0.05),
        ("dropbox.com","personal_file_sharing",0.05),("transfer.sh","file_transfer",0.05),
    ],
    "finance": [
        ("netsuite.com","sanctioned",0.25),("drive.google.com","sanctioned",0.25),
        ("sharepoint.com","sanctioned",0.25),("docusign.com","sanctioned",0.15),
        ("dropbox.com","personal_file_sharing",0.05),("gmail.com","unknown",0.05),
    ],
    "design": [
        ("figma.com","sanctioned",0.35),("drive.google.com","sanctioned",0.25),
        ("sharepoint.com","sanctioned",0.2),("storage.googleapis.com","sanctioned",0.1),
        ("dropbox.com","personal_file_sharing",0.1),
    ],
    "hr": [
        ("drive.google.com","sanctioned",0.4),("sharepoint.com","sanctioned",0.3),
        ("bamboohr.com","sanctioned",0.2),("dropbox.com","personal_file_sharing",0.05),
        ("gmail.com","unknown",0.05),
    ],
    "sales": [
        ("salesforce.com","sanctioned",0.3),("drive.google.com","sanctioned",0.2),
        ("sharepoint.com","sanctioned",0.15),("dropbox.com","personal_file_sharing",0.1),
        ("wetransfer.com","file_transfer",0.1),("gmail.com","unknown",0.1),
        ("box.com","sanctioned",0.05),
    ],
}

JA4_BROWSER = "t13d1516h2_8daaf6152771_b0da82dd1658"
JA4_CURL    = "t13d1516h2_8daaf6152771_000000000000"
JA4_SYNC    = "t13d2020h2_ccccddddeeee_aabbccddeeff"

START_DATE = datetime(2026, 3, 1)
DAYS = 30

# Canonical scenario-to-entity mapping, kept beside the injectors that define
# each scenario so the API and generator cannot drift independently.
SCENARIO_USERS = {
    "S1": "U-008", "S2": "U-019", "S3": "U-009", "S4": "U-000",
}

def build_users():
    users = []
    uid = 0
    for role, cfg in ROLES.items():
        for _ in range(cfg["n"]):
            users.append({
                "user_id": f"U-{uid:03d}",
                "role": role,
                "ip_base": f"10.1.{uid // 10}.{uid % 10 + 1}",
            })
            uid += 1
    return users

def pick_dest(role):
    profile = DEST_PROFILES[role]
    snis = [p[0] for p in profile]
    cats = [p[1] for p in profile]
    probs = np.array([p[2] for p in profile])
    probs /= probs.sum()
    idx = rng.choice(len(snis), p=probs)
    return snis[idx], cats[idx]

def lognormal_bytes(median_mb, mad_mb):
    """Sample outbound bytes from a lognormal distribution."""
    sigma = 1.4826 * mad_mb / (median_mb + 1e-9)
    sigma = np.clip(sigma, 0.1, 2.0)
    mu = np.log(median_mb * 1e6 + 1)
    val = rng.lognormal(mu, sigma)
    return max(int(val), 1024)

def gen_normal_flow(user, ts, label="benign"):
    role = user["role"]
    cfg  = ROLES[role]
    sni, cat = pick_dest(role)
    out_bytes = lognormal_bytes(cfg["upload_mb_median"], cfg["upload_mb_mad"])
    in_bytes  = lognormal_bytes(cfg["upload_mb_median"] * 5, cfg["upload_mb_mad"] * 5)
    duration  = rng.uniform(1, 300)
    ja4 = JA4_BROWSER if rng.random() < 0.9 else JA4_CURL
    region = "US" if rng.random() < 0.97 else "CA"
    return {
        "ts": ts.isoformat(),
        "user_id": user["user_id"],
        "role": user["role"],
        "src_ip": user["ip_base"],
        "sni": sni,
        "dest_category": cat,
        "out_bytes": out_bytes,
        "in_bytes": in_bytes,
        "duration": round(duration, 2),
        "ja4": ja4,
        "dst_port": int(rng.choice([443, 443, 443, 443, 80, 8443])),
        "dest_region": region,
        "dest_country": region,
        "label": label,
        "scenario": None,
    }

def hour_in_work(ts, role):
    wh = ROLES[role]["work_hours"]
    h = ts.hour
    return wh[0] <= h < wh[1]

def generate_baseline(users, days=DAYS):
    rows = []
    for day in range(days):
        date = START_DATE + timedelta(days=day)
        for user in users:
            role = user["role"]
            wh   = ROLES[role]["work_hours"]
            n_sessions = rng.integers(3, 15)
            for _ in range(n_sessions):
                hour = rng.integers(wh[0], wh[1])
                minute = rng.integers(0, 60)
                if user["user_id"] == SCENARIO_USERS["S4"] and hour in {9, 13, 17} and minute < 15:
                    continue  # Keep regular release windows distinct from incidental flows.
                ts = date + timedelta(hours=int(hour), minutes=int(minute))
                rows.append(gen_normal_flow(user, ts))
            if user["user_id"] == SCENARIO_USERS["S4"]:
                # Establish repeated, known-good release behavior before the
                # held-out S4 replay so high volume alone is not treated as theft.
                for hour in [9, 13, 17]:
                    ts = date + timedelta(hours=hour, minutes=5)
                    release = gen_normal_flow(user, ts, label="benign")
                    release.update({
                        "out_bytes": int(3e9),
                        "sni": "onedrive.live.com",
                        "dest_category": "sanctioned",
                        "dst_port": 443,
                        "dest_region": "US",
                        "dest_country": "US",
                    })
                    rows.append(release)
    return rows

# ── scenario injectors ────────────────────────────────────────────────────────

def inject_S1(users, rows):
    """Priority 1: high-volume, off-hours exfiltration over a new risky channel."""
    victim = [u for u in users if u["role"] == "finance"][0]
    ts = START_DATE + timedelta(days=22, hours=2, minutes=14)
    r = gen_normal_flow(victim, ts, label="exfiltration")
    r["out_bytes"]      = int(4e8)  # 400 MB
    r["sni"]            = "mega.nz"
    r["dest_category"]  = "personal_file_sharing"
    r["ja4"]            = JA4_SYNC
    r["dst_port"]       = 9443
    r["dest_region"]    = "NL"
    r["dest_country"]   = "NL"
    r["scenario"]       = "S1"
    rows.append(r)
    return rows

def inject_S2(users, rows):
    """Priority 2: 60 MB/day for eight days, below per-window threshold but high cumulatively."""
    victim = [u for u in users if u["role"] == "hr"][0]
    for day in range(22, 30):
        date = START_DATE + timedelta(days=day)
        ts   = date + timedelta(hours=20, minutes=rng.integers(0,30).item())
        r    = gen_normal_flow(victim, ts, label="exfiltration")
        r["out_bytes"]     = int(60e6)  # 60 MB
        r["sni"]           = "wetransfer.com"
        r["dest_category"] = "file_transfer"
        r["dst_port"]       = 443
        r["scenario"]      = "S2"
        rows.append(r)
    return rows

def inject_S3(users, rows):
    """Priority 3: covert channel evasion with a rare tool, port, and region."""
    victim = [u for u in users if u["role"] == "finance"][1]
    for day in range(23, 29):
        date = START_DATE + timedelta(days=day)
        ts   = date + timedelta(hours=14, minutes=rng.integers(0,30).item())
        r    = gen_normal_flow(victim, ts, label="exfiltration")
        r["out_bytes"]     = int(120e6)
        r["sni"]           = "filebin.net"
        r["dest_category"] = "anonymiser"
        r["ja4"]           = JA4_SYNC
        r["dst_port"]      = 4444
        r["dest_region"]   = "RU"
        r["dest_country"]  = "RU"
        r["scenario"]      = "S3"
        rows.append(r)
    return rows

def inject_S4(users, rows):
    """Hard negative: repeated large engineering releases on a familiar channel and schedule."""
    victim = [u for u in users if u["role"] == "engineer"][0]
    for day in range(22, 30):
        ts = START_DATE + timedelta(days=day, hours=9, minutes=5)
        r  = gen_normal_flow(victim, ts, label="benign")
        r["out_bytes"]     = int(3e9)
        r["sni"]           = "onedrive.live.com"
        r["dest_category"] = "sanctioned"
        r["dst_port"]      = 443
        r["dest_region"]   = "US"
        r["dest_country"]  = "US"
        r["scenario"]      = "S4"
        rows.append(r)
    return rows

def main(seed=SEED, out_dir="data"):
    global rng
    rng = np.random.default_rng(seed)
    random.seed(seed)
    os.makedirs(out_dir, exist_ok=True)

    users = build_users()
    rows  = generate_baseline(users)

    rows = inject_S1(users, rows)
    rows = inject_S2(users, rows)
    rows = inject_S3(users, rows)
    rows = inject_S4(users, rows)

    df = pd.DataFrame(rows)
    df["ts"] = pd.to_datetime(df["ts"])
    df = df.sort_values("ts").reset_index(drop=True)
    df["flow_id"] = df.index.map(lambda i: f"f_{i:06d}")

    flows_path = os.path.join(out_dir, "flows.csv")
    df.to_csv(flows_path, index=False)
    print(f"[generate] {len(df)} flows -> {flows_path}")

    # This labels all four scenarios; S4 is the benign hard-negative control.
    gt = df[df["scenario"].notna()][["flow_id","user_id","ts","scenario","label","sni","out_bytes"]]
    gt_path = os.path.join(out_dir, "ground_truth.csv")
    gt.to_csv(gt_path, index=False)
    print(f"[generate] {len(gt)} labelled events -> {gt_path}")

    users_df = pd.DataFrame(users)
    users_df.to_csv(os.path.join(out_dir, "users.csv"), index=False)

    manifest_path = os.path.join(out_dir, "manifest.json")
    import json
    from datetime import datetime, timezone
    manifest = {
        "dataset_id": f"synthetic_seed_{seed}",
        "source_type": "synthetic",
        "provenance": "Synthetic Zeek-style flows (30 users, 5 roles, 30 days, four priority-ordered S1-S4 scenarios)",
        "license": "CC0-1.0 Public Domain (Generated Demo Telemetry)",
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        "metadata_only_verified": True,
        "payload_inspection_performed": False,
        "flow_count": len(df),
        "entity_count": len(users),
        "time_range": {"start": str(df["ts"].min()), "end": str(df["ts"].max())},
        "label_availability": "synthetic_injected",
        "scenario_ids": ["S1", "S2", "S3", "S4"],
        "schema_mapping": {
            "flow_id": "Synthetic flow identifier",
            "ts": "Simulated connection timestamp",
            "user_id": "Pseudonymous identity (U-000 to U-029)",
            "role": "Department cohort (engineer, finance, design, hr, sales)",
            "src_ip": "Simulated RFC 1918 internal IP",
            "sni": "Destination domain",
            "dest_category": "Policy category",
            "out_bytes": "Egress bytes",
            "in_bytes": "Ingress bytes",
            "duration": "Connection duration in seconds",
            "ja4": "Client TLS fingerprint",
            "label": "benign | exfiltration",
            "dst_port": "Destination service port",
            "dest_region": "Synthetic destination region",
            "dest_country": "Synthetic destination country",
            "scenario": "S1-S4 or null"
        }
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"[generate] Manifest -> {manifest_path}")
    return df

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--out_dir", default="data")
    args = parser.parse_args()
    main(seed=args.seed, out_dir=args.out_dir)
