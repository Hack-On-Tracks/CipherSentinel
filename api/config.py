"""Central, deliberately fixed detection policy for CipherSentinel."""
from __future__ import annotations

import json
from pathlib import Path

# These are governance-controlled, not optimisation parameters.
WEIGHTS = {
    "self_deviation": 20,
    "destination_policy": 15,
    "isolation_forest": 40,
    "peer_deviation": 15,
    "slow_leak": 10,
}
assert sum(WEIGHTS.values()) == 100

SEVERITY_HIGH = 70
SEVERITY_REVIEW = 40
SLOW_LEAK_CEILING_BYTES = 400_000_000
BASELINE_EPSILON = 1e-9

DEST_POLICY_WEIGHTS = {
    "anonymiser": 1.0,
    "personal_file_sharing": 0.8,
    "file_transfer": 0.6,
    "unknown": 0.4,
    "sanctioned": 0.0,
}
CATEGORY_LABELS = {
    "anonymiser": "anonymising service",
    "personal_file_sharing": "personal file-sharing service",
    "file_transfer": "public file-transfer site",
    "unknown": "unknown destination",
    "sanctioned": "sanctioned service",
}

_POLICY_PATH = Path(__file__).with_name("destination_policy.json")
with _POLICY_PATH.open(encoding="utf-8") as _f:
    DEST_CATEGORIES: dict[str, str] = json.load(_f)

# ── Optional Sixth Parameter / Extension Signal Hook ──────────────────────────
# The canonical CipherSentinel model defines five fixed signals totaling 100 points:
#   1. self_deviation (20)
#   2. destination_policy (15)
#   3. isolation_forest (40)
#   4. peer_deviation (15)
#   5. slow_leak (10)
# Note: The repository does not define a static "sixth parameter". If an organization
# configures an additional 6th signal (e.g. device certificate posture, off-hours multiplier),
# define it here with name, weight, and scoring handler.
SIXTH_SIGNAL_CONFIG: dict[str, Any] | None = None

REPLAY_INTERVAL_SEC = 0.5
DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]
DATA_DIR = "data"
MODEL_PATH = "data/model.joblib"
SCALER_PATH = "data/scaler.joblib"
