# Architecture

CipherSentinel is a network metadata anomaly detector for insider exfiltration (MITRE T1567).

## Pipeline

```
Zeek logs / synthetic flows
         ↓
   generate.py          – 30 users × 5 roles × 30 days + 4 priority scenarios
         ↓
   features.py          – 15-min entity windows, novelty flags, cumulative bytes
         ↓
   baseline.py          – per-user median/MAD + peer-group baselines → JSON
         ↓
   train.py             – IsolationForest on 17 behaviour features → model.joblib
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
| Isolation Forest | 40 | Primary multivariate novelty signal over 17 behavior features |
| Self-baseline deviation | 20 | Most direct: is this user acting unusually? |
| Destination policy | 15 | Rule-based: unsanctioned = high risk |
| Peer-group deviation | 15 | Role context: finance ≠ engineer |
| Slow-leak accumulator | 10 | Catches cumulative low-rate theft |

Isolation Forest is the largest individual signal; the five weights still sum to 100.

## Priority scenarios

| Scenario | Pattern | Isolation Forest inputs highlighted |
|----------|---------|--------------------------------------|
| S1 | One off-hours 400 MB finance upload through a new destination, region, client, and port | `out_bytes_log`, `byte_asymmetry`, `out_z`, `peer_z`, destination novelty, `ja4_rare`, port novelty, and schedule deviation |
| S2 | 60 MB/day to one file-transfer destination for eight off-hours days | `cum_out_7d_mb_log`, `out_z`, `peer_z`, `active_hours_dev`, `conn_count_log`, and `category_risk` |
| S3 | Repeated moderate transfer through a rare JA4, new region, and port | JA4 rarity, region/destination novelty, destination-port novelty, risky category share, and byte volume |
| S4 | Repeated 3 GB sanctioned engineering releases during normal hours | Confirms volume against personal history, familiar destinations and ports, work hours, and peer context; reference replay stays below High severity |

The scenario cards and replay view list each selected input with its purpose. S4 is a hard-negative calibration case: review-level alerts can still occur under the heavier Isolation Forest weighting, while the reference seed produces no High alerts for it.

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

## Isolation Forest feature set

The model fits on 17 numeric, window-level behavior features: log outbound bytes, byte asymmetry, log 7-day outbound volume, user-baseline outbound z-score, peer-baseline outbound z-score, first-seen user and organization destinations, first-seen region/destination pair, log bytes sent to a new destination, rare JA4, off-hours flag, deviation from the user's previously observed activity hours, log connection count, log maximum duration, risky-category outbound-byte share, novel destination port, and risky destination-port share. User and peer baselines are built from the chronological training period; JA4, destination, activity-hour, and port novelty are causal flags.

The current UWF-ZeekData24 capture covers **2024-03-01 through 2024-11-05** (about eight months), but its benign training windows are concentrated from **2024-10-31 through 2024-11-04** (four days). The capture has destination ports but no geographic labels, SNI, or JA4. Geographic novelty therefore contributes zero on this corpus, and SNI/JA4 inputs are unknown; these columns become informative only with richer source telemetry. The capture contains 23 labeled exfiltration flows, so it is a useful project benchmark, not broad production validation. `model_info.json` records the trained feature list and actual training coverage.

## Deployment notes (Render free tier)

- Service sleeps after inactivity; ping `/health` before the demo
- Disk is ephemeral; ship data/ artefacts baked into the image or regenerate at startup
- Pin scikit-learn version: `scikit-learn==1.4.2`
- CORS origin in environment variable `CORS_ORIGINS`
- Frontend: `VITE_API_URL` env var points to Render URL
