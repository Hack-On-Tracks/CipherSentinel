"""CipherSentinel metadata-only demo API and polling replay engine."""
from __future__ import annotations

import json
import os
import sys
import threading
import time
import ast
import base64
import secrets
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "ml"))
from api.config import REPLAY_INTERVAL_SEC  # noqa: E402
from ml.generate import SCENARIO_USERS  # noqa: E402

_data_dir_setting = Path(os.getenv("CIPHERSENTINEL_DATA_DIR", "data"))
DATA_DIR = (_data_dir_setting if _data_dir_setting.is_absolute() else BASE_DIR / _data_dir_setting).resolve()
MODEL_PATH = Path(os.getenv("CIPHERSENTINEL_MODEL_PATH", str(DATA_DIR / "model.joblib"))).expanduser().resolve()
SCALER_PATH = Path(os.getenv("CIPHERSENTINEL_SCALER_PATH", str(DATA_DIR / "scaler.joblib"))).expanduser().resolve()
CERT_INVENTORY_PATH = BASE_DIR / "certlab" / "inventory.json"
SCENARIOS = [
    {"id": "S1", "name": "Legitimate heavy uploader (engineer)", "expected": "No alert"},
    {"id": "S2", "name": "Single 400 MB upload at 02:00", "expected": "High alert"},
    {"id": "S3", "name": "Low-and-slow: 40 MB/day for 10 days", "expected": "Alert mid-period"},
    {"id": "S4", "name": "Finance + sync tool + new destination", "expected": "Review/High"},
    {"id": "S5", "name": "Departing employee ramp", "expected": "Alert before final days"},
    {"id": "S6", "name": "New laptop cloud sync (hard negative)", "expected": "At most Review"},
    {"id": "ALL", "name": "Full 30-day stream", "expected": "All scenarios"},
]

state: dict[str, Any] = {
    "all_alerts": [], "live_alerts": [], "replay_running": False,
    "replay_scenario": None, "replay_thread": None, "replay_stop": None,
    "features": None, "timelines": {}, "user_bl": {}, "peer_bl": {},
    "model": None, "scaler": None, "evaluation": {}, "feedback": {},
    "transfer_sessions": {}, "transfers": [], "transfer_files": {},
    "load_error": None,
}
lock = threading.RLock()

app = FastAPI(title="CipherSentinel API", version="1.1.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "").split(",") if x.strip()] or [
    "http://localhost:5173", "http://localhost:3000"
]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"])


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open(encoding="utf-8") as f:
        return json.load(f)




def load_artifacts() -> None:
    """Load prepared demo artifacts once; never generate or train on startup."""
    try:
        required = [DATA_DIR / "alerts.json", DATA_DIR / "features_15m.csv",
                    DATA_DIR / "baselines_user.json", DATA_DIR / "baselines_peer.json",
                    MODEL_PATH, SCALER_PATH]
        missing = [str(path) for path in required if not path.is_file()]
        if missing:
            raise FileNotFoundError(
                "Missing prepared artifacts: " + ", ".join(missing)
                + ". Run the appropriate data pipeline from the repository root to prepare them."
            )
        alerts = _read_json(DATA_DIR / "alerts.json", [])
        if not isinstance(alerts, list) or any(not isinstance(item, dict) or not isinstance(item.get("id"), str) for item in alerts):
            raise ValueError("data/alerts.json must contain alert objects with string IDs")
        features_path = DATA_DIR / "features_15m.csv"
        features = pd.read_csv(features_path)
        user_bl = _read_json(DATA_DIR / "baselines_user.json", {})
        peer_bl = _read_json(DATA_DIR / "baselines_peer.json", {})
        evaluation = _read_json(DATA_DIR / "evaluation.json", {})
        model_path, scaler_path = MODEL_PATH, SCALER_PATH
        model = joblib.load(model_path) if model_path.exists() else None
        scaler = joblib.load(scaler_path) if scaler_path.exists() else None
        timelines: dict[str, list[dict[str, Any]]] = {}
        if features is not None and "user_id" in features:
            for uid, group in features.groupby("user_id"):
                points = []
                for row in group.sort_values("window").to_dict(orient="records"):
                    out_bytes, in_bytes = float(row.get("out_bytes", 0) or 0), float(row.get("in_bytes", 0) or 0)
                    points.append({
                        "window": str(row.get("window", "")), "out_bytes": out_bytes, "in_bytes": in_bytes,
                        "out_mb": round(out_bytes / 1e6, 3), "in_mb": round(in_bytes / 1e6, 3),
                        "conn_count": int(row.get("conn_count", 0) or 0), "primary_sni": str(row.get("primary_sni", "")),
                        "primary_category": str(row.get("primary_category", row.get("dest_category", "unknown"))),
                        "has_exfil": int(row.get("has_exfil", 0) or 0), "scenario": str(row.get("scenarios", "")),
                        "cum_out_7d": float(row.get("cum_out_7d", 0) or 0),
                    })
                timelines[str(uid)] = points
        with lock:
            state.update(all_alerts=alerts, features=features, user_bl=user_bl, peer_bl=peer_bl,
                         evaluation=evaluation, model=model, scaler=scaler, timelines=timelines, load_error=None)
    except Exception as exc:
        with lock:
            state["load_error"] = f"{type(exc).__name__}: {exc}"


@app.on_event("startup")
def startup_event() -> None:
    load_artifacts()


@app.on_event("shutdown")
def shutdown_event() -> None:
    with lock:
        stop = state.get("replay_stop")
        thread = state.get("replay_thread")
        if stop:
            stop.set()
    if thread and thread.is_alive():
        thread.join(timeout=2)


def _require_loaded() -> None:
    if state["load_error"]:
        raise HTTPException(503, state["load_error"])
    # Empty alerts are a valid loaded dataset. Startup may still be in progress.
    if not state["all_alerts"] and not state["timelines"] and state["features"] is None:
        raise HTTPException(503, "Demo data is still loading")


@app.get("/health")
def health():
    with lock:
        return {"status": "ok" if not state["load_error"] else "degraded", "alerts_loaded": len(state["all_alerts"]),
                "data_ready": state["features"] is not None or bool(state["all_alerts"]),
                "model_loaded": state["model"] is not None, "replay_running": state["replay_running"],
                "payload_bytes_inspected": 0, "note": "CipherSentinel uses metadata only; zero payload bytes are read."}




def _scenario_matches(alert: dict[str, Any], scenario: str) -> bool:
    tags = alert.get("scenario", [])
    if isinstance(tags, str):
        tags = [tags]
    return scenario in tags or alert.get("entity") == SCENARIO_USERS.get(scenario)


def _replay_worker(scenario: str, stop: threading.Event) -> None:
    with lock:
        alerts = list(state["all_alerts"])
    candidates = alerts if scenario == "ALL" else [a for a in alerts if _scenario_matches(a, scenario)]
    candidates.sort(key=lambda a: str(a.get("window", "")))
    for alert in candidates:
        if stop.wait(max(0.05, float(REPLAY_INTERVAL_SEC))):
            break
        with lock:
            if state["replay_stop"] is not stop:
                break
            state["live_alerts"].insert(0, alert)
    with lock:
        if state["replay_stop"] is stop:
            state["replay_running"] = False
            state["replay_thread"] = None
            state["replay_stop"] = None


@app.post("/api/replay/start")
def replay_start(scenario: str = Query(default="ALL", pattern="^(S[1-6]|ALL)$")):
    with lock:
        previous_stop, previous_thread = state["replay_stop"], state["replay_thread"]
        if previous_stop:
            previous_stop.set()
        if previous_thread and previous_thread.is_alive():
            previous_thread.join(timeout=2)
        stop = threading.Event()
        state.update(live_alerts=[], replay_running=True, replay_scenario=scenario, replay_stop=stop)
        thread = threading.Thread(target=_replay_worker, args=(scenario, stop), daemon=True, name=f"replay-{scenario}")
        state["replay_thread"] = thread
        thread.start()
    return {"status": "started", "scenario": scenario}


@app.post("/api/replay/stop")
def replay_stop():
    with lock:
        stop, thread = state["replay_stop"], state["replay_thread"]
        if stop:
            stop.set()
        state["replay_running"] = False
    if thread and thread.is_alive():
        thread.join(timeout=2)
    return {"status": "stopped"}


def _valid_since(value: str | None) -> str | None:
    if value is None:
        return None
    try:
        # Accept ISO-8601 and the dataset's legacy `YYYY-mm-dd HH:MM:SS` format.
        return datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat()
    except (ValueError, TypeError):
        raise HTTPException(400, "since must be an ISO-8601 timestamp")


@app.get("/api/alerts")
def get_alerts(since: str | None = None, live: bool = False, limit: int = Query(default=100, ge=1, le=500)):
    _require_loaded()
    cutoff = _valid_since(since)
    with lock:
        alerts = list(state["live_alerts"] if live else state["all_alerts"])
    alerts.sort(key=lambda a: str(a.get("window", "")), reverse=True)
    if cutoff:
        # Windows in source files have no timezone and are still lexically comparable after normalization.
        cutoff = cutoff.replace("T", " ")[:19]
        alerts = [a for a in alerts if str(a.get("window", "")).replace("T", " ")[:19] > cutoff]
    return {"alerts": alerts[:limit], "total": len(alerts)}


@app.get("/api/alerts/{alert_id}")
def get_alert(alert_id: str):
    _require_loaded()
    with lock:
        alert = next((a for a in state["all_alerts"] if a["id"] == alert_id), None)
    if alert is None:
        raise HTTPException(404, "Alert not found")
    return alert


class FeedbackBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    verdict: str = Field(pattern="^(true_positive|false_positive)$")
    notes: str = Field(default="", max_length=2000)


class DeviceLoginBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    device_id: str
    pin: str = Field(min_length=4, max_length=32)


class TransferBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    to_device_id: str
    filename: str = Field(min_length=1, max_length=180)
    content_type: str = Field(default="application/octet-stream", max_length=120)
    content_base64: str = Field(max_length=7_000_000)


def _device_inventory() -> tuple[dict[str, Any], dict[str, Any]]:
    inventory = _read_json(CERT_INVENTORY_PATH, {})
    devices = {item.get("device_id"): item for item in inventory.get("devices", []) if isinstance(item, dict)}
    return inventory, devices


def _transfer_identity(authorization: str | None) -> tuple[str, dict[str, Any] | None]:
    token = authorization.removeprefix("Bearer ") if authorization else ""
    with lock:
        identity = state["transfer_sessions"].get(token)
    if not identity:
        raise HTTPException(401, "Sign in with an enrolled device to continue")
    if identity.get("role") == "admin":
        return token, identity
    _, devices = _device_inventory()
    device = devices.get(identity.get("device_id"))
    if not device or device.get("lifecycle_status") != "active" or device.get("enrollment_status") != "enrolled":
        raise HTTPException(403, "This device is not currently enrolled and active")
    return token, identity


@app.post("/api/transfers/login")
def transfer_login(body: DeviceLoginBody):
    demo_pin = os.getenv("CIPHERSENTINEL_DEMO_PIN", "246810")
    if body.device_id == "ADMIN":
        if not secrets.compare_digest(body.pin, os.getenv("CIPHERSENTINEL_ADMIN_PIN", demo_pin)):
            raise HTTPException(401, "Incorrect admin PIN")
        identity = {"role": "admin", "device_id": "ADMIN"}
    else:
        if not secrets.compare_digest(body.pin, demo_pin):
            raise HTTPException(401, "Incorrect demo PIN")
        _, devices = _device_inventory()
        device = devices.get(body.device_id)
        if not device or device.get("enrollment_status") != "enrolled" or device.get("lifecycle_status") != "active":
            raise HTTPException(403, "Choose an active enrolled device")
        identity = {"role": "device", "device_id": body.device_id}
    token = secrets.token_urlsafe(32)
    with lock:
        state["transfer_sessions"][token] = identity
    return {"token": token, **identity}


@app.get("/api/transfers/session")
def transfer_session(authorization: str | None = Header(default=None)):
    _, identity = _transfer_identity(authorization)
    return identity


@app.post("/api/transfers/logout")
def transfer_logout(authorization: str | None = Header(default=None)):
    token = authorization.removeprefix("Bearer ") if authorization else ""
    with lock:
        state["transfer_sessions"].pop(token, None)
    return {"status": "signed_out"}


@app.post("/api/transfers")
def create_transfer(body: TransferBody, authorization: str | None = Header(default=None)):
    _, identity = _transfer_identity(authorization)
    if identity["role"] != "device":
        raise HTTPException(403, "Admin sessions cannot send files")
    _, devices = _device_inventory()
    sender = devices[identity["device_id"]]
    recipient = devices.get(body.to_device_id)
    if not recipient or recipient.get("enrollment_status") != "enrolled" or recipient.get("lifecycle_status") != "active":
        raise HTTPException(400, "Recipient must be an active enrolled device")
    try:
        raw = base64.b64decode(body.content_base64, validate=True)
    except (ValueError, base64.binascii.Error) as exc:
        raise HTTPException(400, "File data is invalid") from exc
    if not raw or len(raw) > 5 * 1024 * 1024:
        raise HTTPException(413, "Choose a non-empty file up to 5 MB")
    name = Path(body.filename).name
    suspicious = Path(name).suffix.lower() in {".exe", ".dll", ".bat", ".cmd", ".ps1", ".sh", ".js", ".vbs"}
    cross_org = sender.get("organization_id") != recipient.get("organization_id")
    blocked = cross_org or suspicious
    transfer_id = secrets.token_hex(8)
    event = {
        "id": transfer_id, "timestamp": datetime.now(timezone.utc).isoformat(),
        "from_device_id": sender["device_id"], "from_org": sender["organization_id"],
        "to_device_id": recipient["device_id"], "to_org": recipient["organization_id"],
        "filename": name, "size_bytes": len(raw), "content_type": body.content_type,
        "status": "blocked" if blocked else "delivered",
        "reason": "Cross-organization transfer is not trusted" if cross_org else ("File type flagged by demo policy" if suspicious else None),
        "classification": "malicious_activity" if blocked else "allowed",
    }
    with lock:
        state["transfers"].insert(0, event)
        if not blocked:
            state["transfer_files"][transfer_id] = {"filename": name, "content_type": body.content_type, "data": raw, "to_device_id": recipient["device_id"]}
    return event


@app.get("/api/transfers")
def list_transfers(authorization: str | None = Header(default=None)):
    _, identity = _transfer_identity(authorization)
    with lock:
        events = list(state["transfers"])
    if identity["role"] == "device":
        events = [event for event in events if event["from_device_id"] == identity["device_id"] or event["to_device_id"] == identity["device_id"]]
    return {"transfers": events}


@app.get("/api/transfers/inbox")
def transfer_inbox(authorization: str | None = Header(default=None)):
    _, identity = _transfer_identity(authorization)
    if identity["role"] != "device":
        raise HTTPException(403, "Sign in as a device to view its inbox")
    with lock:
        items = [event for event in state["transfers"] if event["to_device_id"] == identity["device_id"] and event["status"] == "delivered"]
    return {"transfers": items}


@app.get("/api/transfers/{transfer_id}/download")
def download_transfer(transfer_id: str, authorization: str | None = Header(default=None)):
    from fastapi.responses import Response
    _, identity = _transfer_identity(authorization)
    with lock:
        item = state["transfer_files"].get(transfer_id)
    if not item or (identity["role"] != "admin" and identity["device_id"] != item["to_device_id"]):
        raise HTTPException(404, "Delivered file not found")
    safe_name = item["filename"].replace('"', "")
    return Response(item["data"], media_type=item["content_type"], headers={"Content-Disposition": f'attachment; filename="{safe_name}"'})


@app.post("/api/alerts/{alert_id}/feedback")
def post_feedback(alert_id: str, body: FeedbackBody):
    _require_loaded()
    with lock:
        if not any(a["id"] == alert_id for a in state["all_alerts"]):
            raise HTTPException(404, "Alert not found")
        state["feedback"][alert_id] = {"verdict": body.verdict, "notes": body.notes, "ts": datetime.now(timezone.utc).isoformat()}
        result = dict(state["feedback"][alert_id])
    return {"status": "recorded", "alert_id": alert_id, **result}


@app.get("/api/entities/{entity_id}/timeline")
def entity_timeline(entity_id: str, days: int = Query(default=30, ge=1, le=365)):
    _require_loaded()
    with lock:
        timeline = list(state["timelines"].get(entity_id, []))
    if not timeline:
        raise HTTPException(404, "Entity not found")
    baseline_samples = [p["out_bytes"] for p in timeline[:max(1, len(timeline) // 2)]]
    baseline = float(pd.Series(baseline_samples).median()) if baseline_samples else 0.0
    result = timeline[-days * 96:]
    return {"entity": entity_id, "timeline": [{**p, "baseline_out_bytes": baseline} for p in result], "baseline_out_bytes": baseline}


@app.post("/api/scenarios/{scenario_id}/replay")
def scenario_replay(scenario_id: str):
    """Return the deterministic, precomputed scenario event sequence and alerts."""
    _require_loaded()
    if scenario_id not in SCENARIO_USERS:
        raise HTTPException(404, "Unknown scenario. Choose S1 through S6.")
    entity_id = SCENARIO_USERS[scenario_id]
    role = "unknown"
    events: list[dict[str, Any]] = []
    for point in state["timelines"].get(entity_id, []):
        raw = point.get("scenario", "")
        try:
            tags = ast.literal_eval(raw) if isinstance(raw, str) and raw.startswith("[") else ([raw] if raw else [])
        except (ValueError, SyntaxError):
            tags = [raw]
        if scenario_id not in tags:
            continue
        event_minute = str(point["window"]).replace("T", " ")[:16]
        matching_alerts = [a for a in state["all_alerts"] if a.get("entity") == entity_id
                           and str(a.get("window", "")).replace("T", " ")[:16] == event_minute]
        event = {**point, "scenario_id": scenario_id, "alerts": matching_alerts}
        events.append(event)
    feature_df = state["features"]
    if feature_df is not None and "role" in feature_df and not feature_df[feature_df.user_id == entity_id].empty:
        role = str(feature_df.loc[feature_df.user_id == entity_id, "role"].iloc[0])
    events.sort(key=lambda item: item["window"])
    return {"scenario": scenario_id, "entity": entity_id, "role": role,
            "events": events, "event_count": len(events),
            "alert_count": sum(len(event["alerts"]) for event in events),
            "source": "precomputed backend feature windows and scored alert artifacts"}


@app.get("/api/compare")
def compare(scenario: str | None = Query(default=None, pattern="^(S[1-6]|ALL)$")):
    _require_loaded()
    with lock:
        evaluation = state["evaluation"]
    if not evaluation:
        raise HTTPException(503, "Evaluation not yet computed")
    return evaluation


@app.get("/api/entities")
def list_entities():
    _require_loaded()
    df = state["features"]
    if df is None:
        return {"entities": []}
    summaries = []
    for uid, group in df.groupby("user_id"):
        alerts = [a for a in state["all_alerts"] if a.get("entity") == uid]
        summaries.append({"entity": uid, "role": str(group["role"].iloc[0]) if "role" in group else "unknown",
                          "total_out_gb": round(float(group["out_bytes"].sum()) / 1e9, 3),
                          "alert_count": len(alerts), "max_risk": max((a.get("risk", 0) for a in alerts), default=0)})
    summaries.sort(key=lambda x: x["max_risk"], reverse=True)
    return {"entities": summaries}


@app.get("/api/certificates/devices")
def list_certificate_devices():
    """Expose public certificate inventory metadata; never serve key material."""
    try:
        inventory = _read_json(CERT_INVENTORY_PATH, {})
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(503, "Certificate inventory is unavailable") from exc
    if not isinstance(inventory, dict) or not isinstance(inventory.get("devices"), list):
        raise HTTPException(503, "Certificate inventory is not configured")
    public_fields = (
        "device_id", "organization_id", "asset_label", "hostname", "os",
        "certificate_serial", "certificate_sha256", "issuing_ca", "issuing_ca_sha256",
        "not_before", "not_after", "enrollment_status", "lifecycle_status",
    )
    devices = [{key: item.get(key) for key in public_fields} for item in inventory["devices"] if isinstance(item, dict)]
    organizations = [
        {"id": item.get("id"), "name": item.get("name"), "ca_id": item.get("ca_id"), "status": item.get("status")}
        for item in inventory.get("organizations", []) if isinstance(item, dict)
    ]
    return {"organizations": organizations, "devices": devices}


@app.get("/api/scenarios")
def list_scenarios():
    return {"scenarios": SCENARIOS}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
