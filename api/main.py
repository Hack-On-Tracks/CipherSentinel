"""
main.py  –  CipherSentinel FastAPI backend.

Endpoints:
  GET  /health
  POST /api/replay/start?scenario=
  GET  /api/alerts?since=
  GET  /api/alerts/{id}
  GET  /api/entities/{id}/timeline
  GET  /api/compare?scenario=
  POST /api/alerts/{id}/feedback
"""

from __future__ import annotations

import json
import os
import sys
import time
import threading
from collections import defaultdict
from datetime import datetime
from typing import Any

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── path setup so we can import ml/ modules ───────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, "ml"))

from config import (
    DATA_DIR,
    DEFAULT_CORS_ORIGINS,
    MODEL_PATH,
    REPLAY_INTERVAL_SEC,
    SCALER_PATH,
)

DATA_PATH = os.path.join(BASE_DIR, DATA_DIR)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="CipherSentinel API", version="1.0.0")

# CORS
cors_origins = os.getenv("CORS_ORIGINS", ",".join(DEFAULT_CORS_ORIGINS)).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # restrict to cors_origins in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory store (loaded once at startup) ─────────────────────────────────
store: dict[str, Any] = {
    "all_alerts": [],          # all scored alerts, newest-first
    "live_alerts": [],         # alerts surfaced during the current replay
    "replay_running": False,
    "replay_scenario": None,
    "replay_thread": None,
    "features_15m": None,      # pd.DataFrame
    "user_bl": {},
    "peer_bl": {},
    "model": None,
    "scaler": None,
    "evaluation": {},
    "feedback": {},            # alert_id → {verdict, ts}
    "entity_timelines": defaultdict(list),
}


def load_artifacts():
    """Load all precomputed artefacts from data/."""
    alerts_path = os.path.join(DATA_PATH, "alerts.json")
    if os.path.exists(alerts_path):
        with open(alerts_path) as f:
            store["all_alerts"] = json.load(f)
        print(f"[startup] Loaded {len(store['all_alerts'])} alerts")

    feat_path = os.path.join(DATA_PATH, "features_15m.csv")
    if os.path.exists(feat_path):
        store["features_15m"] = pd.read_csv(feat_path)
        print(f"[startup] Loaded feature set ({len(store['features_15m'])} rows)")

    for name, key in [("baselines_user.json", "user_bl"), ("baselines_peer.json", "peer_bl")]:
        p = os.path.join(DATA_PATH, name)
        if os.path.exists(p):
            with open(p) as f:
                store[key] = json.load(f)

    for name, key in [(MODEL_PATH, "model"), (SCALER_PATH, "scaler")]:
        p = os.path.join(BASE_DIR, name)
        if os.path.exists(p):
            store[key] = joblib.load(p)
            print(f"[startup] Loaded {key}")

    eval_path = os.path.join(DATA_PATH, "evaluation.json")
    if os.path.exists(eval_path):
        with open(eval_path) as f:
            store["evaluation"] = json.load(f)

    # Build entity timelines from features
    _build_entity_timelines()


def _build_entity_timelines():
    df = store["features_15m"]
    if df is None:
        return
    for uid, udf in df.groupby("user_id"):
        udf = udf.sort_values("window")
        store["entity_timelines"][uid] = [
            {
                "window": str(row["window"]),
                "out_bytes": float(row.get("out_bytes", 0)),
                "in_bytes":  float(row.get("in_bytes", 0)),
                "out_mb":    round(float(row.get("out_bytes", 0)) / 1e6, 3),
                "in_mb":     round(float(row.get("in_bytes", 0)) / 1e6, 3),
                "conn_count": int(row.get("conn_count", 0)),
                "primary_sni": str(row.get("primary_sni", "")),
                "primary_category": str(row.get("dest_category", "unknown")),
                "has_exfil": int(row.get("has_exfil", 0)),
                "scenario": str(row.get("scenarios", "")),
            }
            for _, row in udf.iterrows()
        ]


@app.on_event("startup")
def startup_event():
    load_artifacts()


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "alerts_loaded": len(store["all_alerts"]),
        "model_loaded": store["model"] is not None,
        "replay_running": store["replay_running"],
        "payload_bytes_inspected": 0,
        "note": "CipherSentinel uses metadata only; zero payload bytes are read.",
    }


# ── Replay ────────────────────────────────────────────────────────────────────
SCENARIO_USERS: dict[str, str] = {
    "S1": "U-000",
    "S2": "U-008",
    "S3": "U-019",
    "S4": "U-009",
    "S5": "U-024",
    "S6": "U-002",
    "ALL": "",
}

def _replay_worker(scenario: str):
    """Background thread: trickle alerts into live_alerts."""
    store["live_alerts"] = []
    all_a = store["all_alerts"]

    if scenario == "ALL":
        candidates = all_a
    else:
        # filter by scenario tag
        candidates = [
            a for a in all_a
            if scenario in str(a.get("scenario", ""))
            or a["entity"] == SCENARIO_USERS.get(scenario, "")
        ]

    # sort chronologically for replay
    candidates = sorted(candidates, key=lambda a: a.get("window", ""))

    for alert in candidates:
        if not store["replay_running"]:
            break
        store["live_alerts"].append(alert)
        time.sleep(REPLAY_INTERVAL_SEC)

    store["replay_running"] = False


@app.post("/api/replay/start")
def replay_start(scenario: str = Query(default="ALL")):
    if store["replay_running"]:
        store["replay_running"] = False
        if store["replay_thread"]:
            store["replay_thread"].join(timeout=2)

    store["replay_running"] = True
    store["replay_scenario"] = scenario
    t = threading.Thread(target=_replay_worker, args=(scenario,), daemon=True)
    store["replay_thread"] = t
    t.start()
    return {"status": "started", "scenario": scenario}


@app.post("/api/replay/stop")
def replay_stop():
    store["replay_running"] = False
    return {"status": "stopped"}


# ── Alerts ────────────────────────────────────────────────────────────────────
@app.get("/api/alerts")
def get_alerts(
    since: str | None = None,
    live: bool = False,
    limit: int = 100,
):
    alerts = store["live_alerts"] if live else store["all_alerts"]
    if since:
        alerts = [a for a in alerts if str(a.get("window", "")) > since]
    return {"alerts": alerts[:limit], "total": len(alerts)}


@app.get("/api/alerts/{alert_id}")
def get_alert(alert_id: str):
    for a in store["all_alerts"]:
        if a["id"] == alert_id:
            return a
    raise HTTPException(status_code=404, detail="Alert not found")


# ── Feedback ──────────────────────────────────────────────────────────────────
class FeedbackBody(BaseModel):
    verdict: str    # "true_positive" | "false_positive"
    notes: str = ""


@app.post("/api/alerts/{alert_id}/feedback")
def post_feedback(alert_id: str, body: FeedbackBody):
    store["feedback"][alert_id] = {
        "verdict": body.verdict,
        "notes": body.notes,
        "ts": datetime.utcnow().isoformat(),
    }
    return {"status": "recorded", "alert_id": alert_id}


# ── Entity timeline ───────────────────────────────────────────────────────────
@app.get("/api/entities/{entity_id}/timeline")
def entity_timeline(entity_id: str, days: int = 30):
    tl = store["entity_timelines"].get(entity_id, [])
    if not tl:
        raise HTTPException(status_code=404, detail="Entity not found")

    # compute per-user baseline from the first 14 days as reference
    out_vals = [p["out_bytes"] for p in tl]
    baseline_med = float(pd.Series(out_vals[:int(len(out_vals) * 0.5)]).median()) if out_vals else 0

    return {
        "entity": entity_id,
        "timeline": tl[-days * 96:],   # ≈ 96 × 15-min windows per day
        "baseline_out_bytes": baseline_med,
    }


# ── Compare ───────────────────────────────────────────────────────────────────
@app.get("/api/compare")
def compare(scenario: str | None = None):
    if not store["evaluation"]:
        raise HTTPException(status_code=503, detail="Evaluation not yet computed")
    return store["evaluation"]


# ── Entities list ─────────────────────────────────────────────────────────────
@app.get("/api/entities")
def list_entities():
    df = store["features_15m"]
    if df is None:
        return {"entities": []}
    summary = []
    for uid, udf in df.groupby("user_id"):
        role = udf["role"].iloc[0] if "role" in udf.columns else "unknown"
        total_out = float(udf["out_bytes"].sum())
        n_alerts  = sum(1 for a in store["all_alerts"] if a["entity"] == uid)
        max_risk  = max((a["risk"] for a in store["all_alerts"] if a["entity"] == uid), default=0)
        summary.append({
            "entity": uid,
            "role": role,
            "total_out_gb": round(total_out / 1e9, 3),
            "alert_count": n_alerts,
            "max_risk": max_risk,
        })
    summary.sort(key=lambda x: x["max_risk"], reverse=True)
    return {"entities": summary}


# ── Scenarios ─────────────────────────────────────────────────────────────────
@app.get("/api/scenarios")
def list_scenarios():
    return {
        "scenarios": [
            {"id": "S1", "name": "Legitimate heavy uploader (engineer)", "expected": "No alert"},
            {"id": "S2", "name": "Single 400 MB upload at 02:00",        "expected": "High alert"},
            {"id": "S3", "name": "Low-and-slow: 40 MB/day for 10 days",  "expected": "Alert mid-period"},
            {"id": "S4", "name": "Finance + sync tool + new destination", "expected": "Review/High"},
            {"id": "S5", "name": "Departing employee ramp",               "expected": "Alert before final days"},
            {"id": "S6", "name": "New laptop cloud sync (hard negative)",  "expected": "At most Review"},
            {"id": "ALL","name": "Full 30-day stream",                    "expected": "All scenarios"},
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
