import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { replayScenario } from '../api.js'
import { AlertDetail } from '../components/AlertCard.jsx'

const SCENARIOS = [
  { id: 'S1', title: 'Normal engineering traffic', desc: '2 GB build uploads to sanctioned cloud storage during working hours.', expected: 'Expected: no alert', tone: 'green' },
  { id: 'S2', title: 'Large suspicious transfer', desc: 'A finance user sends 400 MB to mega.nz at 02:00.', expected: 'Expected: high alert', tone: 'red' },
  { id: 'S3', title: 'Slow cumulative leak', desc: 'HR user sends 40 MB each day for ten days to wetransfer.com.', expected: 'Expected: cumulative alert', tone: 'amber' },
  { id: 'S4', title: 'New anonymising destination', desc: 'Finance sync-tool fingerprint connects to anonfiles.com over five days.', expected: 'Expected: review or high', tone: 'amber' },
  { id: 'S5', title: 'Rising outbound activity', desc: 'Sales user ramps transfers and uses new personal file-sharing destinations.', expected: 'Expected: alert during ramp', tone: 'amber' },
  { id: 'S6', title: 'New laptop cloud sync', desc: 'Engineer performs a 3 GB first-day sync to sanctioned OneDrive.', expected: 'Expected: hard negative', tone: 'blue' },
]
const SIGNALS = [
  ['self_deviation', 'Self-baseline', 30], ['destination_policy', 'Destination policy', 25],
  ['isolation_forest', 'Isolation Forest', 20], ['peer_deviation', 'Peer-group baseline', 15], ['slow_leak', 'Seven-day accumulator', 10],
]

function prettyBytes(value = 0) {
  const n = Number(value) || 0
  return n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e6).toFixed(1)} MB`
}

export default function ReplayPage() {
  const [selected, setSelected] = useState(null)
  const [result, setResult] = useState(null)
  const [index, setIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSignals, setShowSignals] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState(null)
  const lockRef = useRef(false)
  const resultsRef = useRef(null)

  const current = result?.events?.[index] || null
  const currentAlert = current?.alerts?.[0] || null
  const isHighRiskEvent = currentAlert?.severity?.toLowerCase() === 'high'
  const chart = useMemo(() => (result?.events || []).slice(0, index + 1).map((event, i) => ({
    window: event.window?.replace('T', ' ').slice(5, 16) || `${i + 1}`,
    outbound: Number(event.out_bytes || 0) / 1e6,
    cumulative: Number(event.cum_out_7d || 0) / 1e6,
  })), [result, index])

  useEffect(() => {
    if (!playing || !result) return undefined
    if (index + 1 >= result.events.length) { setPlaying(false); return undefined }
    // Let a high-risk file finish its crossing even when the user selected 2×/4×.
    const delay = isHighRiskEvent ? 1250 : 1050 / speed
    const timer = window.setTimeout(() => setIndex(v => v + 1), delay)
    return () => window.clearTimeout(timer)
  }, [playing, result, index, speed, isHighRiskEvent])

  const run = async (scenario, replay = false) => {
    if (lockRef.current) return
    if (replay && result?.scenario === scenario) {
      setIndex(-1); setPlaying(true); setError(''); return
    }
    lockRef.current = true
    setLoading(true); setError(''); setSelected(scenario); setResult(null); setIndex(-1); setPlaying(false)
    try {
      const payload = await replayScenario(scenario)
      setResult(payload)
      if (!payload.events?.length) throw new Error(`No prepared feature windows were returned for ${scenario}. Run the preparation pipeline and check the scenario mapping.`)
      setIndex(0); setPlaying(true)
      window.requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Scenario replay failed. Check that the API is running and prepared artifacts are available.')
    } finally { lockRef.current = false; setLoading(false) }
  }

  const reset = () => { setPlaying(false); setIndex(-1); setSelected(null); setResult(null); setError(''); setSelectedAlert(null) }
  const pause = () => setPlaying(false)
  const resume = () => { if (result && index + 1 < result.events.length) setPlaying(true) }
  const progress = result?.events?.length ? Math.max(0, ((index + 1) / result.events.length) * 100) : 0
  const risk = currentAlert?.risk
  const severity = currentAlert?.severity
  const signals = currentAlert?.signals || []
  const dest = current?.primary_sni || 'Awaiting scenario event'

  return <div className="replay-page-container scenario-lab">
    <header className="replay-page-header">
      <div><div className="lab-eyebrow">SYNTHETIC SIMULATION</div><h1 className="replay-title">Scenario Simulation Lab</h1>
        <p className="replay-subtitle">Explore how encrypted traffic behaviour changes and how CipherSentinel detects suspicious activity.</p>
        <p className="lab-privacy">Uses synthetic traffic and network metadata. No payload decryption or real employee monitoring.</p>
      </div>
      <span className="lab-status">● Synthetic simulation</span>
    </header>

    <div className="lab-workspace">
      <aside className="lab-scenario-rail" aria-label="Scenario selector">
        <div className="lab-rail-heading"><h2>Choose a scenario</h2><p>Six synthetic traffic patterns</p></div>
        <section className="scenarios-grid lab-grid" aria-label="Available scenarios">
          {SCENARIOS.map(sc => <article key={sc.id} className={`scenario-card lab-card ${selected === sc.id ? 'lab-card-selected' : ''}`}>
            <div className="lab-card-top"><span className={`lab-id tone-${sc.tone}`}>{sc.id}</span><span className={`scenario-badge tone-text-${sc.tone}`}>{sc.expected}</span></div>
            <h2>{sc.title}</h2><p>{sc.desc}</p>
            <button className="scenario-start-btn" type="button" disabled={loading} onClick={() => run(sc.id)}>
              {loading && selected === sc.id ? 'Loading…' : `Run ${sc.id}`}
            </button>
          </article>)}
        </section>
      </aside>

      <div className="lab-main-column">
        {error && <div className="lab-error" role="alert"><strong>Replay unavailable</strong><p>{error}</p><button type="button" onClick={() => selected && run(selected)}>Retry</button></div>}

    <section className="lab-stage-card" ref={resultsRef}>
      <div className="lab-section-heading"><div><h2>Encrypted traffic path</h2><p>Scenario events and detections come from prepared backend artifacts.</p></div>
        {result && <span className="lab-entity">{result.entity} · {result.role}</span>}
      </div>
      <div className="lab-flow">
        <div className="lab-node"><span className="lab-node-icon">▣</span><strong>{result?.entity || 'Synthetic device'}</strong><small>{result?.role || 'Select a scenario'}</small></div>
        <div className={`lab-connection ${current ? 'flow-active' : ''} ${Number(current?.out_bytes || 0) >= 1e9 ? 'flow-xlarge' : Number(current?.out_bytes || 0) >= 1e8 ? 'flow-large' : ''}`}>
          {current && <span className={`lab-file-packet ${isHighRiskEvent ? 'lab-file-alert' : ''}`} key={`${current.window}-${current.out_bytes}`} aria-label={`${prettyBytes(current.out_bytes)} outbound transfer${currentAlert ? `, ${currentAlert.severity} alert returned` : ''}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5L13.5 2Z"/><path d="M13 2v7h7M8 14h8M8 17h8"/></svg>
            <b>{prettyBytes(current.out_bytes)}</b>
          </span>}
          <small>{current ? `${prettyBytes(current.out_bytes)} outbound` : 'Encrypted metadata flow'}</small>
        </div>
        <div className="lab-node"><span className="lab-node-icon">⇧</span><strong>{dest}</strong><small>{current?.primary_category || 'Destination pending'}</small></div>
      </div>
      <div className="lab-event-summary">
        <span><b>Simulation time</b>{current?.window || '—'}</span><span><b>Outbound</b>{prettyBytes(current?.out_bytes)}</span>
        <span><b>Inbound</b>{prettyBytes(current?.in_bytes)}</span><span><b>Connections</b>{current?.conn_count ?? '—'}</span>
        <span><b>Seven-day total</b>{current ? prettyBytes(current.cum_out_7d) : '—'}</span>
      </div>
      <div className="lab-controls">
        <button type="button" disabled={!result || loading} onClick={() => run(result.scenario, true)}>↻ Replay</button>
        {playing ? <button type="button" onClick={pause}>Ⅱ Pause</button> : <button type="button" disabled={!result || index + 1 >= (result?.events?.length || 0)} onClick={resume}>▶ Resume</button>}
        <button type="button" onClick={reset}>Reset</button>
        <label>Speed <select value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label>
        <label className="lab-toggle"><input type="checkbox" checked={showSignals} onChange={e => setShowSignals(e.target.checked)} /> Show detection signals</label>
        <span className="lab-progress-label">{result ? `${Math.min(index + 1, result.event_count)} / ${result.event_count} events` : 'Ready'}</span>
      </div>
      <div className="lab-progress"><span style={{ width: `${progress}%` }} /></div>
    </section>

    <div className="lab-lower-grid">
      <section className="lab-stage-card lab-chart-card"><div className="lab-section-heading"><div><h2>Traffic timeline</h2><p>Outbound volume and seven-day cumulative volume from feature windows.</p></div></div>
        {chart.length ? <div className="lab-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="labOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e99b36" stopOpacity={0.3}/><stop offset="100%" stopColor="#e99b36" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#edf0f2"/><XAxis dataKey="window" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip formatter={(v) => `${Number(v).toFixed(1)} MB`}/><Area type="monotone" dataKey="outbound" stroke="#d89232" fill="url(#labOut)" name="Outbound per window"/><Area type="monotone" dataKey="cumulative" stroke="#568c72" fill="none" name="Seven-day total"/></AreaChart></ResponsiveContainer></div> : <div className="lab-empty">Choose a scenario to load its prepared timeline.</div>}
      </section>
      <section className="lab-stage-card lab-detection"><div className="lab-section-heading"><div><h2>Detection result</h2><p>Risk score is not a probability of malicious intent.</p></div></div>
        {risk !== undefined ? <><div className="lab-risk"><strong>{risk}</strong><span>/ 100 risk score · <b>{severity}</b></span></div><div className="lab-bands">Info 0–39 <i/> Review 40–69 <i/> High 70–100</div></> : <div className="lab-empty">{current ? 'No alert returned for this event window.' : 'Detection result appears as the replay reaches a scored event.'}</div>}
        {showSignals && <div className="lab-signals">{SIGNALS.map(([key, label, max]) => { const signal = signals.find(s => s.name === key); return <div className="lab-signal" key={key}><span><b>{label}</b><small>{signal?.detail || (currentAlert ? 'Evaluated; no contribution reported.' : 'Not yet returned for this window.')}</small></span><strong>{signal ? `${signal.points}/${max}` : `—/${max}`}</strong></div> })}</div>}
        {currentAlert && <button className="lab-evidence-button" type="button" onClick={() => setSelectedAlert(currentAlert)}>Open backend evidence card</button>}
      </section>
    </div>
      </div>
    </div>
    {selectedAlert && <AlertDetail alert={selectedAlert} onClose={() => setSelectedAlert(null)} />}
  </div>
}
