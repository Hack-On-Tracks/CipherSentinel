# CipherSentinel

**Insider threat detection from TLS metadata — no payload inspection.**

MITRE ATT&CK T1567 · Hackathon Prototype

---

## Quick Start (local)

### 1. Backend + ML pipeline

```bash
# Install Python deps (Python 3.11+ recommended)
pip install -r requirements.txt

# Generate synthetic data, train model, score all windows
python run_pipeline.py

# Start the FastAPI server
cd api
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd web
npm install
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api` to `localhost:8000` automatically.

---

## Architecture

```
CipherSentinel/
├── ml/
│   ├── generate.py   # Synthetic users + 6 labelled scenarios
│   ├── features.py   # Flows → 15-min / 24-h entity windows
│   ├── baseline.py   # Median/MAD self + peer-group baselines
│   ├── train.py      # Isolation Forest on normalised features
│   ├── score.py      # Five-signal fusion → alerts.json
│   └── evaluate.py   # 4-method comparison (A/B/C/D)
├── api/
│   ├── main.py       # FastAPI with 7 endpoints + replay engine
│   └── config.py     # Weights, thresholds, destination categories
├── web/
│   └── src/
│       ├── pages/    # Dashboard, Alerts, Replay, Entities, Compare, Limits
│       └── components/ # AlertCard with evidence modal
└── data/             # Generated artefacts (not committed if large)
```

## Detection approach

| Signal | Weight |
|--------|--------|
| Self-baseline deviation (median/MAD z-score) | 30 |
| Destination policy (category + novelty) | 25 |
| Isolation Forest (on normalised features) | 20 |
| Peer-group deviation (role cohort) | 15 |
| Slow-leak accumulator (7-day rolling) | 10 |

Severity: **0–39 Info · 40–69 Review · 70–100 High**

## Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| S1 | Legitimate heavy uploader (engineer, 2 GB builds) | No alert |
| S2 | 400 MB midnight upload to mega.nz | High alert |
| S3 | 40 MB/day for 10 days to wetransfer.com | Alert mid-period |
| S4 | Finance user + sync-tool JA4 + anonymiser | Review/High |
| S5 | Departing employee ramp over 2 weeks | Alert before final days |
| S6 | New laptop 3 GB first-day cloud sync (hard negative) | At most Review |

## API contract

```
GET  /health
POST /api/replay/start?scenario=
GET  /api/alerts?since=&live=
GET  /api/alerts/{id}
GET  /api/entities/{id}/timeline
GET  /api/compare
POST /api/alerts/{id}/feedback
```

## Privacy by design

- Zero payload bytes are read or stored
- User IDs are pseudonymous (U-000 … U-029)
- Recommend-only: the system never blocks traffic or disables accounts
- Metadata only: bytes, timing, SNI, JA4 fingerprint

## Limitations

See the **Limits** page in the UI. Key blind spots: ECH/QUIC (hides SNI),
VPN tunnels, ultra-low-and-slow attacks below 5 MB/day, shared CDN IPs,
and synthetic-only evaluation.
