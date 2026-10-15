import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { fetchAlerts, fetchScenarios, startReplay, stopReplay } from '../api.js'
import { MOCK_ALERTS, MOCK_SCENARIOS } from '../mockData.js'
import AlertCard, { AlertDetail } from '../components/AlertCard.jsx'
import { scenarioLabel } from '../utils.js'

export default function ReplayPage() {
  const [running, setRunning] = useState(false)
  const [scenario, setScenario] = useState('ALL')
  const [liveAlerts, setLiveAlerts] = useState([])
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [demoMode, setDemoMode] = useState(false)
  const demoRef = useRef(null)

  const { data: scenariosData } = useQuery({
    queryKey: ['scenarios'],
    queryFn: fetchScenarios,
    placeholderData: MOCK_SCENARIOS,
  })

  const startMut = useMutation({
    mutationFn: (sc) => startReplay(sc),
    onSuccess: () => { setRunning(true); setLiveAlerts([]) },
    onError: () => {
      // Fall back to local demo animation
      setRunning(true)
      setLiveAlerts([])
      setDemoMode(true)
    },
  })

  const stopMut = useMutation({
    mutationFn: stopReplay,
    onSuccess: () => { setRunning(false); setDemoMode(false) },
    onError: () => { setRunning(false); setDemoMode(false) },
  })

  // Demo mode: trickle mock alerts
  useEffect(() => {
    if (!demoMode || !running) {
      if (demoRef.current) clearInterval(demoRef.current)
      return
    }
    const pool = scenario === 'ALL' ? MOCK_ALERTS : MOCK_ALERTS.filter(a => a.scenario?.includes(scenario))
    let idx = 0
    demoRef.current = setInterval(() => {
      if (idx >= pool.length) {
        clearInterval(demoRef.current)
        setRunning(false)
        setDemoMode(false)
        return
      }
      setLiveAlerts(prev => [pool[idx], ...prev])
      idx++
    }, 1500)
    return () => clearInterval(demoRef.current)
  }, [demoMode, running, scenario])

  // Poll live alerts from backend when running in real mode
  const { data: alertsData } = useQuery({
    queryKey: ['alerts-live'],
    queryFn: () => fetchAlerts(true),
    refetchInterval: running && !demoMode ? 2000 : false,
    enabled: running && !demoMode,
  })

  useEffect(() => {
    if (!demoMode && alertsData?.alerts) {
      setLiveAlerts(alertsData.alerts)
    }
  }, [alertsData, demoMode])

  const scenarios = scenariosData?.scenarios || MOCK_SCENARIOS.scenarios

  const handleStart = () => startMut.mutate(scenario)
  const handleStop  = () => {
    stopMut.mutate()
    if (demoRef.current) clearInterval(demoRef.current)
  }

  return (
    <div>
      <h1 className="page-title">▶ Scenario Replay</h1>
      <p className="page-subtitle">
        Replay a labelled scenario and watch alerts surface in real time
      </p>

      {/* Scenario cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
        {scenarios.map(s => (
          <div
            key={s.id}
            id={`scenario-card-${s.id}`}
            className={`card card-sm`}
            style={{
              cursor: 'pointer',
              border: scenario === s.id ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
              background: scenario === s.id ? 'rgba(79,158,255,0.08)' : 'var(--bg-glass)',
              transition: 'all 0.2s',
            }}
            onClick={() => !running && setScenario(s.id)}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', marginBottom: 6 }}>
              {scenarioLabel(s.id)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.4 }}>{s.name}</div>
            <div style={{
              display: 'inline-block',
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 4,
              background: s.expected.includes('No alert') ? 'rgba(34,211,165,0.1)' : 'rgba(255,165,2,0.1)',
              color: s.expected.includes('No alert') ? 'var(--accent-green)' : 'var(--risk-review)',
              border: `1px solid ${s.expected.includes('No alert') ? 'rgba(34,211,165,0.2)' : 'rgba(255,165,2,0.2)'}`,
            }}>
              Expected: {s.expected}
            </div>
          </div>
        ))}
      </div>

      {/* Replay bar */}
      <div className="replay-bar">
        <div className="replay-status">
          <div className={`replay-dot ${running ? 'running' : ''}`} />
          {running ? `Replaying ${scenarioLabel(scenario)}…` : 'Stopped'}
        </div>

        <div style={{ flex: 1 }} />

        {!running ? (
          <button
            id="btn-replay-start"
            className="btn btn-primary"
            onClick={handleStart}
            disabled={startMut.isPending}
          >
            {startMut.isPending ? <span className="spinner" /> : '▶'} Start Replay
          </button>
        ) : (
          <button
            id="btn-replay-stop"
            className="btn btn-danger"
            onClick={handleStop}
          >
            ⏹ Stop
          </button>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
          {liveAlerts.length} alert{liveAlerts.length !== 1 ? 's' : ''} surfaced
        </div>
      </div>

      {/* Live alert feed */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📡 Live Alert Feed</div>
          {liveAlerts.length > 0 && (
            <button id="btn-clear-live" className="btn btn-sm btn-secondary" onClick={() => setLiveAlerts([])}>
              Clear
            </button>
          )}
        </div>

        {liveAlerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 36 }}>📡</div>
            <div className="empty-title">{running ? 'Waiting for alerts…' : 'No alerts yet'}</div>
            <div>{running ? 'Alerts will appear here as the scenario runs' : 'Select a scenario and press Start'}</div>
          </div>
        ) : (
          <div className="alert-list">
            {liveAlerts.map(a => (
              <AlertCard key={`${a.id}-live`} alert={a} onClick={() => setSelectedAlert(a)} />
            ))}
          </div>
        )}
      </div>

      {selectedAlert && (
        <AlertDetail alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </div>
  )
}
