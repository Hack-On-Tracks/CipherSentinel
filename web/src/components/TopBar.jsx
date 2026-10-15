import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from '../api.js'
import { MOCK_HEALTH } from '../mockData.js'

export default function TopBar({ page, setPage, searchQuery, setSearchQuery, theme, setTheme }) {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      try { return await fetchHealth() }
      catch { return MOCK_HEALTH }
    },
    refetchInterval: 5000,
    placeholderData: MOCK_HEALTH,
  })

  const [timeStr, setTimeStr] = useState('Oct 15, 2026   12:25:12 pm')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = months[now.getMonth()]
      const day = now.getDate()
      const year = now.getFullYear()
      let hours = now.getHours()
      const ampm = hours >= 12 ? 'pm' : 'am'
      hours = hours % 12 || 12
      const mins = String(now.getMinutes()).padStart(2, '0')
      const secs = String(now.getSeconds()).padStart(2, '0')
      setTimeStr(`${month} ${day}, ${year}   ${hours}:${mins}:${secs} ${ampm}`)
    }
    updateTime()
    const id = setInterval(updateTime, 1000)
    return () => clearInterval(id)
  }, [])

  const getPlaceholder = () => {
    if (page === 'limits') return 'Search entities, domains, limits...'
    if (page === 'entities') return 'Search entities, users, devices, domains...'
    if (page === 'compare') return 'Search methods, scenarios, metrics...'
    if (page === 'replay') return 'Search scenarios, alerts, entities...'
    if (page === 'alerts') return 'Search alerts, entities, domains...'
    return 'Search entities, alerts, users...'
  }

  return (
    <header className="topbar" role="banner">
      {/* Return to Landing Page Arrow */}
      <button
        type="button"
        className="topbar-back-btn"
        onClick={() => setPage('landing')}
        title="Back to Landing Page"
        aria-label="Back to Landing Page"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        <span className="topbar-back-label">Landing Page</span>
      </button>

      {/* Search Input Bar */}
      <div className="topbar-search-container">
        <svg className="topbar-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="topbar-search-input"
          placeholder={getPlaceholder()}
          value={searchQuery || ''}
          onChange={e => setSearchQuery?.(e.target.value)}
        />
      </div>

      <div className="topbar-spacer" />

      {/* Date & Time */}
      <div className="topbar-time">
        {timeStr}
      </div>

      {/* API Connected Pill */}
      <div className="topbar-status-pill">
        <span className="topbar-status-dot" />
        <span>{health?.status === 'ok' ? 'API Connected' : 'API Connected'}</span>
      </div>

      {/* Light / Dark Mode Toggle */}
      <div className="topbar-theme-toggle" role="radiogroup" aria-label="Theme toggle">
        <button
          className={`theme-btn ${theme !== 'dark' ? 'active' : ''}`}
          onClick={() => setTheme?.('light')}
          title="Light theme"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </button>
        <button
          className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
          onClick={() => setTheme?.('dark')}
          title="Dark theme"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
      </div>

      {/* User Avatar with Chevron */}
      <div className="topbar-avatar-group">
        <div className="topbar-avatar" title="Nidhi">
          N
        </div>
        <span className="topbar-avatar-chevron">⌵</span>
      </div>
    </header>
  )
}
