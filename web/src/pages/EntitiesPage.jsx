import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEntities, fetchTimeline } from '../api.js'
import { MOCK_ENTITIES } from '../mockData.js'
import { formatBytes } from '../utils.js'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

function EntityTimeline({ entityId, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['timeline', entityId],
    queryFn: () => fetchTimeline(entityId),
  })

  const points = data?.timeline || []
  const baselineMb = (data?.baseline_out_bytes || 0) / 1e6

  // sample down to last 200 points for chart performance
  const sample = points.length > 200 ? points.filter((_, i) => i % Math.ceil(points.length / 200) === 0) : points
  const chartData = sample.map(p => ({
    t:       p.window?.slice(5, 16) || '',
    out_mb:  +(p.out_mb || 0).toFixed(2),
    in_mb:   +(p.in_mb || 0).toFixed(2),
    exfil:   p.has_exfil ? (p.out_mb || 0) : null,
  }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
        <div className="timeline-user-header">
          <div className="user-avatar">{entityId.slice(-2)}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-0)', fontFamily: 'var(--font-mono)' }}>{entityId}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Outbound traffic timeline vs baseline</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button id={`btn-close-timeline-${entityId}`} className="btn btn-sm btn-secondary" onClick={onClose}>✕ Close</button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <div className="chart-legend">
                  <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--accent-blue)' }} />Outbound MB</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--accent-green)' }} />Inbound MB</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--risk-high)' }} />Exfiltration event</div>
                  <div className="legend-item" style={{ marginLeft: 'auto' }}>
                    <div style={{ width: 24, height: 2, background: 'var(--risk-review)', borderTop: '2px dashed var(--risk-review)' }} />
                    Baseline median
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,158,255,0.07)" />
                  <XAxis dataKey="t" tick={{ fill: 'var(--text-3)', fontSize: 9 }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-2)', fontSize: 10 }} axisLine={false} tickLine={false} unit=" MB" />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-0)' }}
                    itemStyle={{ color: 'var(--text-1)' }}
                  />
                  {baselineMb > 0 && (
                    <ReferenceLine y={baselineMb} stroke="var(--risk-review)" strokeDasharray="4 2" label={{ value: 'Baseline', fill: 'var(--risk-review)', fontSize: 9 }} />
                  )}
                  <Area type="monotone" dataKey="in_mb" name="Inbound" stroke="var(--accent-green)" fill="url(#gradIn)" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="out_mb" name="Outbound" stroke="var(--accent-blue)" fill="url(#gradOut)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="exfil" name="Exfil event" stroke="var(--risk-high)" fill="var(--risk-high-glow)" strokeWidth={2} dot={{ r: 4, fill: 'var(--risk-high)' }} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>

              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12, textAlign: 'center' }}>
                Showing last {chartData.length} data points · 15-minute windows
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const ROLE_COLORS = {
  engineer:  'var(--accent-blue)',
  finance:   'var(--risk-review)',
  hr:        'var(--accent-green)',
  sales:     'var(--accent-purple)',
  executive: 'var(--accent-cyan)',
}

export default function EntitiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['entities'],
    queryFn: fetchEntities,
    placeholderData: { entities: MOCK_ENTITIES },
  })

  const [selected, setSelected] = useState(null)
  const [sortBy, setSortBy] = useState('max_risk')
  const [roleFilter, setRoleFilter] = useState('All')

  const entities = (data?.entities || MOCK_ENTITIES)
    .filter(e => roleFilter === 'All' || e.role === roleFilter)
    .sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0))

  const roles = ['All', ...new Set(MOCK_ENTITIES.map(e => e.role))]

  return (
    <div>
      <h1 className="page-title">👤 Entities</h1>
      <p className="page-subtitle">
        All monitored users with outbound volume and risk scores · click a row to view the traffic timeline
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select id="filter-role-entities" className="scenario-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          {roles.map(r => <option key={r}>{r}</option>)}
        </select>
        <select id="sort-entities" className="scenario-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="max_risk">Sort: Max Risk</option>
          <option value="alert_count">Sort: Alert Count</option>
          <option value="total_out_gb">Sort: Outbound GB</option>
        </select>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="table-wrap">
          <table aria-label="Entities table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Role</th>
                <th>Total Out</th>
                <th>Alerts</th>
                <th>Max Risk</th>
                <th>Risk Bar</th>
                <th>Timeline</th>
              </tr>
            </thead>
            <tbody>
              {entities.map(e => {
                const riskCol = e.max_risk >= 70 ? 'var(--risk-high)' : e.max_risk >= 40 ? 'var(--risk-review)' : 'var(--risk-info)'
                return (
                  <tr key={e.entity} onClick={() => setSelected(e.entity)} style={{ cursor: 'pointer' }}>
                    <td className="td-mono td-bold">{e.entity}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'var(--bg-2)',
                        color: ROLE_COLORS[e.role] || 'var(--text-1)',
                        fontSize: 11,
                        fontWeight: 600,
                      }}>{e.role}</span>
                    </td>
                    <td className="td-mono">{e.total_out_gb?.toFixed(2)} GB</td>
                    <td>
                      <span style={{ color: e.alert_count > 0 ? 'var(--risk-high)' : 'var(--text-2)', fontWeight: 700 }}>
                        {e.alert_count}
                      </span>
                    </td>
                    <td>
                      <span className="td-mono" style={{ color: riskCol, fontWeight: 700, fontSize: 15 }}>{e.max_risk}</span>
                    </td>
                    <td style={{ width: 100 }}>
                      <div style={{ width: 80, height: 6, borderRadius: 99, background: 'var(--bg-3)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${e.max_risk}%`,
                          background: riskCol,
                          borderRadius: 99,
                          transition: 'width 0.5s',
                        }} />
                      </div>
                    </td>
                    <td>
                      <button
                        id={`btn-timeline-${e.entity}`}
                        className="btn btn-sm btn-secondary"
                        onClick={(ev) => { ev.stopPropagation(); setSelected(e.entity) }}
                      >
                        📈 View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && <EntityTimeline entityId={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
