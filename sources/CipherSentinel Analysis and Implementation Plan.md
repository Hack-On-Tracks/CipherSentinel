# CipherSentinel: Analysis and Implementation Plan

Oct 15, 2026 · @Malavya Mankar

## Verdict on the attached research

The research has a sound skeleton (metadata features, Isolation Forest, per-device baselines, explainable alerts), but five of its recommendations would cost hours without helping you win, and its evaluation plan is circular unless you change it. This document keeps what holds and replaces what does not.

| Research recommendation | Assessment | Change in this plan |
| --- | --- | --- |
| Isolation Forest as the core detector | Useful as one signal, weak alone. It scores a flow as rare across everyone, not rare for this person, so a legitimate build server looks anomalous. | Run it on features already normalised against each user's own baseline and peer group, not on raw byte counts. |
| AbuseIPDB / URLhaus enrichment | Poor fit for the core threat. Insiders send data to Google Drive, Dropbox, Mega or personal mail, which have clean reputations. Reputation answers "is this server malicious", not "is this transfer unauthorised". | Replace with a local destination-category list keyed on the TLS server name (SNI). External APIs become optional. |
| RL response agent | The learned policy only reproduces the reward numbers you typed in. If a judge asks where the −8 came from, there is no defensible answer. | Cut. Use a cost-based alert threshold plus analyst-feedback re-ranking. |
| Zeek in the deployed stack | Render's native Python runtime does not ship Zeek, and live capture needs a mirror port you will not have at a hackathon. | Run Zeek offline on PCAPs, commit the logs, and have the backend replay them. |
| Postgres/Supabase from the start | Adds credentials and failure points the MVP does not need. | In-memory data and JSON first; add Supabase only to persist analyst feedback. |
| Synthetic-scenario evaluation | Circular when the same people write the generator and the features: you measure whether the detector finds what you planted. | Hold out whole scenario families and report across several generator seeds (section 7). |

What holds up: framing the threat as MITRE ATT&CK T1567 (exfiltration over web service), the discipline of never claiming to read encrypted content, and the three-way comparison of threshold, baseline and multi-signal detection.

## Problem understanding

The task is to flag insiders who move sensitive data out of an organisation using only what encryption leaves visible: who talked to whom, when, how much, and with what client software.

**Threat model.** An insider is an authorised user on a legitimate device, so perimeter tools and signatures see nothing wrong. The likely channels are personal cloud storage, file-transfer sites, webmail and tunnels, all over HTTPS (MITRE T1567). We assume a network sensor only: no endpoint agent and no TLS interception.

**What encryption still reveals**

| Signal | Visible when | What it tells you | Blind when |
| --- | --- | --- | --- |
| Bytes and packets per direction | Always | Upload-heavy asymmetry | Traffic is hidden inside a VPN tunnel |
| Timing, duration, gaps between connections | Always | Off-hours use, beaconing, long uploads | Never fully blind |
| Destination IP and port | Always | First contact with a new destination | Shared CDN addresses blur identity |
| Server name (SNI) | TLS handshake without ECH | Names the service, such as a file-sharing site | Encrypted Client Hello; QUIC/HTTP3 is harder to parse |
| Client fingerprint (JA3/JA4) | TLS handshake | Unusual client software, such as a sync tool instead of a browser | Fingerprints change with client updates; JA4 reduces but does not remove this |
| Certificate fields | TLS 1.2 only | Little in practice | Encrypted in TLS 1.3 |

**Why it is hard**

- No real labelled exfiltration data exists, and malicious insiders are rare, so supervised learning has little to learn from.
- Legitimate heavy uploaders (engineers, video editors) look like thieves to any volume rule.
- Low-and-slow theft keeps every single day under any fixed threshold.
- An IP address is not a person: DHCP and NAT must be resolved before a per-user baseline means anything.
- Every false alert costs analyst time, so explainability is part of the requirement, not decoration.

**The honest ceiling.** Metadata can show that an upload was unusual and unsanctioned. It cannot show that the file was confidential. The pitch should say "high-risk transfer", never "leak detected".

**What judges will probably test** (my expectation; the problem statement does not say): that nothing is decrypted, that a legitimate heavy uploader is not flagged, that alerts explain themselves, and that a live demo works.

## Proposed solution

CipherSentinel scores each user and time window for exfiltration risk from TLS flow metadata, then explains the score as evidence an analyst can verify in under a minute.

**Pipeline**

1. Ingest Zeek `conn.log` and `ssl.log` records (or flow CSVs) into one normalised flow schema.
2. Resolve identity: map source IP to a pseudonymous user and role through an asset table, then aggregate flows into 15-minute and 24-hour entity windows.
3. Compute features per window (table below).
4. Run five independent signals: self-baseline deviation, peer-group deviation, Isolation Forest, destination policy, and slow-leak accumulation.
5. Fuse the signals into a 0 to 100 risk score with fixed, documented weights.
6. Generate an evidence card: each contributing signal with its numbers, the destination, and a recommended human action.
7. Recommend only. The system never blocks traffic or disables accounts.

**Features per entity window**

| Feature | Definition | Exfiltration pattern it targets |
| --- | --- | --- |
| `out_bytes`, `in_bytes` | Sum of bytes sent and received | Large uploads |
| `out_in_ratio` | out\_bytes / (in\_bytes + 1) | Upload-heavy sessions; normal browsing is download-heavy |
| `conn_count` | Connections in the window | Bursts and scripted transfers |
| `max_duration` | Longest connection in seconds | Long single uploads and tunnels |
| `hour_of_week` | Hour bucket, 168 values | Off-hours activity relative to the user's own pattern |
| `new_dest_user` | First time this user contacts this SNI or IP | New channels |
| `new_dest_org` | First time anyone in the organisation does | Rare services |
| `dest_category` | Sanctioned, personal storage, file transfer, anonymiser, unknown | Policy violation |
| `ja4_rare` | Client fingerprint rare for this user | Command-line sync tools replacing browsers |
| `cum_out_7d` | Rolling 7-day bytes to one unsanctioned destination | Low-and-slow theft |

**Self-baseline deviation.** Each user gets a robust z-score against their own history, using the median and median absolute deviation (MAD) so that past spikes do not inflate the baseline:

```latex
z = \frac{x - \operatorname{median}(X)}{1.4826\,\operatorname{MAD}(X) + \epsilon}
```

Here x is the current window's outbound bytes and X is the user's history for the same hour-of-week bucket. Use an exponentially weighted average if you see drift. This is a deviation measure, not a probability of guilt.

**Peer-group deviation.** The same score computed against the user's role cohort. It is what lets an engineer's 2 GB build upload pass while the same upload from a finance user does not.

**Isolation Forest.** Train on benign history only, using the normalised features above (z-scores, ratios, novelty flags). Drop raw IPs and user IDs so the model learns behaviour, not identities. Keep it as one signal among five, because it is the least explainable of them.

**Slow-leak accumulator.** A CUSUM or rolling sum of outbound bytes to one unsanctioned destination across days. It is the signal that catches 40 MB a day for ten days.

**Fusion.** Starting weights, fixed in `config.py` and tested for sensitivity rather than tuned on test scenarios:

| Signal | Starting weight (of 100) |
| --- | --- |
| Self-baseline deviation | 30 |
| Destination policy | 25 |
| Isolation Forest | 20 |
| Peer-group deviation | 15 |
| Slow-leak accumulation | 10 |

Severity bands: 0–39 info, 40–69 review, 70–100 high. The score is a ranking aid, not a calibrated probability.

## USP

CipherSentinel judges a transfer as unusual for this person, to a place their role does not use, and building up over time, which a size threshold cannot do, and it shows the evidence instead of a bare score.

| Capability | Fixed volume threshold | Plain Isolation Forest on raw flows | CipherSentinel |
| --- | --- | --- | --- |
| Works without decrypting traffic | Yes | Yes | Yes |
| Lets a build server upload 2 GB without alerting | No | Unreliable | Yes, via self and peer baselines |
| Catches 40 MB a day for ten days | No | No | Yes, via slow-leak accumulation |
| Names the destination service | No | No | Yes, via SNI category list |
| Explains why an alert fired | Only "over limit" | No | Yes, per-signal evidence card |
| States what it cannot see | No | No | Yes, limits panel (ECH, QUIC, VPN) |

The four claims to put on the slide:

1. **Relative, not absolute.** Risk is measured against the user's own history and role peers, so legitimate heavy uploaders are not punished.
2. **Catches slow theft.** Cumulative evidence across days finds leaks that no single window reveals.
3. **Evidence, not a number.** Every alert carries the destination, the deviation in plain units, and a suggested human action.
4. **Proven head-to-head.** The demo runs one event stream through a threshold and through CipherSentinel and shows the difference, including where CipherSentinel fails.

Privacy by design is a supporting point: no payload is read, user IDs are pseudonymous by default, and nothing is blocked automatically. Do not claim reinforcement learning, deep learning or "adaptive AI" as a headline; the evidence for those in this build is thin and judges can probe it.

## Tech stack

Use React on Vercel for the frontend and a Python FastAPI service on Render for the backend. Python is needed only because scikit-learn lives there; everything the user sees stays JavaScript.

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React + Vite, Tailwind, Recharts, TanStack Query | A pure single-page app is simpler than Next.js; choose Next.js only if you want server rendering. |
| Frontend hosting | Vercel, GitHub auto-deploy | API address in an environment variable (`VITE_API_URL`). |
| Backend | FastAPI + Uvicorn on Render (Python web service) | Loads the model once at startup; automatic OpenAPI docs help the team agree on the contract. |
| ML and stats | pandas, numpy, scikit-learn, joblib | Isolation Forest, median/MAD, rolling statistics. |
| Traffic extraction | Zeek, run locally and offline | Produces `conn.log` and `ssl.log`; outputs are committed as sampled files. |
| Data at runtime | Parquet or CSV plus precomputed JSON, held in memory | No database for the MVP. |
| Persistence (optional) | Supabase free tier | Only for analyst feedback that should survive restarts. |
| Live feel in the UI | Polling every 2 seconds, upgrade to Server-Sent Events if time allows | Polling cannot fail in surprising ways. |

**Deployment constraints to plan around** (verify current Render terms before the event)

- Render's free web services sleep after a period of inactivity and take up to about a minute to wake. Ping `/health` just before you present, or pay for a small always-on instance for the weekend.
- Free instances have limited memory. Ship a sampled dataset under about 50 MB, not full CIC-IDS2017.
- The disk is ephemeral. Never store anything you need to keep on it.
- Enable CORS in FastAPI for your Vercel origin, read from an environment variable, not hard-coded.
- Pin the scikit-learn version in `requirements.txt` and train with the same version you serve, or the saved model may fail to load.
- Keep secrets in environment variables, never in the repository.
- Keep a local fallback: the full demo should run from two terminals on a laptop, and you should record a backup video.

**If the team refuses Python:** precompute all scores offline and serve them as JSON from a Node/Express service. You lose live inference, so say so on the slide rather than implying it.

## Implementation plan

The plan assumes about 24 hours and four people, as in your research; compress roles if the team is smaller. The main change from the research: the frontend starts at hour 2 against mock alert JSON, not at hour 8, and both deployments go live empty in the first two hours.

**Repository layout**

```text
ciphersentinel/
  data/          sampled Zeek logs and generated flows (under 50 MB)
  ml/
    generate.py  synthetic users, roles, benign traffic, injected scenarios
    features.py  flows -> entity-window features
    baseline.py  median/MAD, EWMA, role cohorts
    train.py     fits Isolation Forest, writes model.joblib
    score.py     five signals + fusion -> alerts with evidence
    evaluate.py  threshold vs baseline vs full system, metrics
  api/
    main.py      FastAPI app
    config.py    weights, thresholds, destination categories
  web/           React app (Vite)
  docs/          architecture, evaluation, limitations
```

**API contract** (freeze at hour 2)

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Warm-up ping and status |
| `POST /api/replay/start?scenario=` | Starts replaying a scenario's event stream |
| `GET /api/alerts?since=` | Alerts raised so far, newest first |
| `GET /api/alerts/{id}` | Full evidence card |
| `GET /api/entities/{id}/timeline` | Actual vs baseline series for charts |
| `GET /api/compare?scenario=` | Threshold vs CipherSentinel metrics |
| `POST /api/alerts/{id}/feedback` | Analyst marks true or false positive |

Alert shape, which the frontend builds against from hour 2:

```json
{
  "id": "a_0142",
  "entity": "U-017",
  "role": "finance",
  "window": "2026-03-12T02:00/02:15",
  "risk": 87,
  "severity": "high",
  "signals": [
    {"name": "self_deviation", "points": 28, "detail": "412 MB out vs median 3 MB (z = 61)"},
    {"name": "destination_policy", "points": 25, "detail": "first contact, category personal_file_sharing"}
  ],
  "destination": {"sni": "mega.nz", "first_seen_for_user": true},
  "recommended_action": "Confirm with the user's manager before any restriction"
}
```

**Data plan.** Build a generator for 30 pseudonymous users across five roles over 30 days, with lognormal byte volumes, role-specific working hours and a destination mix per role. Label every injected event. Track A (hours 2 to 6) is fully synthetic Zeek-style records and is the part you must finish. Track B is optional: use benign-labelled flows from CIC-IDS2017 as real per-host baseline history and inject exfiltration into later days. Use the labelled-flows CSV variant that includes IP addresses and timestamps, and check that this matches the files you download.

**Scenario families (all labelled)**

| ID | Scenario | Correct outcome |
| --- | --- | --- |
| S1 | Legitimate heavy uploader (engineer pushing builds) | No alert; negative control |
| S2 | Single 400 MB upload to personal storage at 02:00 | High alert |
| S3 | Low-and-slow: 40 MB a day for ten days to one destination | Alert by the middle of the period |
| S4 | Finance user starts using a sync-tool fingerprint to a new destination during working hours | Review or high alert |
| S5 | Departing-employee ramp: rising volume and new destinations over two weeks | Alert before the final days |
| S6 | Hard negative: new laptop doing a 3 GB first-day cloud sync | At most review severity |

Choose weights and thresholds using S1 to S4. Report S5 and S6 as held out.

**Schedule**

| Hours | Goal | Owner | Exit gate |
| --- | --- | --- | --- |
| 0–2 | Freeze schema, API contract and scenarios; create repo; deploy empty apps | All | Vercel and Render both serve a hello-world and the frontend calls the backend |
| 2–6 | Generator and features; frontend skeleton on mock JSON | ML/data, Frontend | Dataset with 30 users, 30 days, six labelled scenarios; alert list renders from mock |
| 6–10 | Baselines, Isolation Forest, destination policy, accumulator, fusion; threshold baseline | ML, Security | Alerts with evidence for every scenario, saved as JSON |
| 8–14 | FastAPI endpoints, replay engine, evidence card, entity timeline chart | Backend, Frontend | Replay runs end to end on the deployed apps |
| 14–18 | `evaluate.py`, compare page, limits panel | ML, Frontend | One command reproduces the results table |
| 18–21 | Hardening: cold start, missing data, wrong-input handling, copy review; freeze features at hour 21 | All | Demo survives a cold start and a refresh mid-replay |
| 21–24 | Polish, rehearse twice, record backup video, write README and limitations | All | Submitted build, video and slides agree with each other |

**If you fall behind, cut in this order:** Server-Sent Events (keep polling), the optional real-data track, peer cohorts, analyst feedback, then the accumulator chart. Never cut the self-baseline, the destination policy, the evidence card or the comparison page; those are the product.

## Evaluation, demo and risks

The evaluation must be able to show CipherSentinel losing; a result that cannot fail will not persuade a sceptical judge. Compare four methods on identical event streams.

| Method | Description | Hypothesis to test |
| --- | --- | --- |
| A | Fixed outbound threshold, such as 100 MB per window | Raises a false alert on S1 and misses S3 |
| B | Isolation Forest on raw flow features | Raises a false alert on S1 and gives no usable explanation |
| C | Self and peer baselines only | Handles S1 but is weaker on S3 and S4 |
| D | Full fusion | Best balance across all six scenarios |

- **Metrics:** precision, recall and F1 per scenario; false alerts per user per week; days until first alert for S3 and S5.
- **Protocol:** choose thresholds on S1 to S4, report S5 and S6 untouched, and repeat across five generator seeds, reporting mean and spread.
- **What would change my mind:** if method C matches D, drop the fusion complexity and say so. If D loses to A on any scenario, report it.
- **Caveat to state on the slide:** all attacks are synthetic and written by the team, so results show the method is coherent, not that it works on real networks.

**Demo script (about four minutes)**

1. State the problem in one sentence; show the banner "payload bytes inspected: 0".
2. Replay a normal day. The dashboard stays quiet even though the build server uploads 2 GB; open its timeline to show why.
3. Start S2. An alert appears within seconds; open the evidence card and read two signals aloud.
4. Show S3. The threshold misses it; CipherSentinel alerts partway through, with the cumulative chart.
5. Open the compare page with the A, B, C, D table.
6. Close on the limits panel: what the system cannot see and what it recommends only.

**Risks**

| Risk | Mitigation |
| --- | --- |
| Render cold start freezes the demo | Ping `/health` five minutes before; run locally as a fallback; keep a recorded video |
| Judges dismiss synthetic data | Say so first, explain the held-out design, and use the real-baseline track if time allows |
| Scope creep into RL, deep learning or threat-intel APIs | Treat them as roadmap items; the cut order above is binding |
| Saved model fails to load on Render | Pin scikit-learn and Python versions; test the deployed load at hour 8 |
| ECH and QUIC hide server names in real networks | State it in the limits panel; the system falls back to IP novelty, volume and timing |
| Employee-monitoring and privacy concerns | Metadata only, pseudonymous IDs, recommend-only actions; check the organiser's and local rules before using real data |

**Likely judge questions**

- **How do you know it works on real traffic?** We do not yet. The evaluation uses injected scenarios; the next step is a pilot on an organisation's own flow logs.
- **Why not decrypt?** The problem forbids it, and decryption adds privacy, legal and pinning problems that metadata analysis avoids.
- **Can an attacker evade this?** Yes: by throttling below the baseline, using a sanctioned service, or tunnelling through approved tools. The accumulator raises the cost of evasion; it does not remove it.
- **Why no deep learning?** There are no real labelled exfiltration examples to train on, and interpretable signals can be defended line by line. Online autoencoders such as Kitsune are the roadmap item.

**Sources.** The references below come from your attached research. I did not re-open them while writing this, so confirm details such as dataset file formats and Render's current free-tier limits before relying on them: [MITRE ATT&CK T1567](https://attack.mitre.org/techniques/T1567/), [Zeek logs](https://docs.zeek.org/en/current/logs/), [CIC-IDS2017](https://www.unb.ca/cic/datasets/ids-2017.html), [CERT insider threat dataset](https://www.sei.cmu.edu/library/insider-threat-test-dataset/), [Kitsune](https://github.com/ymirsky/Kitsune-py), [JA4+](https://github.com/FoxIO-LLC/ja4).
