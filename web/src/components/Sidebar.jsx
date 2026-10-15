export default function Sidebar({ page, setPage, alertCounts }) {
  const highCount = alertCounts?.high ?? 0

  const nav = [
    { id: 'dashboard',  icon: '📊', label: 'Dashboard' },
    { id: 'alerts',     icon: '🚨', label: 'Alerts',   badge: highCount > 0 ? highCount : null },
    { id: 'replay',     icon: '▶️',  label: 'Replay' },
    { id: 'entities',   icon: '👤', label: 'Entities' },
    { id: 'compare',    icon: '⚖️',  label: 'Compare' },
    { id: 'limits',     icon: '🔍', label: 'Limits' },
  ]

  return (
    <nav className="sidebar" role="navigation" aria-label="Main navigation">
      <div className="nav" style={{ marginTop: 8 }}>
        <div className="nav-section-label">Navigation</div>
        {nav.map(item => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            onClick={() => setPage(item.id)}
            aria-current={page === item.id ? 'page' : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* Version footer */}
      <div style={{ padding: '16px 12px', marginTop: 'auto', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>CipherSentinel v1.0</div>
          <div>MITRE ATT&CK T1567</div>
          <div>Metadata analysis only</div>
        </div>
      </div>
    </nav>
  )
}
