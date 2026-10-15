# CipherSentinel: Real Network Data Ingestion & Evaluation Guide

This guide describes how to ingest, normalize, train, and evaluate CipherSentinel on **real, metadata-only network traffic** (Zeek logs or flow CSVs).

---

## 1. Ethical & Privacy Principles

CipherSentinel operates under strict metadata-only constraints (MITRE ATT&CK T1567):
- **Zero Payload Inspection:** Only connection metadata is read (`ts`, `orig_bytes`, `resp_bytes`, `duration`, `src_ip`, destination `sni`, and `ja4` TLS fingerprint). No application payloads, packet contents, or credentials are ever accessed, inspected, or stored.
- **No Live Sniffing or Unauthorized Capture:** CipherSentinel does not capture live interface traffic or scrape data. It processes user-supplied offline log files.
- **Privacy by Design:** User and host identities are pseudonymous (`U-IP-xxxx` or mapped organizational IDs).

---

## 2. Generating Zeek Logs from a PCAP Offline

To generate metadata logs from a local, authorized packet capture (`.pcap`), use Zeek offline:

```bash
# 1. Standard Zeek TSV logs:
zeek -C -r capture.pcap Log::default_logdir=zeek_logs/

# 2. Or Zeek JSON-lines format:
zeek -C -r capture.pcap LogAscii::use_json=T Log::default_logdir=zeek_logs/
```

This generates `conn.log` (flow metrics) and `ssl.log` (TLS handshake SNI and fingerprints).

---

## 3. Supported Real Data Formats

### A. Zeek `conn.log` + `ssl.log` (TSV or JSON)
CipherSentinel joins `conn.log` and `ssl.log` on the Zeek connection UID (`uid`).

| Canonical Flow Field | Zeek `conn.log` Source | Zeek `ssl.log` Source | Missing / Fallback Value |
|---|---|---|---|
| `ts` | `ts` (epoch float or ISO) | — | Current UTC time |
| `src_ip` | `id.orig_h` | — | `0.0.0.0` |
| `out_bytes` | `orig_bytes` (or `orig_ip_bytes`) | — | `0` |
| `in_bytes` | `resp_bytes` (or `resp_ip_bytes`) | — | `0` |
| `duration` | `duration` (seconds) | — | `0.0` |
| `sni` | — | `server_name` | `"unknown"` |
| `ja4` | — | `ja4` (or `ja3`) | `"unknown"` |

### B. Flow CSV Fallback (NetFlow / IPFIX / Benchmark CSVs)
For flow exports (e.g. CIC-IDS2017, Stratosphere IPS CTU-13, or NetFlow CSVs), CipherSentinel automatically normalizes column names:
- Timestamps: `Timestamp`, `ts`, `StartTime`, `time`
- Source IP: `Src IP`, `Source IP`, `src_ip`, `id.orig_h`
- Bytes: `TotLen Fwd Pkts` / `out_bytes`, `TotLen Bwd Pkts` / `in_bytes`
- Duration: `Flow Duration` (auto-converts microseconds if >100,000) or `duration`
- Destination/SNI: `Destination Host`, `server_name`, `sni`, `Host`

---

## 4. Identity Mapping & Safe Pseudonymization

An IP address is not a person (DHCP, NAT, and shared subnets blur identity).

To provide known entity and department context, supply an identity map CSV or JSON:

```csv
# identity_map.csv
ip,user_id,role
10.1.0.5,U-012,finance
10.1.0.8,U-003,engineer
```

**If no identity map is provided:**
CipherSentinel computes a deterministic, non-reversible SHA-256 pseudonym for each IP (`U-IP-` + 6 hex chars, e.g. `U-IP-8daaf6`) and assigns the role cohort to `"unassigned"`.

---

## 5. Public Benchmark Datasets

Recommended publicly licensed datasets for metadata exfiltration benchmarking:
1. **Stratosphere IPS CTU-13 Dataset (CC BY-SA 4.0):**
   - Contains captured malware and exfiltration PCAPs alongside benign background traffic.
   - Download PCAP or pre-generated Zeek logs from [Stratosphere IPS](https://www.stratosphereips.org/datasets-ctu13).
2. **CIC-IDS2017 (UNB Open License):**
   - Contains labelled benign traffic and web attack/data theft flows.
   - Use the `GeneratedLabelledFlows` CSV files.

### UWF-ZeekData24 exfiltration benchmark

The repository includes `ml/run_uwf_exfil_benchmark.py` for the publicly hosted UWF-ZeekData24 CSV subset. It uses the benign connection records and the separate `Exfiltration` (T1048) records, creates a chronological train/test split within benign data, and holds every labeled exfiltration record out of training. The dataset is Zeek-derived cyber-range traffic, not production enterprise telemetry. Its public CSV subset contains only 23 exfiltration records, has no SNI/JA4 values in these tables, and should be treated as a small benchmark rather than a performance guarantee.

The dataset page states that the data are shared under CC BY. Cite UWF-ZeekData24 as described on the [UWF dataset page](https://datasets.uwf.edu/) and in the [dataset paper](https://doi.org/10.3390/data10050059). The source CSVs should be kept under the ignored `data/external/` directory. Download the public files with:

```bash
mkdir -p data/external/uwf_zeekdata24
curl -L --fail -o data/external/uwf_zeekdata24/benign.csv \
  https://datasets.uwf.edu/data/UWF-ZeekData24/csv/Benign/part-00000-b039213f-1208-4f1b-b71d-5e8e3a4a2939-c000.csv
curl -L --fail -o data/external/uwf_zeekdata24/exfiltration.csv \
  https://datasets.uwf.edu/data/UWF-ZeekData24/csv/Exfiltration/part-00000-6a530c25-0f6b-46a1-ba16-c6b658ef75e8-c000.csv
```

Then run the benchmark:

```bash
.venv/bin/python ml/run_uwf_exfil_benchmark.py
```

Outputs are written to the ignored `data/benchmark/uwf_zeekdata24/` directory. The manifest records the source, split cutoff, row counts, and limits. The scorer and evaluator use the preassigned test windows only; the raw Isolation Forest comparison is fitted on the training windows rather than the test set.

To view the held-out benchmark alerts in the local dashboard without replacing the default demo artifacts, start the backend with the benchmark artifact directory:

```bash
CIPHERSENTINEL_DATA_DIR=data/benchmark/uwf_zeekdata24 .venv/bin/uvicorn api.main:app --reload
```

Then start the frontend as usual. Without this environment variable, the API continues to load the default `data/` artifacts.

*Policy notice: Do not commit large (>50 MB) raw datasets or sensitive enterprise PCAPs to this repository.*

---

## 6. End-to-End Terminal Workflow

### A. Ingesting Real Zeek Logs
```bash
python ml/ingest.py \
  --conn-log path/to/conn.log \
  --ssl-log path/to/ssl.log \
  --identity-map path/to/identity_map.csv \
  --labels path/to/labels.csv \
  --out-dir data/real \
  --dataset-id "corp_pilot_2026" \
  --license "Authorized Enterprise Audit"
```

### B. One-Shot Real Pipeline Execution
```bash
# Labeled real data with 70/30 chronological train/test split:
python run_pipeline.py --mode real \
  --conn-log path/to/conn.log \
  --ssl-log path/to/ssl.log \
  --identity-map path/to/identity_map.csv \
  --labels path/to/labels.csv \
  --out-dir data/real \
  --train-split 0.7

# Unlabeled real data (operational telemetry mode):
python run_pipeline.py --mode real \
  --conn-log path/to/conn.log \
  --ssl-log path/to/ssl.log \
  --out-dir data/real \
  --train-split 0.7 \
  --assume-benign-history
```

### C. Generic Flow CSV Ingestion
```bash
python run_pipeline.py --mode csv \
  --flow-csv path/to/flows.csv \
  --out-dir data/real \
  --train-split 0.7 \
  --assume-benign-history
```

### D. Default Synthetic Demo Workflow (Unaffected)
```bash
python run_pipeline.py --mode synthetic --seed 42
```

---

## 7. Preventing Data Leakage

To ensure scientific validity and prevent circular tuning:
1. **Chronological Splitting:**
   The training period (`--train-split 0.7` or `--train-until <ISO-timestamp>`) is strictly separated from the test evaluation period.
2. **Benign-Only Fitting:**
   Per-user baselines, peer baselines, and the Isolation Forest are fitted **only** on benign flows within the training period.
3. **Unseen Evaluation:**
   Test-period data is never exposed during feature scaling or model training.

---

## 8. Interpreting Evaluation Outputs

`data/real/evaluation.json` reflects the ground-truth availability:

- **When Ground-Truth Labels Exist (`evaluation_status: "evaluated"`):**
  - Precision, Recall, F1 Score
  - PR-AUC (Average Precision)
  - Confusion Matrix `[[TN, FP], [FN, TP]]`
  - False alerts per user per week
  - Time-to-first-alert for slow-leak exfiltration
  - 4-way method comparison:
    - **Method A:** Fixed volume threshold (100 MB)
    - **Method B:** Raw Isolation Forest (unnormalized)
    - **Method C:** Self + peer baselines only
    - **Method D:** Full CipherSentinel 5-signal fusion

- **When Traffic is Unlabeled (`evaluation_status: "labels_unavailable"`):**
  - Supervised metrics (Precision/Recall/F1) are explicitly marked unavailable (not fabricated).
  - Operational SOC telemetry is reported: total evaluated entity-windows, alerts raised, severity breakdown (Review vs. High), and alert workload per entity-week.

---

## 9. Risk Scoring & The "Sixth Parameter"

### Canonical Five Signals (Fixed 100 Points):
1. **Isolation Forest (Weight: 40):** Primary unsupervised multivariate anomaly detector trained on 17 normalized window features.
2. **Self-Baseline Deviation (Weight: 20):** Robust z-score via median and MAD bucketed by hour-of-week.
3. **Destination Policy & Novelty (Weight: 15):** TLS SNI policy risk (personal storage, file transfer, anonymizer) + first-contact flag.
4. **Peer-Group Deviation (Weight: 15):** Cohort deviation against role peers (Engineering, Finance, HR, Sales).
5. **Slow-Leak Accumulator (Weight: 10):** Rolling 7-day outbound volume to unsanctioned destinations.

*Note on Risk Score:* The fused score (0–100) is an explainable risk ranking aid, **not a mathematical probability of guilt**.

### Clarification on "Six Parameters":
The repository defines:
- **5 weighted detection signals** (sum = 100)
- **4 priority-ordered synthetic demo scenarios** (S1 to S4); benchmark evaluation uses the dataset's held-out labels.
- **17 normalized feature columns** for Isolation Forest
- **4 synthetic demo scenarios**

If an organization wishes to integrate an optional 6th signal (e.g. device certificate trust posture from PKI, client process authenticity, or external threat indicator), configure `SIXTH_SIGNAL_CONFIG` in `api/config.py`. By default, it is inactive to preserve the canonical 100-point detection governance contract.
