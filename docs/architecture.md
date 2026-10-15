# Architecture

CipherSentinel is a network metadata anomaly detector for insider exfiltration (MITRE T1567).

## Pipeline

```
Zeek logs / synthetic flows
         ↓
   generate.py          – 30 users × 5 roles × 30 days + 6 labelled scenarios
         ↓
   features.py          – 15-min entity windows, novelty flags, cumulative bytes
         ↓
   baseline.py          – per-user median/MAD + peer-group baselines → JSON
         ↓
   train.py             – IsolationForest on normalised features → model.joblib
         ↓
   score.py             – 5 signals fused 0–100 → alerts.json
         ↓
   evaluate.py          – 4-method comparison → evaluation.json
         ↓
   api/main.py          – FastAPI serving alerts, timelines, replay, compare
         ↓
   web/                 – React dashboard (Vite, Recharts, TanStack Query)
```

## Signal weights

| Signal | Weight | Rationale |
|--------|--------|-----------|
| Self-baseline deviation | 30 | Most direct: is this user acting unusually? |
| Destination policy | 25 | Rule-based: unsanctioned = high risk |
| Isolation Forest | 20 | Statistical novelty across feature space |
| Peer-group deviation | 15 | Role context: finance ≠ engineer |
| Slow-leak accumulator | 10 | Catches cumulative low-rate theft |

## Entity window features

| Feature | Exfiltration pattern |
|---------|---------------------|
| `out_bytes`, `in_bytes` | Large uploads |
| `out_in_ratio` | Upload-heavy vs normal download-heavy |
| `conn_count` | Burst/scripted transfers |
| `max_duration` | Long single uploads / tunnels |
| `hour_of_week` | Off-hours relative to user's own pattern |
| `new_dest_user` | New channels |
| `new_dest_org` | Rare services never seen in org |
| `dest_category` | Sanctioned vs personal storage vs anonymiser |
| `ja4_sync_present` | Sync-tool fingerprint replacing browser |
| `cum_out_7d` | 7-day rolling bytes to unsanctioned dest |

## Deployment notes (Render free tier)

- Service sleeps after inactivity; ping `/health` before the demo
- Disk is ephemeral; ship data/ artefacts baked into the image or regenerate at startup
- Pin scikit-learn version: `scikit-learn==1.4.2`
- CORS origin in environment variable `CORS_ORIGINS`
- Frontend: `VITE_API_URL` env var points to Render URL
