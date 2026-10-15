import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from '../api.js'
import { MOCK_HEALTH } from '../mockData.js'

export default function TopBar({ page, setPage }) {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      try { return await fetchHealth() }
      catch { return MOCK_HEALTH }
    },
    refetchInterval: 5000,
    placeholderData: MOCK_HEALTH,
  })

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const now = new Date()

  return (
    <header className="topbar" role="banner">
      <div className="topbar-logo" onClick={() => setPage('dashboard')} style={{ cursor: 'pointer' }}>
        <div className="topbar-logo-icon">🛡️</div>
        <div>
          <div className="topbar-title">CipherSentinel</div>
          <div className="topbar-subtitle">Insider Threat Intelligence</div>
        </div>
      </div>

      <div className="topbar-spacer" />

      {/* Live clock */}
      <div style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
        {now.toLocaleTimeString()}
      </div>

      {/* Privacy badge */}
      <div className="privacy-badge" title="Zero payload bytes are inspected">
        <div className="privacy-dot" />
        Payload bytes inspected: {health?.payload_bytes_inspected ?? 0}
      </div>

      {/* Backend status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: health?.status === 'ok' ? 'var(--accent-green)' : 'var(--risk-review)',
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: health?.status === 'ok' ? 'var(--accent-green)' : 'var(--risk-review)',
          boxShadow: health?.status === 'ok' ? '0 0 6px var(--accent-green)' : 'none',
          display: 'inline-block',
        }} />
        {health?.status === 'ok' ? 'API Connected' : 'Demo Mode'}
      </div>
    </header>
  )
}
