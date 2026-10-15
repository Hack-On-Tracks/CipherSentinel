"""
generate.py  -  Synthetic Zeek-style flow generator for CipherSentinel.

Produces 30 pseudonymous users across five roles over 30 days.
Injects six labelled scenarios (S1-S6) with full ground-truth labels.
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
                ts = date + timedelta(hours=int(hour), minutes=int(minute))
                rows.append(gen_normal_flow(user, ts))
    return rows

# ── scenario injectors ────────────────────────────────────────────────────────

def inject_S1(users, rows):
    """S1: Legitimate heavy uploader - engineer pushing builds. No alert expected."""
    eng = [u for u in users if u["role"] == "engineer"][0]
    for day in range(DAYS):
        date = START_DATE + timedelta(days=day)
        for hour in [9, 13, 17]:
            ts = date + timedelta(hours=hour, minutes=rng.integers(0,30).item())
            r  = gen_normal_flow(eng, ts, label="benign")
            r["out_bytes"]   = int(2e9)  # 2 GB build artefact
            r["sni"]         = "s3.amazonaws.com"
            r["dest_category"] = "sanctioned"
            r["scenario"]    = "S1"
            rows.append(r)
    return rows

def inject_S2(users, rows):
    """S2: Single 400 MB upload to personal storage at 02:00 - High alert."""
    victim = [u for u in users if u["role"] == "finance"][0]
    ts = START_DATE + timedelta(days=15, hours=2, minutes=14)
    r = gen_normal_flow(victim, ts, label="exfiltration")
    r["out_bytes"]      = int(4e8)  # 400 MB
    r["sni"]            = "mega.nz"
    r["dest_category"]  = "personal_file_sharing"
    r["ja4"]            = JA4_SYNC
    r["scenario"]       = "S2"
    rows.append(r)
    return rows

def inject_S3(users, rows):
    """S3: Low-and-slow - 40 MB a day for 10 days to one destination."""
    victim = [u for u in users if u["role"] == "hr"][0]
    for day in range(10, 20):
        date = START_DATE + timedelta(days=day)
        ts   = date + timedelta(hours=10, minutes=rng.integers(0,30).item())
        r    = gen_normal_flow(victim, ts, label="exfiltration")
        r["out_bytes"]     = int(40e6)  # 40 MB
        r["sni"]           = "wetransfer.com"
        r["dest_category"] = "file_transfer"
        r["scenario"]      = "S3"
        rows.append(r)
    return rows

def inject_S4(users, rows):
    """S4: Finance user using sync-tool JA4 to a new destination."""
    victim = [u for u in users if u["role"] == "finance"][1]
    for day in range(20, 25):
        date = START_DATE + timedelta(days=day)
        ts   = date + timedelta(hours=14, minutes=rng.integers(0,30).item())
        r    = gen_normal_flow(victim, ts, label="exfiltration")
        r["out_bytes"]     = int(80e6)
        r["sni"]           = "anonfiles.com"
        r["dest_category"] = "anonymiser"
        r["ja4"]           = JA4_SYNC
        r["scenario"]      = "S4"
        rows.append(r)
    return rows

def inject_S5(users, rows):
    """S5: Departing employee - rising volume and new destinations over 2 weeks."""
    victim = [u for u in users if u["role"] == "sales"][0]
    for day in range(16, 30):
        date = START_DATE + timedelta(days=day)
        ts   = date + timedelta(hours=18, minutes=rng.integers(0,30).item())
        r    = gen_normal_flow(victim, ts, label="exfiltration")
        # volume ramps linearly
        r["out_bytes"]     = int((day - 15) * 50e6)
        r["sni"]           = random.choice(["mega.nz","transfer.sh","anonfiles.com"])
        r["dest_category"] = "personal_file_sharing"
        r["scenario"]      = "S5"
        rows.append(r)
    return rows

def inject_S6(users, rows):
    """S6: Hard negative - new laptop doing a 3 GB first-day cloud sync. At most review."""
    victim = [u for u in users if u["role"] == "engineer"][2]
    ts = START_DATE + timedelta(days=1, hours=9, minutes=5)
    r  = gen_normal_flow(victim, ts, label="benign")
    r["out_bytes"]     = int(3e9)
    r["sni"]           = "onedrive.live.com"
    r["dest_category"] = "sanctioned"
    r["scenario"]      = "S6"
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
    rows = inject_S5(users, rows)
    rows = inject_S6(users, rows)

    df = pd.DataFrame(rows)
    df["ts"] = pd.to_datetime(df["ts"])
    df = df.sort_values("ts").reset_index(drop=True)
    df["flow_id"] = df.index.map(lambda i: f"f_{i:06d}")

    flows_path = os.path.join(out_dir, "flows.csv")
    df.to_csv(flows_path, index=False)
    print(f"[generate] {len(df)} flows -> {flows_path}")

    # This labels *all* scenario events; benign controls S1 and S6 remain explicit.
    gt = df[df["scenario"].notna()][["flow_id","user_id","ts","scenario","label","sni","out_bytes"]]
    gt_path = os.path.join(out_dir, "ground_truth.csv")
    gt.to_csv(gt_path, index=False)
    print(f"[generate] {len(gt)} labelled events -> {gt_path}")

    users_df = pd.DataFrame(users)
    users_df.to_csv(os.path.join(out_dir, "users.csv"), index=False)
    return df

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--out_dir", default="data")
    args = parser.parse_args()
    main(seed=args.seed, out_dir=args.out_dir)
