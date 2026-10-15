import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAlerts, fetchEntities, fetchHealth } from '../api.js'
import { MOCK_ALERTS, MOCK_ENTITIES, MOCK_HEALTH } from '../mockData.js'
import AlertCard, { AlertDetail } from '../components/AlertCard.jsx'
import { formatBytes } from '../utils.js'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts'

const METHODS_LABELS = {
  A_threshold:      { label: 'A · Threshold', color: 'var(--risk-high)' },
  B_iso_raw:        { label: 'B · Raw IF',     color: 'var(--risk-review)' },
  C_baselines_only: { label: 'C · Baselines',  color: 'var(--accent-blue)' },
  D_full_fusion:    { label: 'D · CipherSentinel', color: 'var(--accent-green)' },
}

function StatCard({ label, value, sub, variant }) {
  return (
    <div className={`stat-card ${variant || ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function MiniF1Chart({ compareData }) {
  if (!compareData?.results) return null
  const data = Object.entries(compareData.results).map(([key, val]) => ({
    name: METHODS_LABELS[key]?.label || key,
    f1: +(val.f1 * 100).toFixed(1),
    precision: +(val.precision * 100).toFixed(1),
    recall: +(val.recall * 100).toFixed(1),
    color: METHODS_LABELS[key]?.color || 'var(--accent-blue)',
  }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,158,255,0.08)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--text-2)', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
        <Tooltip
          contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'var(--text-0)' }}
          itemStyle={{ color: 'var(--text-1)' }}
        />
        <Bar dataKey="f1" name="F1 Score" fill="var(--accent-blue)" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function Dashboard({ setPage, setSelectedAlert }) {
  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchAlerts(false),
    refetchInterval: 2000,
    placeholderData: { alerts: MOCK_ALERTS, total: MOCK_ALERTS.length },
  })

  const { data: entitiesData } = useQuery({
    queryKey: ['entities'],
    queryFn: fetchEntities,
    placeholderData: { entities: MOCK_ENTITIES },
  })

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 5000,
    placeholderData: MOCK_HEALTH,
  })

  const [selectedAlert, setLocalSelected] = useState(null)

  const alerts = alertsData?.alerts || MOCK_ALERTS
  const entities = entitiesData?.entities || MOCK_ENTITIES

  const highCount   = alerts.filter(a => a.severity === 'high').length
  const reviewCount = alerts.filter(a => a.severity === 'review').length
  const totalOut    = entities.reduce((s, e) => s + (e.total_out_gb || 0), 0)

  // recent 5 alerts for dashboard
  const recentAlerts = alerts.slice(0, 5)

  // entity risk distribution
  const riskDist = [
    { label: 'High', count: entities.filter(e => e.max_risk >= 70).length, color: 'var(--risk-high)' },
    { label: 'Review', count: entities.filter(e => e.max_risk >= 40 && e.max_risk < 70).length, color: 'var(--risk-review)' },
    { label: 'Clean', count: entities.filter(e => e.max_risk < 40).length, color: 'var(--accent-green)' },
  ]

  return (
    <div>
      <h1 className="page-title">Security Dashboard</h1>
      <p className="page-subtitle">
        Real-time insider exfiltration risk from TLS metadata · MITRE ATT&CK T1567
      </p>

      {/* Stats row */}
      <div className="stats-grid">
        <StatCard label="High Alerts" value={highCount} sub="Immediate review" variant="high" />
        <StatCard label="Review Alerts" value={reviewCount} sub="Investigate" variant="review" />
        <StatCard label="Entities Monitored" value={entities.length} sub="Pseudonymous users" variant="ok" />
        <StatCard label="Total Outbound" value={`${totalOut.toFixed(1)} GB`} sub="30-day window" />
        <StatCard label="Payload Bytes Read" value="0" sub="Metadata only 🔒" variant="ok" />
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Recent alerts */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🚨 Recent Alerts</div>
            <button id="btn-view-all-alerts" className="btn btn-sm btn-secondary" onClick={() => setPage('alerts')}>
              View all
            </button>
          </div>
          {recentAlerts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <div className="empty-title">No alerts</div>
              <div>System is quiet</div>
            </div>
          ) : (
            <div className="alert-list">
              {recentAlerts.map(a => (
                <AlertCard key={a.id} alert={a} onClick={() => setLocalSelected(a)} />
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Entity risk distribution */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">👤 Entity Risk Distribution</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {riskDist.map(r => (
                <div key={r.label} style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '12px 8px',
                  borderRadius: 8,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: r.color, fontFamily: 'var(--font-mono)' }}>{r.count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>{r.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top risky entities */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">⚠️ Top Risk Entities</div>
              <button id="btn-view-entities" className="btn btn-sm btn-secondary" onClick={() => setPage('entities')}>
                All entities
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entities.filter(e => e.max_risk > 0).slice(0, 5).map(e => (
                <div key={e.entity} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-0)', minWidth: 56 }}>{e.entity}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', flex: 1 }}>{e.role}</div>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: e.max_risk >= 70 ? 'var(--risk-high)' : e.max_risk >= 40 ? 'var(--risk-review)' : 'var(--risk-info)',
                  }}>{e.max_risk}</div>
                  {/* Mini bar */}
                  <div style={{ width: 60, height: 4, borderRadius: 99, background: 'var(--bg-3)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${e.max_risk}%`,
                      background: e.max_risk >= 70 ? 'var(--risk-high)' : e.max_risk >= 40 ? 'var(--risk-review)' : 'var(--risk-info)',
                      borderRadius: 99,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>⚡ Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button id="btn-start-replay-dashboard" className="btn btn-primary" onClick={() => setPage('replay')}>
                ▶ Start Scenario Replay
              </button>
              <button id="btn-view-compare-dashboard" className="btn btn-secondary" onClick={() => setPage('compare')}>
                ⚖ Compare Methods
              </button>
              <button id="btn-view-limits-dashboard" className="btn btn-secondary" onClick={() => setPage('limits')}>
                🔍 System Limits
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Evidence modal */}
      {selectedAlert && (
        <AlertDetail alert={selectedAlert} onClose={() => setLocalSelected(null)} />
      )}
    </div>
  )
}
