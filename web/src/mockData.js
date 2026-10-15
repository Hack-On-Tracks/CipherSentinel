// Mock data for offline / demo when the backend is not running

export const MOCK_ALERTS = [
  {
    id: "a_0142",
    entity: "U-008",
    role: "finance",
    window: "2026-03-12 02:00",
    risk: 80,
    severity: "high",
    out_mb: 400.0,
    signals: [
      { name: "self_deviation",     points: 18.0, label: "Self-Baseline", icon: "📊", detail: "400 MB out vs median 3.2 MB (z = 61.0)" },
      { name: "destination_policy", points: 12.0, label: "Dest Policy", icon: "🎯", detail: "mega.nz (personal file-sharing service; first contact for this user)" },
      { name: "isolation_forest",   points: 36.0, label: "Iso Forest", icon: "🌲", detail: "anomaly score 0.90 (0 = normal, 1 = anomalous)" },
      { name: "peer_deviation",     points: 8.0, label: "Peer Group", icon: "👥", detail: "z = 7.0 vs role cohort (finance)" },
      { name: "slow_leak",          points: 6.0,  label: "Slow-Leak", icon: "☁️", detail: "400 MB cumulative (7-day) to mega.nz" },
    ],
    destination: { sni: "mega.nz", category: "Personal Share", first_seen_for_user: true, first_seen_for_org: false },
    recommended_action: "Escalate to security team; confirm with the user's manager before any restriction.",
    scenario: ["S1"],
    has_exfil: 1,
  },
  {
    id: "a_0201",
    entity: "U-019",
    role: "hr",
    window: "2026-03-15 20:00",
    risk: 60,
    severity: "review",
    out_mb: 40.0,
    signals: [
      { name: "self_deviation",     points: 10.0, label: "Self-Baseline", icon: "📊", detail: "40.0 MB daily egress vs personal baseline" },
      { name: "destination_policy", points: 10.0, label: "Dest Policy", icon: "🎯", detail: "wetransfer.com repeated external transfer" },
      { name: "isolation_forest",   points: 24.0, label: "Iso Forest", icon: "🌲", detail: "anomaly score 0.50" },
      { name: "peer_deviation",     points: 8.0,  label: "Peer Group", icon: "👥", detail: "Compared with role cohort (hr)" },
      { name: "slow_leak",          points: 8.0,  label: "Slow-Leak", icon: "☁️", detail: "Cumulative anomalous transfer" },
    ],
    destination: { sni: "wetransfer.com", category: "File Transfer", first_seen_for_user: false },
    recommended_action: "Investigate further; check with the user whether transfer was authorised.",
    scenario: ["S2"],
    has_exfil: 1,
  },
  {
    id: "a_0315",
    entity: "U-009",
    role: "finance",
    window: "2026-03-22 14:15",
    risk: 72,
    severity: "high",
    out_mb: 120.0,
    signals: [
      { name: "self_deviation",     points: 12.0, label: "Self-Baseline", icon: "📊", detail: "120 MB repeated outbound deviation" },
      { name: "destination_policy", points: 12.0, label: "Dest Policy", icon: "🎯", detail: "filebin.net anonymising destination" },
      { name: "isolation_forest",   points: 34.0, label: "Iso Forest", icon: "🌲", detail: "anomaly score 0.85" },
      { name: "peer_deviation",     points: 8.0, label: "Peer Group", icon: "👥", detail: "Compared with finance cohort" },
      { name: "slow_leak",          points: 6.0,  label: "Slow-Leak", icon: "☁️", detail: "Cumulative transfer over seven days" },
    ],
    destination: { sni: "filebin.net", category: "Anonymising destination", first_seen_for_user: true, is_new_dest: true },
    recommended_action: "Escalate to security team; confirm with the user's manager before any restriction.",
    scenario: ["S3"],
    has_exfil: 1,
  },

]

export const MOCK_ENTITIES = [
  { entity: "U-008", role: "finance",  total_out_gb: 0.41, alert_count: 1, max_risk: 87 },
  { entity: "U-009", role: "finance",  total_out_gb: 0.32, alert_count: 1, max_risk: 74 },
  { entity: "U-021", role: "sales",    total_out_gb: 3.20, alert_count: 1, max_risk: 68 },
  { entity: "U-014", role: "hr",       total_out_gb: 0.40, alert_count: 1, max_risk: 55 },
  { entity: "U-000", role: "engineer", total_out_gb: 60.0, alert_count: 0, max_risk: 0  },
  { entity: "U-002", role: "engineer", total_out_gb: 3.00, alert_count: 0, max_risk: 15 },
]

export const MOCK_COMPARE = {
  generated_at: "2026-03-12T12:00:00",
  caveat: "All attacks are synthetic; results show coherence, not real-world performance.",
  methods: {
    A_threshold:      "Fixed 100 MB/window threshold",
    B_iso_raw:        "Isolation Forest on raw flow features, no baselines",
    C_baselines_only: "Self + peer baselines only",
    D_full_fusion:    "Full CipherSentinel: baselines + IF + policy + accumulator",
  },
  results: {
    A_threshold:      { TP:2, FP:4, FN:3, TN:900, precision:0.333, recall:0.400, f1:0.364, days_to_first_S2: null, days_to_first_S3: 12, false_alerts_per_user_per_week: 0.44 },
    B_iso_raw:        { TP:3, FP:6, FN:2, TN:898, precision:0.333, recall:0.600, f1:0.429, days_to_first_S2: 20, days_to_first_S3: 8, false_alerts_per_user_per_week: 0.67 },
    C_baselines_only: { TP:4, FP:2, FN:1, TN:902, precision:0.667, recall:0.800, f1:0.727, days_to_first_S2: 10, days_to_first_S3: 5, false_alerts_per_user_per_week: 0.22 },
    D_full_fusion:    { TP:5, FP:1, FN:0, TN:903, precision:0.833, recall:1.000, f1:0.909, days_to_first_S2: 5,  days_to_first_S3: 3, false_alerts_per_user_per_week: 0.11 },
  },
}

export const MOCK_HEALTH = {
  status: "ok",
  alerts_loaded: 4,
  model_loaded: true,
  replay_running: false,
  payload_bytes_inspected: 0,
  note: "CipherSentinel uses metadata only; zero payload bytes are read.",
}

export const MOCK_SCENARIOS = {
  scenarios: [
    { id: "S1", name: "Off-hours high-volume exfiltration", expected: "High-risk multivariate anomaly" },
    { id: "S2", name: "Low-and-slow cumulative leak", expected: "Review/high as behavior accumulates" },
    { id: "S3", name: "Rare tool and destination-port evasion", expected: "High-risk channel anomaly" },
    { id: "S4", name: "Legitimate engineering release", expected: "Review only; no high alert" },
    { id: "ALL", name: "Full 30-day stream", expected: "All scenarios" },
  ],
}
