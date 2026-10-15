import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { fetchAlerts, fetchScenarios, startReplay, stopReplay } from '../api.js'
import { MOCK_ALERTS, MOCK_SCENARIOS } from '../mockData.js'
import { AlertDetail } from '../components/AlertCard.jsx'

const SCENARIOS_CONFIG = [
  {
    id: 'S1',
    title: 'S1: Heavy Uploader',
    desc: 'Legitimate heavy uploader (engineer)',
    expected: 'Expected: No alert',
    badgeClass: 'tag-expected-green',
    iconBg: 'icon-bg-green',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    id: 'S2',
    title: 'S2: Midnight Upload',
    desc: 'Single 400 MB upload at 02:00',
    expected: 'Expected: High alert',
    badgeClass: 'tag-expected-red',
    iconBg: 'icon-bg-red',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    id: 'S3',
    title: 'S3: Low-and-Slow',
    desc: 'Low-and-slow: 40 MB/day for 10 days',
    expected: 'Expected: Alert mid-period',
    badgeClass: 'tag-expected-amber',
    iconBg: 'icon-bg-amber',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: 'S4',
    title: 'S4: Sync Tool',
    desc: 'Finance + sync tool + new destination',
    expected: 'Expected: Review/High',
    badgeClass: 'tag-expected-amber',
    iconBg: 'icon-bg-blue',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: 'S5',
    title: 'S5: Departing Employee',
    desc: 'Departing employee ramp',
    expected: 'Expected: Alert before final days',
    badgeClass: 'tag-expected-amber',
    iconBg: 'icon-bg-purple',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: 'S6',
    title: 'S6: New Laptop (Hard-)',
    desc: 'New laptop cloud sync (hard negative)',
    expected: 'Expected: At most Review',
    badgeClass: 'tag-expected-amber',
    iconBg: 'icon-bg-cyan',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="12" x="3" y="4" rx="2" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
]

export default function ReplayPage() {
  const [runningScenario, setRunningScenario] = useState(null)
  const [liveAlerts, setLiveAlerts] = useState([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const timerRef = useRef(null)
  const feedEndRef = useRef(null)

  const startMut = useMutation({
    mutationFn: (sc) => startReplay(sc),
    onSuccess: (_, sc) => {
      setRunningScenario(sc)
      runDemoTrickle(sc)
    },
    onError: (_, sc) => {
      setRunningScenario(sc)
      runDemoTrickle(sc)
    },
  })

  const stopMut = useMutation({
    mutationFn: stopReplay,
    onSuccess: () => {
      setRunningScenario(null)
      if (timerRef.current) clearInterval(timerRef.current)
    },
    onError: () => {
      setRunningScenario(null)
      if (timerRef.current) clearInterval(timerRef.current)
    },
  })

  const runDemoTrickle = (scId) => {
    let pool = MOCK_ALERTS
    if (scId === 'S2') pool = [MOCK_ALERTS[0]]
    else if (scId === 'S3') pool = [MOCK_ALERTS[1]]
    else if (scId === 'S4') pool = [MOCK_ALERTS[2]]
    else if (scId === 'S5') pool = [MOCK_ALERTS[3] || MOCK_ALERTS[0]]
    else if (scId === 'S1') pool = [] // legitimate uploader = 0 alerts
    else if (scId === 'S6') pool = [MOCK_ALERTS[1]]

    let idx = 0
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      if (idx >= pool.length) {
        clearInterval(timerRef.current)
        setRunningScenario(null)
        return
      }
      const item = { ...pool[idx], id: `live-${Date.now()}-${idx}` }
      setLiveAlerts(prev => [item, ...prev])
      idx++
    }, 1200)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const handleToggleScenario = (scId) => {
    if (runningScenario === scId) {
      stopMut.mutate()
    } else {
      startMut.mutate(scId)
    }
  }

  const handleClearFeed = () => {
    setLiveAlerts([])
  }

  return (
    <div className="replay-page-container">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="replay-page-header">
        <div>
          <h1 className="replay-title">Replay Scenarios</h1>
          <p className="replay-subtitle">
            Run pre-configured network scenarios to simulate insider threat behaviours and see how CipherSentinel detects them.
          </p>
        </div>

        <button
          className="how-it-works-btn"
          type="button"
          onClick={() => setShowHowItWorks(v => !v)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
          </svg>
          <span>How it works?</span>
        </button>
      </div>

      {/* Explainer Dropdown / Callout if clicked */}
      {showHowItWorks && (
        <div className="how-it-works-panel animate-slide-in">
          <div className="panel-header">
            <strong>How CipherSentinel Scenario Replay Works</strong>
            <button className="panel-close-btn" onClick={() => setShowHowItWorks(false)}>✕</button>
          </div>
          <p>
            CipherSentinel injects synthesized TLS network flow metadata for labeled test scenarios without decrypting or inspecting payload bytes. The detection pipeline evaluates self-baseline deviation, peer group clustering, destination threat policy, and Isolation Forest anomalies in real-time.
          </p>
        </div>
      )}

      {/* ── 6 Scenario Cards Grid (3 cols x 2 rows) ──────────────────────── */}
      <div className="scenarios-grid">
        {SCENARIOS_CONFIG.map(sc => {
          const isRunning = runningScenario === sc.id

          return (
            <div key={sc.id} className="scenario-card">
              <div className="scenario-card-left">
                <div className={`scenario-icon-box ${sc.iconBg}`}>
                  {sc.icon}
                </div>
                <div className="scenario-info">
                  <div className="scenario-name">{sc.title}</div>
                  <div className="scenario-desc">{sc.desc}</div>
                  <div className={`scenario-badge ${sc.badgeClass}`}>
                    {sc.expected}
                  </div>
                </div>
              </div>

              <button
                className={`scenario-start-btn ${isRunning ? 'btn-running' : ''}`}
                onClick={() => handleToggleScenario(sc.id)}
                type="button"
              >
                {isRunning ? (
                  <>
                    <span className="replay-pulse-dot" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>Start</span>
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Live Alert Feed Section ───────────────────────────────────────── */}
      <div className="live-feed-card">
        <div className="live-feed-header">
          <div className="live-feed-title-group">
            <div className="live-broadcast-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
                <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
                <circle cx="12" cy="12" r="2" />
                <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
                <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
              </svg>
            </div>
            <div>
              <div className="live-feed-title">Live Alert Feed</div>
              <div className="live-feed-subtitle">Alerts will appear here when you run a scenario</div>
            </div>
          </div>

          <div className="live-feed-controls">
            <button
              className="feed-clear-btn"
              onClick={handleClearFeed}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              <span>Clear Feed</span>
            </button>

            {/* Auto scroll toggle */}
            <div className="auto-scroll-group" onClick={() => setAutoScroll(v => !v)}>
              <div className={`switch-track ${autoScroll ? 'switch-on' : ''}`}>
                <div className="switch-thumb" />
              </div>
              <span className="switch-label">Auto Scroll</span>
            </div>
          </div>
        </div>

        {/* Feed Body: Empty State or Alerts Stream */}
        <div className="live-feed-body">
          {liveAlerts.length === 0 ? (
            <div className="feed-empty-state">
              <div className="feed-empty-icon-wrap">
                <div className="feed-empty-icon-box">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#94A39A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <line x1="10" y1="9" x2="8" y2="9" />
                  </svg>
                </div>
                {/* Subtle sparkle accents */}
                <div className="sparkle sparkle-1">✦</div>
                <div className="sparkle sparkle-2">✦</div>
              </div>
              <div className="feed-empty-title">No alerts yet</div>
              <div className="feed-empty-subtitle">Select a scenario above and press Start to see live alerts.</div>
            </div>
          ) : (
            <div className="alerts-full-stack" style={{ marginTop: 12 }}>
              {liveAlerts.map(alert => {
                const isHigh = alert.severity === 'high'
                const barClass = isHigh ? 'bar-red' : 'bar-amber'
                const scoreClass = isHigh ? 'text-red' : 'text-amber'
                const badgeClass = isHigh ? 'badge-high' : 'badge-review'
                const badgeText = isHigh ? '● HIGH' : '● REVIEW'

                return (
                  <div
                    key={alert.id}
                    className="dashboard-alert-card full-width-alert-card"
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <div className="alert-card-top">
                      <div className="alert-card-entity-group">
                        <div className={`alert-indicator-bar ${barClass}`} />
                        <div>
                          <div className="alert-entity-name">{alert.entity}</div>
                          <div className="alert-entity-meta">{alert.role} · {alert.window}</div>
                        </div>
                      </div>
                      <div className="alert-card-score-group">
                        <span className={`alert-score-num ${scoreClass}`}>{alert.risk}</span>
                        <span className={`alert-badge ${badgeClass}`}>{badgeText}</span>
                        <span className="alert-card-chevron">›</span>
                      </div>
                    </div>

                    <div className="alert-card-dest-row">
                      <div className="alert-dest-target">
                        <span className="dest-arrow">→</span>
                        <span className="dest-sni">{alert.destination?.sni}</span>
                      </div>
                      {alert.destination?.category === 'Personal Share' && (
                        <span className="tag-pill tag-personal-share">● Personal Share</span>
                      )}
                      {alert.destination?.category === 'File Transfer' && (
                        <span className="tag-pill tag-file-transfer">● File Transfer</span>
                      )}
                      {alert.destination?.category === 'Unusual Volume' && (
                        <span className="tag-pill tag-unusual-volume">● Unusual Volume</span>
                      )}
                      {alert.destination?.first_seen_for_user && (
                        <span className="tag-pill tag-new-user">
                          {alert.destination?.is_new_dest ? 'New destination' : 'New for user'}
                        </span>
                      )}
                    </div>

                    <div className="alert-card-volume-row">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>{alert.out_mb.toFixed(1)} MB outbound</span>
                    </div>

                    <div className="alert-progress-wrapper">
                      <div className="alert-progress-track">
                        <div className="alert-progress-fill fill-spectrum" style={{ width: `${alert.risk}%` }} />
                      </div>
                      <div className="alert-progress-labels">
                        <span>0</span>
                        <span className="label-info">INFO</span>
                        <span className="label-review">REVIEW</span>
                        <span className="label-high">HIGH</span>
                        <span>100</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={feedEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <AlertDetail alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </div>
  )
}
