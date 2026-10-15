import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAlerts } from '../api.js'
import { MOCK_ALERTS } from '../mockData.js'
import { AlertDetail } from '../components/AlertCard.jsx'

export default function AlertsPage() {
  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      try { return await fetchAlerts(false) }
      catch { return { alerts: MOCK_ALERTS, total: MOCK_ALERTS.length } }
    },
    refetchInterval: 5000,
    placeholderData: { alerts: MOCK_ALERTS, total: MOCK_ALERTS.length },
  })

  const [selectedAlert, setSelectedAlert] = useState(null)
  const [filterType, setFilterType] = useState('all') // 'all', 'high', 'review', 'info'
  const [sortBy, setSortBy] = useState('risk') // 'risk', 'date', 'volume'
  const [dateRange, setDateRange] = useState('Last 30 days')

  const alerts = alertsData?.alerts || MOCK_ALERTS

  const highCount = alerts.filter(a => a.severity === 'high').length
  const reviewCount = alerts.filter(a => a.severity === 'review').length
  const infoCount = alerts.filter(a => a.severity === 'info').length

  const filteredAlerts = alerts
    .filter(a => {
      if (filterType === 'all') return true
      if (filterType === 'high') return a.severity === 'high'
      if (filterType === 'review') return a.severity === 'review'
      if (filterType === 'info') return a.severity === 'info'
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'risk') return b.risk - a.risk
      if (sortBy === 'volume') return b.out_mb - a.out_mb
      return new Date(b.window) - new Date(a.window)
    })

  return (
    <div className="alerts-page-container">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="alerts-page-header">
        <div>
          <h1 className="alerts-title">Alerts</h1>
          <p className="alerts-subtitle">Detect, review and investigate potential insider threats.</p>
        </div>

        {/* Date range picker button */}
        <button className="alerts-date-btn" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>{dateRange}</span>
          <span className="alerts-chevron">⌵</span>
        </button>
      </div>

      {/* ── Filter Cards Row + Sort Dropdown ─────────────────────────────── */}
      <div className="alerts-filter-bar">
        {/* Filter Card 1: All Alerts */}
        <div
          className={`filter-stat-card ${filterType === 'all' ? 'active-filter' : ''}`}
          onClick={() => setFilterType('all')}
        >
          <div className="filter-icon-box filter-icon-green">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
          </div>
          <div>
            <div className="filter-stat-label">All Alerts</div>
            <div className="filter-stat-value text-green">{highCount}</div>
          </div>
        </div>

        {/* Filter Card 2: High Risk */}
        <div
          className={`filter-stat-card ${filterType === 'high' ? 'active-filter' : ''}`}
          onClick={() => setFilterType('high')}
        >
          <div className="filter-icon-box filter-icon-red">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <div className="filter-stat-label">High Risk</div>
            <div className="filter-stat-value text-red">{highCount}</div>
          </div>
        </div>

        {/* Filter Card 3: Review */}
        <div
          className={`filter-stat-card ${filterType === 'review' ? 'active-filter' : ''}`}
          onClick={() => setFilterType('review')}
        >
          <div className="filter-icon-box filter-icon-amber">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
          </div>
          <div>
            <div className="filter-stat-label">Review</div>
            <div className="filter-stat-value">0</div>
          </div>
        </div>

        {/* Filter Card 4: Info */}
        <div
          className={`filter-stat-card ${filterType === 'info' ? 'active-filter' : ''}`}
          onClick={() => setFilterType('info')}
        >
          <div className="filter-icon-box filter-icon-blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div>
            <div className="filter-stat-label">Info</div>
            <div className="filter-stat-value">0</div>
          </div>
        </div>

        {/* Sort by Dropdown Card */}
        <div className="alerts-sort-card">
          <div className="sort-icon-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 16 4 4 4-4" />
              <path d="M7 20V4" />
              <path d="m21 8-4-4-4 4" />
              <path d="M17 4v16" />
            </svg>
          </div>
          <div className="sort-text-box">
            <span className="sort-label">Sort by</span>
            <span className="sort-value">Risk Score</span>
          </div>
          <span className="sort-chevron">⌵</span>
        </div>
      </div>

      {/* ── Alerts Stack ─────────────────────────────────────────────────── */}
      <div className="alerts-full-stack">
        {filteredAlerts.map(alert => {
          const isHigh = alert.severity === 'high'
          const isReview = alert.severity === 'review'
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

              {/* Destination & Tags */}
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

              {/* Outbound volume */}
              <div className="alert-card-volume-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>{alert.out_mb.toFixed(1)} MB outbound</span>
              </div>

              {/* Rainbow Spectrum Progress Bar */}
              <div className="alert-progress-wrapper">
                <div className="alert-progress-track">
                  <div
                    className="alert-progress-fill fill-spectrum"
                    style={{ width: `${alert.risk}%` }}
                  />
                </div>
                <div className="alert-progress-labels">
                  <span>0</span>
                  <span className="label-info">INFO</span>
                  <span className="label-review">REVIEW</span>
                  <span className="label-high">HIGH</span>
                  <span>100</span>
                </div>
              </div>

              {/* Signal Pills */}
              <div className="alert-signals-row">
                {alert.signals?.map((sig) => {
                  let pillClass = 'pill-blue'
                  if (sig.name === 'destination_policy' || sig.label === 'Dest Policy') pillClass = 'pill-red'
                  else if (sig.name === 'isolation_forest' || sig.label === 'Iso Forest') pillClass = 'pill-green'
                  else if (sig.name === 'peer_deviation' || sig.label === 'Peer Group') pillClass = 'pill-purple'
                  else if (sig.name === 'slow_leak' || sig.label === 'Slow-Leak') pillClass = 'pill-cyan'

                  return (
                    <div key={sig.name} className={`signal-pill ${pillClass}`}>
                      <span className="sig-icon">{sig.icon}</span>
                      <span className="sig-name">{sig.label}</span>
                      <span className="sig-pts">+{sig.points?.toFixed(0)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <AlertDetail alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </div>
  )
}
