import React from 'react'

export default function Sidebar({ page, setPage, alertCounts }) {
  const highCount = alertCounts?.high ?? 2

  const nav = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: 'alerts',
      label: 'Alerts',
      badge: highCount > 0 ? highCount : null,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      ),
    },
    {
      id: 'replay',
      label: 'Replay',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="14" x="3" y="5" rx="2" />
          <polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      id: 'entities',
      label: 'Entities',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'compare',
      label: 'Compare',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      id: 'limits',
      label: 'Limits',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
  ]

  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      {/* Brand logo & header */}
      <div className="sidebar-brand" onClick={() => setPage('dashboard')} style={{ cursor: 'pointer' }}>
        <div className="sidebar-logo-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6V12C4 17.5 7.5 22 12 23C16.5 22 20 17.5 20 12V6L12 2Z" fill="#1C382B" />
            <path d="M12 4.5L6 7.5V12C6 16.2 8.6 19.8 12 20.7C15.4 19.8 18 16.2 18 12V7.5L12 4.5Z" stroke="#4ADE80" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M9 12L11 14L15 10" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="sidebar-title">CipherSentinel</div>
          <div className="sidebar-subtitle">Insider Threat Intelligence</div>
        </div>
      </div>

      {/* Navigation menu */}
      <div className="sidebar-nav">
        {nav.map(item => {
          const isActive = page === item.id
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.badge ? <span className="sidebar-nav-badge">{item.badge}</span> : null}
            </button>
          )
        })}
      </div>

      {/* Bottom Security Info Card */}
      <div className="sidebar-promo-card">
        <div className="sidebar-promo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#1C382B" />
            <path d="M9 12l2 2 4-4" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="sidebar-promo-title">CipherSentinel v1.0</div>
        <div className="sidebar-promo-subtitle">
          <div>MITRE ATT&CK T1567</div>
          <div>Metadata analysis only</div>
        </div>
      </div>
    </aside>
  )
}
