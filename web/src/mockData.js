// Mock data for offline / demo when the backend is not running

export const MOCK_ALERTS = [
  {
    id: "a_0142",
    entity: "U-008",
    role: "finance",
    window: "2026-03-12 02:00",
    risk: 87,
    severity: "high",
    out_mb: 400.0,
    signals: [
      { name: "self_deviation",     points: 28.0, label: "Self-Baseline", icon: "📊", detail: "400 MB out vs median 3.2 MB (z = 61.0)" },
      { name: "destination_policy", points: 25.0, label: "Dest Policy", icon: "🎯", detail: "mega.nz (personal file-sharing service; first contact for this user)" },
      { name: "isolation_forest",   points: 18.0, label: "Iso Forest", icon: "🌲", detail: "anomaly score 0.90 (0 = normal, 1 = anomalous)" },
      { name: "peer_deviation",     points: 11.0, label: "Peer Group", icon: "👥", detail: "z = 7.0 vs role cohort (finance)" },
      { name: "slow_leak",          points: 6.0,  label: "Slow-Leak", icon: "☁️", detail: "400 MB cumulative (7-day) to mega.nz" },
    ],
    destination: { sni: "mega.nz", category: "Personal Share", first_seen_for_user: true, first_seen_for_org: false },
    recommended_action: "Escalate to security team; confirm with the user's manager before any restriction.",
    scenario: ["S2"],
    has_exfil: 1,
  },
  {
    id: "a_0201",
    entity: "U-014",
    role: "hr",
    window: "2026-03-15 10:00",
    risk: 55,
    severity: "review",
    out_mb: 40.0,
    signals: [
      { name: "self_deviation",     points: 12.0, label: "Self-Baseline", icon: "📊", detail: "40.0 MB out vs median 1.2 MB (z = 8.5)" },
      { name: "destination_policy", points: 18.0, label: "Dest Policy", icon: "🎯", detail: "wetransfer.com file transfer" },
      { name: "isolation_forest",   points: 10.0, label: "Iso Forest", icon: "🌲", detail: "anomaly score 0.50" },
      { name: "peer_deviation",     points: 9.0,  label: "Peer Group", icon: "👥", detail: "z = 6.0 vs role cohort (hr)" },
      { name: "slow_leak",          points: 6.0,  label: "Slow-Leak", icon: "☁️", detail: "Cumulative anomalous transfer" },
    ],
    destination: { sni: "wetransfer.com", category: "File Transfer", first_seen_for_user: false },
    recommended_action: "Investigate further; check with the user whether transfer was authorised.",
    scenario: ["S3"],
    has_exfil: 1,
  },
  {
    id: "a_0315",
    entity: "U-009",
    role: "finance",
    window: "2026-03-22 14:15",
    risk: 74,
    severity: "high",
    out_mb: 250.0,
    signals: [
      { name: "self_deviation",     points: 20.0, label: "Self-Baseline", icon: "📊", detail: "250 MB out vs median 2.8 MB (z = 15.0)" },
      { name: "destination_policy", points: 22.0, label: "Dest Policy", icon: "🎯", detail: "drive.google.com unusual volume" },
      { name: "isolation_forest",   points: 15.0, label: "Iso Forest", icon: "🌲", detail: "anomaly score 0.70" },
      { name: "peer_deviation",     points: 10.0, label: "Peer Group", icon: "👥", detail: "z = 6.0 vs role cohort (finance)" },
      { name: "slow_leak",          points: 7.0,  label: "Slow-Leak", icon: "☁️", detail: "320 MB cumulative (7-day)" },
    ],
    destination: { sni: "drive.google.com", category: "Unusual Volume", first_seen_for_user: true, is_new_dest: true },
    recommended_action: "Escalate to security team; confirm with the user's manager before any restriction.",
    scenario: ["S4"],
    has_exfil: 1,
  },
  {
    id: "a_0422",
    entity: "U-021",
    role: "sales",
    window: "2026-03-25 18:30",
    risk: 68,
    severity: "review",
    out_mb: 500.0,
    signals: [
      { name: "self_deviation",     points: 18.0, label: "Self-Baseline", icon: "📊", detail: "500 MB out vs median 15 MB (z = 12.0)" },
      { name: "destination_policy", points: 20.0, label: "Dest Policy", icon: "🎯", detail: "mega.nz personal share" },
      { name: "isolation_forest",   points: 13.0, label: "Iso Forest", icon: "🌲", detail: "anomaly score 0.65" },
      { name: "peer_deviation",     points: 8.0,  label: "Peer Group", icon: "👥", detail: "z = 5.3 vs role cohort (sales)" },
      { name: "slow_leak",          points: 9.0,  label: "Slow-Leak", icon: "☁️", detail: "3.2 GB cumulative (7-day)" },
    ],
    destination: { sni: "mega.nz", category: "Personal Share", first_seen_for_user: false, first_seen_for_org: false },
    recommended_action: "Investigate further; check with the user whether transfer was authorised.",
    scenario: ["S5"],
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
    A_threshold:      { TP:2, FP:4, FN:3, TN:900, precision:0.333, recall:0.400, f1:0.364, days_to_first_S3: null, days_to_first_S5: 12, false_alerts_per_user_per_week: 0.44 },
    B_iso_raw:        { TP:3, FP:6, FN:2, TN:898, precision:0.333, recall:0.600, f1:0.429, days_to_first_S3: 20, days_to_first_S5: 8, false_alerts_per_user_per_week: 0.67 },
    C_baselines_only: { TP:4, FP:2, FN:1, TN:902, precision:0.667, recall:0.800, f1:0.727, days_to_first_S3: 10, days_to_first_S5: 5, false_alerts_per_user_per_week: 0.22 },
    D_full_fusion:    { TP:5, FP:1, FN:0, TN:903, precision:0.833, recall:1.000, f1:0.909, days_to_first_S3: 5,  days_to_first_S5: 3, false_alerts_per_user_per_week: 0.11 },
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
    { id: "S1",  name: "Legitimate heavy uploader (engineer)", expected: "No alert" },
    { id: "S2",  name: "Single 400 MB upload at 02:00",        expected: "High alert" },
    { id: "S3",  name: "Low-and-slow: 40 MB/day for 10 days",  expected: "Alert mid-period" },
    { id: "S4",  name: "Finance + sync tool + new destination", expected: "Review/High" },
    { id: "S5",  name: "Departing employee ramp",               expected: "Alert before final days" },
    { id: "S6",  name: "New laptop cloud sync (hard negative)",  expected: "At most Review" },
    { id: "ALL", name: "Full 30-day stream",                    expected: "All scenarios" },
  ],
}
