import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAlerts } from '../api.js'
import { MOCK_ALERTS } from '../mockData.js'
import AlertCard, { AlertDetail } from '../components/AlertCard.jsx'

const SEVERITY_OPTS = ['All', 'high', 'review', 'info']
const ROLE_OPTS = ['All', 'finance', 'hr', 'sales', 'engineer', 'executive']

export default function AlertsPage() {
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchAlerts(false),
    refetchInterval: 2000,
    placeholderData: { alerts: MOCK_ALERTS, total: MOCK_ALERTS.length },
  })

  const [selectedAlert, setSelectedAlert] = useState(null)
  const [severityFilter, setSeverityFilter] = useState('All')
  const [roleFilter, setRoleFilter] = useState('All')
  const [search, setSearch] = useState('')

  const alerts = alertsData?.alerts || MOCK_ALERTS

  const filtered = alerts.filter(a => {
    if (severityFilter !== 'All' && a.severity !== severityFilter) return false
    if (roleFilter !== 'All' && a.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!a.entity.toLowerCase().includes(q) && !a.destination?.sni?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const highCount   = alerts.filter(a => a.severity === 'high').length
  const reviewCount = alerts.filter(a => a.severity === 'review').length

  return (
    <div>
      <h1 className="page-title">🚨 Alerts</h1>
      <p className="page-subtitle">
        All flagged entity windows · newest first · {alerts.length} total
      </p>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="severity-pill high">{highCount} High</div>
        <div className="severity-pill review">{reviewCount} Review</div>
        <div className="severity-pill info">{alerts.length - highCount - reviewCount} Info</div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar">
          <span style={{ color: 'var(--text-3)' }}>🔍</span>
          <input
            id="alerts-search"
            placeholder="Search entity or SNI…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {SEVERITY_OPTS.map(s => (
            <button
              key={s}
              id={`filter-severity-${s.toLowerCase()}`}
              className={`btn btn-sm ${severityFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSeverityFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <select
          id="filter-role"
          className="scenario-select"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          {ROLE_OPTS.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <div className="empty-title">No matching alerts</div>
          <div>Try adjusting your filters</div>
        </div>
      ) : (
        <div className="alert-list">
          {filtered.map(a => (
            <AlertCard key={a.id} alert={a} onClick={() => setSelectedAlert(a)} />
          ))}
        </div>
      )}

      {selectedAlert && (
        <AlertDetail alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </div>
  )
}
