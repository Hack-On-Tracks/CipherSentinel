import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { replayScenario } from '../api.js'
import { AlertDetail } from '../components/AlertCard.jsx'

export const SCENARIOS = [
  {
    id: 'S4',
    title: 'Legitimate engineering release',
    expected: 'Expected: no alert',
    tone: 'green',
    dotColor: '#f59e0b',
    entity: 'U-000',
    role: 'engineer',
    desc: 'A large release artifact goes to a familiar sanctioned service during the engineer’s normal work schedule.',
    isoInputs: [
      ['out_bytes_log', 'Measures transfer size while evaluating the surrounding behavior.'],
      ['out_z + peer_z', 'Checks whether the volume is unusual for this engineer and engineering peers.'],
      ['new_dest_user + new_dest_org', 'Checks whether the destination is established.'],
      ['is_off_hours + active_hours_dev', 'Checks whether activity fits the normal schedule.'],
      ['novel_dst_port + category_risk', 'Checks whether the service port and destination category are expected.'],
    ],
    destination: 'github.com',
    category: 'Code Repository',
    events: [
      { window: '2026-10-15 09:15', out_bytes: 42_000_000, in_bytes: 8_500_000, conn_count: 24, cum_out_7d: 145_000_000, primary_sni: 'github.com', primary_category: 'Code Repository', alerts: [] },
      { window: '2026-10-15 11:30', out_bytes: 85_000_000, in_bytes: 14_200_000, conn_count: 42, cum_out_7d: 230_000_000, primary_sni: 'registry.npmjs.org', primary_category: 'Package Registry', alerts: [] },
      { window: '2026-10-15 14:00', out_bytes: 120_000_000, in_bytes: 22_000_000, conn_count: 56, cum_out_7d: 350_000_000, primary_sni: 'onedrive.live.com', primary_category: 'Cloud Storage (Sanctioned)', alerts: [] },
      { window: '2026-10-15 16:45', out_bytes: 65_000_000, in_bytes: 11_800_000, conn_count: 31, cum_out_7d: 415_000_000, primary_sni: 'github.com', primary_category: 'Code Repository', alerts: [] },
      { window: '2026-10-15 17:30', out_bytes: 38_000_000, in_bytes: 6_200_000, conn_count: 18, cum_out_7d: 453_000_000, primary_sni: 'slack.com', primary_category: 'Collaboration', alerts: [] },
    ],
  },
  {
    id: 'S1',
    title: 'Off-hours high-volume exfiltration',
    expected: 'Expected: high alert',
    tone: 'red',
    dotColor: '#ef4444',
    entity: 'U-008',
    role: 'finance',
    desc: 'A finance user sends a large upload to a new risky destination at 02:00 through an unusual port and rare client.',
    isoInputs: [
      ['out_bytes_log + byte_asymmetry', 'Detects large, upload-heavy traffic.'],
      ['out_z + peer_z', 'Compares the event with personal and peer behavior.'],
      ['new_dest_user + bytes_to_novel_dst_log', 'Tracks a first-seen destination and transfer volume to it.'],
      ['is_off_hours + active_hours_dev', 'Detects schedule deviation.'],
      ['novel_dst_port + ja4_rare', 'Detects an unusual service port and client fingerprint.'],
    ],
    destination: 'mega.nz',
    category: 'Personal File Sharing',
    events: [
      { window: '2026-10-15 01:15', out_bytes: 2_400_000, in_bytes: 4_100_000, conn_count: 6, cum_out_7d: 18_000_000, primary_sni: 'internal.corp.local', primary_category: 'Internal ERP', alerts: [] },
      { window: '2026-10-15 01:45', out_bytes: 3_100_000, in_bytes: 2_800_000, conn_count: 5, cum_out_7d: 21_100_000, primary_sni: 'internal.corp.local', primary_category: 'Internal ERP', alerts: [] },
      {
        window: '2026-10-15 02:00',
        out_bytes: 400_000_000,
        in_bytes: 1_200_000,
        conn_count: 14,
        cum_out_7d: 421_100_000,
        primary_sni: 'mega.nz',
        primary_category: 'Personal File Sharing',
        alerts: [{
          id: 'a_0142',
          entity: 'U-008',
          role: 'finance',
          window: '2026-10-15 02:00',
          risk: 81,
          severity: 'high',
          signals: [
            { name: 'self_deviation', points: 18, label: 'Self-baseline', detail: '400 MB out vs median 3.2 MB (z = 61.0)' },
            { name: 'destination_policy', points: 12, label: 'Destination policy', detail: 'mega.nz (personal file-sharing; first contact for user)' },
            { name: 'isolation_forest', points: 36, label: 'Isolation Forest', detail: 'anomaly score 0.90 (0 = normal, 1 = anomalous)' },
            { name: 'peer_deviation', points: 8, label: 'Peer-group baseline', detail: 'z = 7.0 vs role cohort (finance)' },
            { name: 'slow_leak', points: 7, label: 'Seven-day accumulator', detail: '421 MB cumulative (7-day) to untrusted share' },
          ],
          destination: { sni: 'mega.nz', category: 'Personal Share', first_seen_for_user: true },
          recommended_action: 'Escalate to security operations; verify transfer with user manager.'
        }]
      },
      { window: '2026-10-15 02:30', out_bytes: 1_500_000, in_bytes: 1_800_000, conn_count: 3, cum_out_7d: 422_600_000, primary_sni: 'internal.corp.local', primary_category: 'Internal ERP', alerts: [] },
    ],
  },
  {
    id: 'S2',
    title: 'Low-and-slow cumulative leak',
    expected: 'Expected: cumulative alert',
    tone: 'amber',
    dotColor: '#f59e0b',
    entity: 'U-019',
    role: 'hr',
    desc: 'An HR user sends modest repeated transfers to the same external service, including outside their normal activity hours.',
    isoInputs: [
      ['cum_out_7d_mb_log', 'Accumulates repeated transfers over a rolling week.'],
      ['out_z + peer_z', 'Compares each event with personal and role behavior.'],
      ['new_dest_user + category_risk', 'Adds destination familiarity and transfer-category context.'],
      ['active_hours_dev', 'Flags activity outside the user’s established hours.'],
      ['conn_count_log + byte_asymmetry', 'Describes connection cadence and upload direction.'],
    ],
    destination: 'wetransfer.com',
    category: 'File Transfer',
    events: [
      { window: '2026-10-12 20:00', out_bytes: 60_000_000, in_bytes: 1_100_000, conn_count: 8, cum_out_7d: 180_000_000, primary_sni: 'wetransfer.com', primary_category: 'File Transfer', alerts: [] },
      { window: '2026-10-13 20:00', out_bytes: 60_000_000, in_bytes: 1_200_000, conn_count: 8, cum_out_7d: 240_000_000, primary_sni: 'wetransfer.com', primary_category: 'File Transfer', alerts: [] },
      { window: '2026-10-14 20:00', out_bytes: 60_000_000, in_bytes: 1_050_000, conn_count: 9, cum_out_7d: 300_000_000, primary_sni: 'wetransfer.com', primary_category: 'File Transfer', alerts: [] },
      {
        window: '2026-10-15 20:00',
        out_bytes: 60_000_000,
        in_bytes: 1_300_000,
        conn_count: 9,
        cum_out_7d: 360_000_000,
        primary_sni: 'wetransfer.com',
        primary_category: 'File Transfer',
        alerts: [{
          id: 'a_0201',
          entity: 'U-019',
          role: 'hr',
          window: '2026-10-15 10:00',
          risk: 62,
          severity: 'review',
          signals: [
            { name: 'self_deviation', points: 12, label: 'Self-baseline', detail: '60 MB daily egress vs personal baseline' },
            { name: 'destination_policy', points: 12, label: 'Destination policy', detail: 'wetransfer.com repeated external transfer' },
            { name: 'isolation_forest', points: 24, label: 'Isolation Forest', detail: 'anomaly score 0.50' },
            { name: 'peer_deviation', points: 8, label: 'Peer-group baseline', detail: 'z = 6.0 vs role cohort (hr)' },
            { name: 'slow_leak', points: 6, label: 'Seven-day accumulator', detail: 'Cumulative anomalous transfer 360 MB' },
          ],
          destination: { sni: 'wetransfer.com', category: 'File Transfer', first_seen_for_user: false },
          recommended_action: 'Investigate further; verify whether transfer was authorized.'
        }]
      }
    ],
  },
  {
    id: 'S3',
    title: 'Rare tool and destination-port evasion',
    expected: 'Expected: review or high',
    tone: 'orange',
    dotColor: '#f59e0b',
    entity: 'U-009',
    role: 'finance',
    desc: 'A finance user repeatedly sends data through a rare client, new region, anonymising destination, and unfamiliar port.',
    isoInputs: [
      ['ja4_rare', 'Detects an uncommon TLS client fingerprint.'],
      ['novel_dst_port + risky_dst_port_share', 'Highlights a new or risky destination port.'],
      ['new_region_and_destination', 'Marks a first-seen destination in a new region.'],
      ['bytes_to_novel_dst_log + category_risk', 'Measures volume to the new channel and its category risk.'],
      ['out_z + peer_z', 'Adds personal and finance-cohort context.'],
    ],
    destination: 'anonfiles.com',
    category: 'Anonymous Upload',
    events: [
      { window: '2026-10-15 08:30', out_bytes: 12_000_000, in_bytes: 3_200_000, conn_count: 12, cum_out_7d: 45_000_000, primary_sni: 'drive.google.com', primary_category: 'Cloud Storage', alerts: [] },
      {
        window: '2026-10-15 14:15',
        out_bytes: 250_000_000,
        in_bytes: 4_800_000,
        conn_count: 28,
        cum_out_7d: 295_000_000,
        primary_sni: 'anonfiles.com',
        primary_category: 'Anonymous File Host',
        alerts: [{
          id: 'a_0315',
          entity: 'U-009',
          role: 'finance',
          window: '2026-10-15 14:15',
          risk: 72,
          severity: 'high',
          signals: [
            { name: 'self_deviation', points: 12, label: 'Self-baseline', detail: '120 MB repeated outbound deviation' },
            { name: 'destination_policy', points: 12, label: 'Destination policy', detail: 'filebin.net anonymising destination' },
            { name: 'isolation_forest', points: 34, label: 'Isolation Forest', detail: 'anomaly score 0.70' },
            { name: 'peer_deviation', points: 8, label: 'Peer-group baseline', detail: 'Compared with finance cohort' },
            { name: 'slow_leak', points: 6, label: 'Seven-day accumulator', detail: 'Cumulative transfer over seven days' },
          ],
          destination: { sni: 'anonfiles.com', category: 'Anonymous File Host', first_seen_for_user: true },
          recommended_action: 'Escalate immediately; inspect host sync tool.'
        }]
      }
    ],
  },

]

const SIGNALS = [
  ['self_deviation', 'Self-baseline', 20],
  ['destination_policy', 'Destination policy', 15],
  ['isolation_forest', 'Isolation Forest', 40],
  ['peer_deviation', 'Peer-group baseline', 15],
  ['slow_leak', 'Seven-day accumulator', 10],
]

function prettyBytes(value = 0) {
  const n = Number(value) || 0
  if (n === 0) return '0.0 MB'
  return n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e6).toFixed(1)} MB`
}

export default function ReplayPage() {
  const [selectedScenarioId, setSelectedScenarioId] = useState('S4')
  const [dropdownOpen, setDropdownOpen] = useState(true)
  const [result, setResult] = useState(null)
  const [index, setIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSignals, setShowSignals] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState(null)

  const dropdownRef = useRef(null)
  const lockRef = useRef(false)

  const activeScenarioDef = useMemo(() => {
    return SCENARIOS.find(s => s.id === selectedScenarioId) || SCENARIOS[0]
  }, [selectedScenarioId])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const current = result?.events?.[index] || null
  const currentAlert = current?.alerts?.[0] || null
  const nextScoredEvent = result?.events?.slice(index + 1).find(event => event.alerts?.length) || null
  const previousScoredEvent = index > 0 ? result?.events?.slice(0, index).filter(event => event.alerts?.length).at(-1) : null
  const replayComplete = Boolean(result && index >= result.events.length - 1 && !playing)
  const replayHasAlerts = Boolean(result?.events?.some(event => event.alerts?.length))
  const isOverFileSizeThreshold = Number(current?.out_bytes || 0) > 40_000_000

  const chartData = useMemo(() => {
    if (!result?.events?.length || index < 0) return []
    return result.events.slice(0, index + 1).map((event, i) => ({
      window: event.window?.replace('T', ' ').slice(5, 16) || `${i + 1}`,
      outbound: Number(event.out_bytes || 0) / 1e6,
      cumulative: Number(event.cum_out_7d || 0) / 1e6,
    }))
  }, [result, index])

  useEffect(() => {
    if (!playing || !result) return undefined
    if (index + 1 >= result.events.length) {
      setPlaying(false)
      return undefined
    }
    const delay = isOverFileSizeThreshold ? 1250 : 1050 / speed
    const timer = window.setTimeout(() => setIndex(v => v + 1), delay)
    return () => window.clearTimeout(timer)
  }, [playing, result, index, speed, isOverFileSizeThreshold])

  const run = async (scenarioId = selectedScenarioId) => {
    if (lockRef.current) return
    lockRef.current = true
    setLoading(true)
    setError('')
    setPlaying(false)
    setIndex(-1)

    try {
      let payload
      try {
        payload = await replayScenario(scenarioId)
      } catch {
        // Fallback to built-in scenario payload if backend is offline/unreachable
        const fallback = SCENARIOS.find(s => s.id === scenarioId) || SCENARIOS[0]
        payload = {
          scenario: fallback.id,
          entity: fallback.entity,
          role: fallback.role,
          events: fallback.events,
          event_count: fallback.events.length,
          alert_count: fallback.events.reduce((acc, ev) => acc + (ev.alerts?.length || 0), 0),
          source: 'synthetic deterministic simulation sequence',
        }
      }

      if (!payload?.events?.length) {
        throw new Error(`No events returned for scenario ${scenarioId}.`)
      }

      setResult(payload)
      setIndex(0)
      setPlaying(true)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Simulation replay could not be loaded.')
    } finally {
      lockRef.current = false
      setLoading(false)
    }
  }

  const reset = () => {
    setPlaying(false)
    setIndex(-1)
    setResult(null)
    setError('')
    setSelectedAlert(null)
  }

  const pause = () => setPlaying(false)
  const resume = () => {
    if (result && index + 1 < result.events.length) {
      setPlaying(true)
    }
  }

  const handleSelectScenario = (scenario) => {
    setSelectedScenarioId(scenario.id)
    setDropdownOpen(false)
    reset()
  }

  const risk = currentAlert?.risk
  const severity = currentAlert?.severity
  const signals = currentAlert?.signals || []
  const dest = current?.primary_sni || (result ? 'Awaiting scenario event' : 'Awaiting scenario event')
  const destCategory = current?.primary_category || (result ? 'Destination pending' : 'Destination pending')
  const entityDisplay = result?.entity || 'Synthetic device'
  const entitySub = result ? `${result.role || 'device'}` : 'Select a scenario'

  return (
    <div className="replay-page-wrap">
      {/* Top Header Row with Scenario Dropdown aligned to the right */}
      <div className="replay-header-row">
        <div className="replay-header-info">
          <div className="replay-eyebrow">SYNTHETIC SIMULATION</div>
          <h1 className="replay-main-title">Scenario Simulation Lab</h1>
          <p className="replay-desc-line">
            Explore how encrypted traffic behaviour changes and how CipherSentinel detects suspicious activity.
          </p>
          <div className="replay-iso-params">
            <strong>Isolation Forest inputs used in this scenario</strong>
            <ul>{activeScenarioDef.isoInputs.map(([feature, purpose]) => <li key={feature}><code>{feature}</code>: {purpose}</li>)}</ul>
          </div>
          <p className="replay-privacy-line">
            Uses synthetic traffic and network metadata. No payload decryption or real employee monitoring.
          </p>
        </div>

        {/* Top-Right Scenario Selector Dropdown */}
        <div className="scenario-selector-container" ref={dropdownRef}>
          <span className="scenario-label-text">Scenario</span>
          <button
            type="button"
            className="scenario-dropdown-trigger"
            onClick={() => setDropdownOpen(prev => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
          >
            <div className="scenario-trigger-left">
              <span className={`sc-badge sc-badge-${activeScenarioDef.tone}`}>
                {activeScenarioDef.id}
              </span>
              <span className="sc-trigger-name">{activeScenarioDef.title}</span>
            </div>
            <div className="scenario-trigger-right">
              <span className="sc-trigger-expected">
                <span className="sc-dot" style={{ backgroundColor: activeScenarioDef.dotColor }} />
                <span>{activeScenarioDef.expected}</span>
              </span>
              <svg className={`sc-chevron ${dropdownOpen ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {/* Expanded Dropdown Menu */}
          {dropdownOpen && (
            <div className="scenario-dropdown-popover" role="listbox">
              {SCENARIOS.map((sc) => {
                const isSelected = sc.id === selectedScenarioId
                return (
                  <div
                    key={sc.id}
                    className={`scenario-option-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectScenario(sc)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="sc-option-left">
                      <span className={`sc-badge sc-badge-${sc.tone}`}>{sc.id}</span>
                      <span className="sc-option-title">{sc.title}</span>
                    </div>
                    <div className="sc-option-right">
                      <span className="sc-dot" style={{ backgroundColor: sc.dotColor }} />
                      <span className="sc-option-expected">{sc.expected}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="replay-error-alert" role="alert">
          <strong>Simulation Notice</strong>: {error}
        </div>
      )}

      {/* Main Card: Encrypted traffic path */}
      <section className="replay-card replay-flow-card">
        <div className="replay-card-head">
          <div className="card-head-icon-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="4" />
              <polyline points="8 9 12 12 8 15" />
              <line x1="14" y1="15" x2="16" y2="15" />
            </svg>
          </div>
          <div>
            <h2 className="card-head-title">Encrypted traffic path</h2>
            <p className="card-head-subtitle">
              Scenario events and detections come from prepared backend artifacts.
            </p>
          </div>
        </div>

        {/* Network Diagram */}
        <div className="diagram-flow-area">
          {/* Synthetic Device Box */}
          <div className="diagram-node-box">
            <div className="diagram-node-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <strong className="diagram-node-name">{entityDisplay}</strong>
            <span className="diagram-node-sub">{entitySub}</span>
          </div>

          {/* Dashed Connecting Line */}
          <div className="diagram-connector-wrap">
            <div className={`diagram-dashed-line ${playing ? 'active-flow' : ''}`}>
              {/* Arrowhead */}
              <div className="diagram-arrowhead" />
              {/* Traveling Packet during Replay */}
              {current && (
                <div
                  className={`diagram-packet ${isOverFileSizeThreshold ? 'packet-alert' : ''}`}
                  key={`${current.window}-${current.out_bytes}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  </svg>
                  <span>{prettyBytes(current.out_bytes)}</span>
                </div>
              )}
            </div>
            <span className="diagram-flow-label">
              {current ? `${prettyBytes(current.out_bytes)} outbound` : 'Encrypted metadata flow'}
            </span>
          </div>

          {/* Destination Box */}
          <div className="diagram-node-box">
            <div className="diagram-node-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="6" rx="1.5" />
                <rect x="3" y="14" width="18" height="6" rx="1.5" />
                <line x1="6" y1="7" x2="7" y2="7" strokeWidth="2" strokeLinecap="round" />
                <line x1="6" y1="17" x2="7" y2="17" strokeWidth="2" strokeLinecap="round" />
                <line x1="14" y1="7" x2="18" y2="7" />
                <line x1="14" y1="17" x2="18" y2="17" />
              </svg>
            </div>
            <strong className="diagram-node-name">{dest}</strong>
            <span className="diagram-node-sub">{destCategory}</span>
          </div>
        </div>

        {/* 5-Column Metrics Bar */}
        <div className="replay-metrics-bar">
          <div className="replay-metric-item">
            <span className="metric-label">SIMULATION TIME</span>
            <span className="metric-value">{current?.window?.slice(11, 16) || current?.window || '—'}</span>
          </div>
          <div className="replay-metric-item">
            <span className="metric-label">OUTBOUND</span>
            <span className="metric-value">{current ? prettyBytes(current.out_bytes) : '0.0 MB'}</span>
          </div>
          <div className="replay-metric-item">
            <span className="metric-label">INBOUND</span>
            <span className="metric-value">{current ? prettyBytes(current.in_bytes) : '0.0 MB'}</span>
          </div>
          <div className="replay-metric-item">
            <span className="metric-label">CONNECTIONS</span>
            <span className="metric-value">{current?.conn_count ?? '—'}</span>
          </div>
          <div className="replay-metric-item">
            <span className="metric-label">SEVEN-DAY TOTAL</span>
            <span className="metric-value">{current ? prettyBytes(current.cum_out_7d) : '—'}</span>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="replay-controls-bar">
          <button
            type="button"
            className="ctrl-btn-primary"
            disabled={loading}
            onClick={() => run(selectedScenarioId)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>{loading ? 'Loading…' : 'Replay'}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {playing ? (
            <button type="button" className="ctrl-btn-secondary active" onClick={pause}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              <span>Pause</span>
            </button>
          ) : (
            <button
              type="button"
              className={`ctrl-btn-secondary ${result && index + 1 < (result?.events?.length || 0) ? 'active' : ''}`}
              disabled={!result || index + 1 >= (result?.events?.length || 0)}
              onClick={resume}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Resume</span>
            </button>
          )}

          <button type="button" className="ctrl-btn-outline" onClick={reset}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span>Reset</span>
          </button>

          <div className="speed-dropdown-group">
            <span className="speed-label">Speed</span>
            <div className="speed-select-wrap">
              <select
                className="speed-select"
                value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
              >
                <option value={1}>1 ×</option>
                <option value={2}>2 ×</option>
                <option value={4}>4 ×</option>
              </select>
            </div>
          </div>

          <label className="checkbox-toggle-label">
            <input
              type="checkbox"
              className="custom-checkbox"
              checked={showSignals}
              onChange={e => setShowSignals(e.target.checked)}
            />
            <span>Show detection signals</span>
          </label>

          <div className="replay-status-indicator">
            <span className={`status-led ${playing ? 'playing' : 'ready'}`} />
            <span className="status-text">{playing ? 'Playing' : 'Ready'}</span>
          </div>
        </div>
      </section>

      {/* Lower Row: Two Equal Cards */}
      <div className="replay-lower-grid">
        {/* Left: Traffic Timeline Card */}
        <section className="replay-card replay-sub-card">
          <div className="replay-card-head">
            <div className="card-head-icon-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="14" width="3.5" height="7" rx="1" fill="currentColor" />
                <rect x="10.25" y="6" width="3.5" height="15" rx="1" fill="currentColor" />
                <rect x="16.5" y="10" width="3.5" height="11" rx="1" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h2 className="card-head-title">Traffic timeline</h2>
              <p className="card-head-subtitle">
                Outbound volume and seven-day cumulative volume from feature windows.
              </p>
            </div>
          </div>

          <div className="card-inner-content">
            {chartData.length > 0 ? (
              <div className="chart-render-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="replayOutGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f2" />
                    <XAxis dataKey="window" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis yAxisId="outbound" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis yAxisId="cumulative" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(1)} MB`} />
                    <Legend verticalAlign="top" height={28} />
                    <Area yAxisId="outbound" type="monotone" dataKey="outbound" stroke="#d97706" strokeWidth={2} fill="url(#replayOutGrad)" name="Outbound per window" />
                    <Area yAxisId="cumulative" type="monotone" dataKey="cumulative" stroke="#16a34a" strokeWidth={2} fill="none" name="Seven-day total" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="timeline-empty-state">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="14" width="3.5" height="7" rx="1" fill="#cbd5e1" />
                  <rect x="10.25" y="6" width="3.5" height="15" rx="1" fill="#cbd5e1" />
                  <rect x="16.5" y="10" width="3.5" height="11" rx="1" fill="#cbd5e1" />
                </svg>
                <span className="empty-message">Choose a scenario to load its prepared timeline.</span>
              </div>
            )}
          </div>
        </section>

        {/* Right: Detection Result Card */}
        <section className="replay-card replay-sub-card">
          <div className="replay-card-head">
            <div className="card-head-icon-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="card-head-title">Detection result</h2>
              <p className="card-head-subtitle">
                Risk score is not a probability of malicious intent.
              </p>
            </div>
          </div>

          <div className="card-inner-content detection-inner-flex">
            {currentAlert ? (
              <div className="alert-scored-container">
                <div className="risk-score-headline">
                  <span className="risk-number">{risk}</span>
                  <span className="risk-text">/ 100 risk score · <strong className={`severity-tag ${severity}`}>{severity}</strong></span>
                </div>
                {showSignals && (
                  <div className="signals-breakdown-list">
                    {SIGNALS.map(([key, label, max]) => {
                      const sig = signals.find(s => s.name === key)
                      return (
                        <div className="signal-line" key={key}>
                          <div className="signal-line-left">
                            <strong className="sig-name">{label}</strong>
                            <span className="sig-detail">{sig?.detail || 'Evaluated; no contribution reported.'}</span>
                          </div>
                          <span className="sig-points">{sig ? `${sig.points}/${max}` : `—/${max}`}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                <button
                  type="button"
                  className="btn-open-evidence"
                  onClick={() => setSelectedAlert(currentAlert)}
                >
                  Open backend evidence card
                </button>
              </div>
            ) : (
              <>
                <div className="detection-empty-box">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <circle cx="15.5" cy="16.5" r="2.5" />
                    <line x1="17.5" y1="18.5" x2="20" y2="21" />
                  </svg>
                  <strong className="detection-empty-title">
                    {!current
                      ? 'No event scored yet'
                      : replayComplete
                        ? replayHasAlerts ? 'No alert on this event' : 'No detection triggered'
                        : nextScoredEvent ? 'No alert on this event' : 'No alert for this event'}
                  </strong>
                  <span className="empty-message-small">
                    {!current
                      ? 'Start the replay to see the detection outcome for each event.'
                      : replayComplete
                        ? replayHasAlerts
                          ? `This event did not trigger an alert. The previous scored event was ${String(previousScoredEvent?.window || '').replace('T', ' ').slice(0, 16)}.`
                          : 'The replay completed without a scored alert for this scenario.'
                        : nextScoredEvent
                          ? `Next scored event: ${String(nextScoredEvent.window || '').replace('T', ' ').slice(0, 16)}.`
                          : 'This event has no scored alert. The result will update if a later event is scored.'}
                  </span>
                </div>

                <div className="detection-baseline-footer">
                  <div className="baseline-left">
                    <strong className="baseline-title">Self-baseline</strong>
                    <span className="baseline-sub">Not yet returned for this window.</span>
                  </div>
                  <span className="baseline-score">—/30</span>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {selectedAlert && (
        <AlertDetail alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </div>
  )
}
