import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAlerts, fetchEntities } from '../api.js'
import { MOCK_ALERTS, MOCK_ENTITIES } from '../mockData.js'
import { AlertDetail } from '../components/AlertCard.jsx'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

const OUTBOUND_TREND_DATA = [
  { date: 'Mar 1',  gb: 0.8 },
  { date: 'Mar 4',  gb: 1.4 },
  { date: 'Mar 8',  gb: 2.3 },
  { date: 'Mar 11', gb: 1.7 },
  { date: 'Mar 15', gb: 1.1 },
  { date: 'Mar 18', gb: 1.6 },
  { date: 'Mar 22', gb: 2.6 },
  { date: 'Mar 26', gb: 1.4 },
  { date: 'Mar 30', gb: 1.7 },
]

export default function Dashboard({ setPage, setSelectedAlert }) {
  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      try { return await fetchAlerts(false) }
      catch { return { alerts: MOCK_ALERTS, total: MOCK_ALERTS.length } }
    },
    refetchInterval: 5000,
    placeholderData: { alerts: MOCK_ALERTS, total: MOCK_ALERTS.length },
  })

  const { data: entitiesData } = useQuery({
    queryKey: ['entities'],
    queryFn: async () => {
      try { return await fetchEntities() }
      catch { return { entities: MOCK_ENTITIES } }
    },
    placeholderData: { entities: MOCK_ENTITIES },
  })

  const [localSelectedAlert, setLocalSelectedAlert] = useState(null)
  const alerts = alertsData?.alerts || MOCK_ALERTS
  const entities = entitiesData?.entities || MOCK_ENTITIES

  const highCount = alerts.filter(a => a.severity === 'high').length
  const reviewCount = alerts.filter(a => a.severity === 'review').length
  const totalOut = entities.reduce((s, e) => s + (e.total_out_gb || 0), 0)

  // Risk distribution counts
  const highEntities = entities.filter(e => e.max_risk >= 70).length
  const reviewEntities = entities.filter(e => e.max_risk >= 40 && e.max_risk < 70).length
  const cleanEntities = entities.filter(e => e.max_risk < 40).length
  const totalEntities = entities.length

  const handleOpenAlert = (alert) => {
    setLocalSelectedAlert(alert)
    setSelectedAlert?.(alert)
  }

  return (
    <div className="dashboard-container">
      {/* ── Welcome Banner ───────────────────────────────────────────────── */}
      <section className="welcome-banner">
        <div className="welcome-content">
          <h1 className="welcome-title">Welcome back!</h1>
          <p className="welcome-subtitle">Here's what's happening with your insider threat intelligence.</p>
        </div>
        <div className="welcome-tagline">
          <svg className="welcome-shield-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <div className="welcome-tagline-text">
            <span>Detect early.</span>
            <span>Prevent always.</span>
          </div>
        </div>
      </section>

      {/* ── 5 Metric KPI Cards ───────────────────────────────────────────── */}
      <section className="kpi-grid">
        {/* Card 1: High Alerts */}
        <div className="kpi-card" onClick={() => setPage('alerts')}>
          <div className="kpi-icon-box kpi-icon-red">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">High Alerts</div>
            <div className="kpi-value text-red">{highCount}</div>
            <div className="kpi-sub">Immediate review</div>
          </div>
          <div className="kpi-arrow">›</div>
        </div>

        {/* Card 2: Review Alerts */}
        <div className="kpi-card" onClick={() => setPage('alerts')}>
          <div className="kpi-icon-box kpi-icon-amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <circle cx="11.5" cy="14.5" r="2.5" />
              <path d="m13.5 16.5 2 2" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Review Alerts</div>
            <div className="kpi-value text-amber">{reviewCount}</div>
            <div className="kpi-sub">Investigate</div>
          </div>
          <div className="kpi-arrow">›</div>
        </div>

        {/* Card 3: Entities Monitored */}
        <div className="kpi-card" onClick={() => setPage('entities')}>
          <div className="kpi-icon-box kpi-icon-green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Entities Monitored</div>
            <div className="kpi-value text-green">{totalEntities}</div>
            <div className="kpi-sub">Pseudonymous users</div>
          </div>
          <div className="kpi-arrow">›</div>
        </div>

        {/* Card 4: Total Outbound */}
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Outbound</div>
            <div className="kpi-value">{totalOut.toFixed(1)} GB</div>
            <div className="kpi-sub">30-day window</div>
          </div>
          <div className="kpi-arrow">›</div>
        </div>

        {/* Card 5: Payload Bytes Read */}
        <div className="kpi-card" onClick={() => setPage('limits')}>
          <div className="kpi-icon-box kpi-icon-purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Payload Bytes Read</div>
            <div className="kpi-value">0</div>
            <div className="kpi-sub">Metadata only 🔒</div>
          </div>
          <div className="kpi-arrow">›</div>
        </div>
      </section>

      {/* ── Main Dashboard Layout: Left & Right Columns ──────────────────── */}
      <div className="dashboard-grid">
        {/* ── LEFT COLUMN: Recent Alerts ──────────────────────────────────── */}
        <div className="dashboard-left">
          <div className="section-header">
            <div className="section-title">
              <span className="section-icon-red">🔔</span>
              <span>Recent Alerts</span>
            </div>
            <button className="btn-pill" onClick={() => setPage('alerts')}>
              View all →
            </button>
          </div>

          <div className="alerts-stack">
            {/* Alert 1: U-008 */}
            <div className="dashboard-alert-card card-border-red" onClick={() => handleOpenAlert(alerts[0])}>
              <div className="alert-card-top">
                <div className="alert-card-entity-group">
                  <div className="alert-indicator-bar bar-red" />
                  <div>
                    <div className="alert-entity-name">U-008</div>
                    <div className="alert-entity-meta">finance · 2026-03-12 02:00</div>
                  </div>
                </div>
                <div className="alert-card-score-group">
                  <span className="alert-score-num text-red">87</span>
                  <span className="alert-badge badge-high">● HIGH</span>
                  <span className="alert-card-chevron">›</span>
                </div>
              </div>

              {/* Destination & Tags */}
              <div className="alert-card-dest-row">
                <div className="alert-dest-target">
                  <span className="dest-arrow">→</span>
                  <span className="dest-sni">mega.nz</span>
                </div>
                <span className="tag-pill tag-personal-share">● Personal Share</span>
                <span className="tag-pill tag-new-user">New for user</span>
              </div>

              {/* Outbound bytes row */}
              <div className="alert-card-volume-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>400.0 MB outbound</span>
              </div>

              {/* Threat Score Bar */}
              <div className="alert-progress-wrapper">
                <div className="alert-progress-track">
                  <div className="alert-progress-fill fill-red" style={{ width: '87%' }} />
                </div>
                <div className="alert-progress-labels">
                  <span>0</span>
                  <span>INFO</span>
                  <span>REVIEW</span>
                  <span className="active-high">HIGH</span>
                  <span>100</span>
                </div>
              </div>

              {/* Signal Pills */}
              <div className="alert-signals-row">
                <div className="signal-pill pill-blue">
                  <span className="sig-icon">📊</span>
                  <span className="sig-name">Self-Baseline</span>
                  <span className="sig-pts">+28</span>
                </div>
                <div className="signal-pill pill-red">
                  <span className="sig-icon">🎯</span>
                  <span className="sig-name">Dest Policy</span>
                  <span className="sig-pts">+25</span>
                </div>
                <div className="signal-pill pill-green">
                  <span className="sig-icon">🌲</span>
                  <span className="sig-name">Iso Forest</span>
                  <span className="sig-pts">+18</span>
                </div>
                <div className="signal-pill pill-purple">
                  <span className="sig-icon">👥</span>
                  <span className="sig-name">Peer Group</span>
                  <span className="sig-pts">+11</span>
                </div>
                <div className="signal-pill pill-cyan">
                  <span className="sig-icon">☁️</span>
                  <span className="sig-name">Slow-Leak</span>
                  <span className="sig-pts">+6</span>
                </div>
              </div>
            </div>

            {/* Alert 2: U-014 */}
            <div className="dashboard-alert-card card-border-amber" onClick={() => handleOpenAlert(alerts[1])}>
              <div className="alert-card-top">
                <div className="alert-card-entity-group">
                  <div className="alert-indicator-bar bar-amber" />
                  <div>
                    <div className="alert-entity-name">U-014</div>
                    <div className="alert-entity-meta">hr · 2026-03-15 10:00</div>
                  </div>
                </div>
                <div className="alert-card-score-group">
                  <span className="alert-score-num text-amber">55</span>
                  <span className="alert-badge badge-review">● REVIEW</span>
                  <span className="alert-card-chevron">›</span>
                </div>
              </div>

              {/* Destination & Tags */}
              <div className="alert-card-dest-row">
                <div className="alert-dest-target">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                    <path d="M8.5 2h7l5.5 9.5-3.5 6-9-15.5z" fill="#FBBF24" />
                    <path d="M3 17.5l3.5 6h14l-3.5-6H3z" fill="#2563EB" />
                    <path d="M1.5 15l7-12 3.5 6-7 12-3.5-6z" fill="#16A34A" />
                  </svg>
                  <span className="dest-sni">drive.google.com</span>
                </div>
                <span className="tag-pill tag-unusual-volume">● Unusual Volume</span>
                <span className="tag-pill tag-new-destination">New destination</span>
              </div>

              {/* Outbound bytes row */}
              <div className="alert-card-volume-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>120.5 MB outbound</span>
              </div>

              {/* Threat Score Bar */}
              <div className="alert-progress-wrapper">
                <div className="alert-progress-track">
                  <div className="alert-progress-fill fill-amber" style={{ width: '55%' }} />
                </div>
                <div className="alert-progress-labels">
                  <span>0</span>
                  <span>INFO</span>
                  <span className="active-review">REVIEW</span>
                  <span>HIGH</span>
                  <span>100</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Distribution, Trend & Top Entities ────────────── */}
        <div className="dashboard-right">
          {/* Top 2 Cards: Donut Chart & Outbound Trend */}
          <div className="right-top-grid">
            {/* Card 1: Entity Risk Distribution */}
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>Entity Risk Distribution</span>
                </div>
              </div>

              <div className="donut-chart-layout">
                {/* Donut graphic */}
                <div className="donut-chart-container">
                  <svg width="116" height="116" viewBox="0 0 120 120">
                    <defs>
                      <filter id="subtle-shadow" x="-10%" y="-10%" width="120%" height="120%">
                        <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.06" />
                      </filter>
                    </defs>
                    {/* Circle 1: Red (High) */}
                    <circle
                      cx="60" cy="60" r="44"
                      fill="transparent"
                      stroke="#EF4444"
                      strokeWidth="14"
                      strokeDasharray="92 184"
                      strokeDashoffset="0"
                      transform="rotate(-90 60 60)"
                    />
                    {/* Circle 2: Amber (Review) */}
                    <circle
                      cx="60" cy="60" r="44"
                      fill="transparent"
                      stroke="#F59E0B"
                      strokeWidth="14"
                      strokeDasharray="92 184"
                      strokeDashoffset="-92"
                      transform="rotate(-90 60 60)"
                    />
                    {/* Circle 3: Green (Clean) */}
                    <circle
                      cx="60" cy="60" r="44"
                      fill="transparent"
                      stroke="#10B981"
                      strokeWidth="14"
                      strokeDasharray="92 184"
                      strokeDashoffset="-184"
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <div className="donut-center-text">
                    <span className="donut-center-num">6</span>
                    <span className="donut-center-label">Entities</span>
                  </div>
                </div>

                {/* Legend list */}
                <div className="donut-legend">
                  <div className="legend-row">
                    <span className="legend-dot dot-red" />
                    <span className="legend-label">High</span>
                    <span className="legend-val">2</span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-dot dot-amber" />
                    <span className="legend-label">Review</span>
                    <span className="legend-val">2</span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-dot dot-green" />
                    <span className="legend-label">Clean</span>
                    <span className="legend-val">2</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Outbound Data Trend */}
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  <span>Outbound Data Trend</span>
                </div>
                <div className="select-pill">
                  <span>Last 30 days</span>
                  <span className="select-chevron">⌵</span>
                </div>
              </div>

              <div style={{ height: 110, marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={OUTBOUND_TREND_DATA} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#8C9B92', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 3]}
                      ticks={[0, 1, 2, 3]}
                      tick={{ fill: '#8C9B92', fontSize: 10 }}
                      tickFormatter={v => (v === 0 ? '0' : `${v} GB`)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v) => [`${v} GB`, 'Outbound']}
                      contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 11 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="gb"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#trendGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bottom Card: Top Risk Entities */}
          <div className="top-entities-card">
            <div className="section-header" style={{ marginBottom: 12 }}>
              <div className="section-title">
                <span className="section-icon-amber">⚠️</span>
                <span>Top Risk Entities</span>
              </div>
              <button className="btn-pill" onClick={() => setPage('entities')}>
                All entities →
              </button>
            </div>

            {/* Table */}
            <div className="entities-table">
              <div className="entities-thead">
                <div className="col-entity">Entity</div>
                <div className="col-dept">Department</div>
                <div className="col-risk">Risk Score</div>
              </div>

              <div className="entities-tbody">
                {/* Row 1: U-008 */}
                <div className="entity-row" onClick={() => setPage('entities')}>
                  <div className="col-entity text-bold">U-008</div>
                  <div className="col-dept text-muted">finance</div>
                  <div className="col-risk risk-cell-layout">
                    <span className="risk-score-val text-red">87</span>
                    <div className="mini-risk-bar-track">
                      <div className="mini-risk-bar-fill fill-red" style={{ width: '87%' }} />
                    </div>
                    <span className="row-chevron">›</span>
                  </div>
                </div>

                {/* Row 2: U-009 */}
                <div className="entity-row" onClick={() => setPage('entities')}>
                  <div className="col-entity text-bold">U-009</div>
                  <div className="col-dept text-muted">finance</div>
                  <div className="col-risk risk-cell-layout">
                    <span className="risk-score-val text-coral">74</span>
                    <div className="mini-risk-bar-track">
                      <div className="mini-risk-bar-fill fill-coral" style={{ width: '74%' }} />
                    </div>
                    <span className="row-chevron">›</span>
                  </div>
                </div>

                {/* Row 3: U-021 */}
                <div className="entity-row" onClick={() => setPage('entities')}>
                  <div className="col-entity text-bold">U-021</div>
                  <div className="col-dept text-muted">sales</div>
                  <div className="col-risk risk-cell-layout">
                    <span className="risk-score-val text-orange">68</span>
                    <div className="mini-risk-bar-track">
                      <div className="mini-risk-bar-fill fill-orange" style={{ width: '68%' }} />
                    </div>
                    <span className="row-chevron">›</span>
                  </div>
                </div>

                {/* Row 4: U-014 */}
                <div className="entity-row" onClick={() => setPage('entities')}>
                  <div className="col-entity text-bold">U-014</div>
                  <div className="col-dept text-muted">hr</div>
                  <div className="col-risk risk-cell-layout">
                    <span className="risk-score-val text-amber">55</span>
                    <div className="mini-risk-bar-track">
                      <div className="mini-risk-bar-fill fill-amber" style={{ width: '55%' }} />
                    </div>
                    <span className="row-chevron">›</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail modal if alert clicked */}
      {localSelectedAlert && (
        <AlertDetail alert={localSelectedAlert} onClose={() => setLocalSelectedAlert(null)} />
      )}
    </div>
  )
}
