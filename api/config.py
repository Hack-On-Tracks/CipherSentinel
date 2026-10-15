"""
config.py  –  All tunable parameters for CipherSentinel.

Import this module wherever weights, thresholds or category lists are needed.
Change values here; never scatter magic numbers through the codebase.
"""

# ── Signal fusion weights (must sum to 100) ───────────────────────────────────
WEIGHTS = {
    "self_deviation":     30,
    "destination_policy": 25,
    "isolation_forest":   20,
    "peer_deviation":     15,
    "slow_leak":          10,
}

# ── Severity bands ────────────────────────────────────────────────────────────
SEVERITY_HIGH   = 70
SEVERITY_REVIEW = 40

# ── Method A fixed threshold (bytes per 15-min window) ───────────────────────
THRESHOLD_BYTES = 100 * 1_000_000   # 100 MB

# ── Slow-leak accumulation ceiling (bytes, 7-day) ────────────────────────────
SLOW_LEAK_CEILING_BYTES = 400 * 1_000_000   # 400 MB

# ── Destination categories ────────────────────────────────────────────────────
DEST_POLICY_WEIGHTS = {
    "anonymiser":            1.0,
    "personal_file_sharing": 0.8,
    "file_transfer":         0.6,
    "unknown":               0.4,
    "sanctioned":            0.0,
}

CATEGORY_LABELS = {
    "personal_file_sharing": "personal file-sharing service",
    "file_transfer":         "public file-transfer site",
    "anonymiser":            "anonymising service",
    "sanctioned":            "sanctioned service",
    "unknown":               "unknown destination",
}

# Master destination list (SNI → category)
DEST_CATEGORIES: dict[str, str] = {
    # sanctioned
    "github.com":               "sanctioned",
    "s3.amazonaws.com":         "sanctioned",
    "storage.googleapis.com":   "sanctioned",
    "drive.google.com":         "sanctioned",
    "npmjs.com":                "sanctioned",
    "onedrive.live.com":        "sanctioned",
    "sharepoint.com":           "sanctioned",
    "docusign.com":             "sanctioned",
    "bamboohr.com":             "sanctioned",
    "salesforce.com":           "sanctioned",
    "box.com":                  "sanctioned",
    "zoom.us":                  "sanctioned",
    # personal file sharing
    "dropbox.com":              "personal_file_sharing",
    "mega.nz":                  "personal_file_sharing",
    "icloud.com":               "personal_file_sharing",
    "wetransfer.com":           "file_transfer",
    "transfer.sh":              "file_transfer",
    # anonymisers
    "anonfiles.com":            "anonymiser",
    "protonmail.com":           "personal_mail",
    "gmail.com":                "personal_mail",
    # misc personal mail
    "yahoo.com":                "personal_mail",
}

# ── Replay chunk interval (seconds between emitted windows in live replay) ───
REPLAY_INTERVAL_SEC = 0.5

# ── CORS allowed origins (read from env in main.py) ──────────────────────────
DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]

# ── Data paths (relative to repo root, adjusted in main.py) ──────────────────
DATA_DIR   = "data"
MODEL_PATH = "data/model.joblib"
SCALER_PATH = "data/scaler.joblib"
