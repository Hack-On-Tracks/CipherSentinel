import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

const ENTITIES_DATA = [
  {
    id: 'U-008',
    name: 'U-008',
    sub: 'finance',
    type: 'User',
    department: 'Finance',
    risk: 87,
    alertsCount: 5,
    lastActivity: '2026-03-12 02:00',
    status: 'High',
    statusClass: 'status-high',
    avatar: 'U',
    isIcon: false,
    avatarClass: 'avatar-user',
    typeClass: 'pill-type-user',
    topDests: [
      { name: 'mega.nz', bytes: '400 MB', barClass: 'fill-red', width: '85%' },
      { name: 'drive.google.com', bytes: '250 MB', barClass: 'fill-orange', width: '55%' },
    ],
  },
  {
    id: 'U-014',
    name: 'U-014',
    sub: 'hr',
    type: 'User',
    department: 'Human Resources',
    risk: 55,
    alertsCount: 3,
    lastActivity: '2026-03-15 10:00',
    status: 'Review',
    statusClass: 'status-review',
    avatar: 'U',
    isIcon: false,
    avatarClass: 'avatar-user',
    typeClass: 'pill-type-user',
    topDests: [
      { name: 'wetransfer.com', bytes: '40 MB', barClass: 'fill-amber', width: '40%' },
    ],
  },
  {
    id: 'U-009',
    name: 'U-009',
    sub: 'finance',
    type: 'User',
    department: 'Finance',
    risk: 74,
    alertsCount: 4,
    lastActivity: '2026-03-22 14:15',
    status: 'High',
    statusClass: 'status-high',
    avatar: 'U',
    isIcon: false,
    avatarClass: 'avatar-user',
    typeClass: 'pill-type-user',
    topDests: [
      { name: 'drive.google.com', bytes: '250 MB', barClass: 'fill-orange', width: '60%' },
    ],
  },
  {
    id: 'Laptop-01',
    name: 'Laptop-01',
    sub: 'Engineering',
    type: 'Device',
    department: 'Engineering',
    risk: 32,
    alertsCount: 1,
    lastActivity: '2026-03-10 18:20',
    status: 'Low',
    statusClass: 'status-low',
    avatar: 'laptop',
    isIcon: true,
    avatarClass: 'avatar-device',
    typeClass: 'pill-type-device',
    topDests: [
      { name: 'github.com', bytes: '1.2 GB', barClass: 'fill-green', width: '70%' },
    ],
  },
  {
    id: 'EC2-Server',
    name: 'EC2-Server',
    sub: 'Prod Environment',
    type: 'Device',
    department: 'Production',
    risk: 28,
    alertsCount: 0,
    lastActivity: '2026-03-09 11:45',
    status: 'Low',
    statusClass: 'status-low',
    avatar: 'server',
    isIcon: true,
    avatarClass: 'avatar-device',
    typeClass: 'pill-type-device',
    topDests: [
      { name: 'aws.amazon.com', bytes: '5.4 GB', barClass: 'fill-green', width: '80%' },
    ],
  },
  {
    id: 'mega.nz',
    name: 'mega.nz',
    sub: 'File Sharing',
    type: 'Destination',
    department: 'External Service',
    risk: 67,
    alertsCount: 6,
    lastActivity: '2026-03-12 02:00',
    status: 'High',
    statusClass: 'status-high',
    avatar: 'globe',
    isIcon: true,
    avatarClass: 'avatar-dest',
    typeClass: 'pill-type-dest',
    topDests: [
      { name: 'U-008', bytes: '400 MB', barClass: 'fill-red', width: '80%' },
    ],
  },
  {
    id: 'wetransfer.com',
    name: 'wetransfer.com',
    sub: 'File Transfer',
    type: 'Destination',
    department: 'External Service',
    risk: 48,
    alertsCount: 3,
    lastActivity: '2026-03-15 10:00',
    status: 'Review',
    statusClass: 'status-review',
    avatar: 'globe',
    isIcon: true,
    avatarClass: 'avatar-dest',
    typeClass: 'pill-type-dest',
    topDests: [
      { name: 'U-014', bytes: '40 MB', barClass: 'fill-amber', width: '35%' },
    ],
  },
  {
    id: 'drive.google.com',
    name: 'drive.google.com',
    sub: 'Cloud Storage',
    type: 'Destination',
    department: 'Authorized Storage',
    risk: 72,
    alertsCount: 5,
    lastActivity: '2026-03-22 14:15',
    status: 'High',
    statusClass: 'status-high',
    avatar: 'globe',
    isIcon: true,
    avatarClass: 'avatar-dest',
    typeClass: 'pill-type-dest',
    topDests: [
      { name: 'U-009', bytes: '250 MB', barClass: 'fill-orange', width: '65%' },
    ],
  },
]

const ACTIVITY_TREND_DATA = [
  { date: 'Mar 1', gb: 0.8 },
  { date: 'Mar 4', gb: 1.4 },
  { date: 'Mar 8', gb: 2.3 },
  { date: 'Mar 11', gb: 1.7 },
  { date: 'Mar 15', gb: 1.1 },
  { date: 'Mar 18', gb: 1.6 },
  { date: 'Mar 22', gb: 2.6 },
  { date: 'Mar 26', gb: 1.4 },
  { date: 'Mar 30', gb: 1.7 },
]

export default function EntitiesPage() {
  const [selectedEntityId, setSelectedEntityId] = useState('U-008')
  const [activeTab, setActiveTab] = useState('all') // 'all', 'users', 'devices', 'destinations'
  const [searchQuery, setSearchQuery] = useState('')
  const [panelTab, setPanelTab] = useState('overview') // 'overview', 'activity', 'alerts', 'related'

  const selectedEntity = ENTITIES_DATA.find(e => e.id === selectedEntityId) || ENTITIES_DATA[0]

  const filteredEntities = ENTITIES_DATA.filter(e => {
    if (activeTab === 'users' && e.type !== 'User') return false
    if (activeTab === 'devices' && e.type !== 'Device') return false
    if (activeTab === 'destinations' && e.type !== 'Destination') return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return e.name.toLowerCase().includes(q) || e.sub.toLowerCase().includes(q)
    }
    return true
  })

  const renderAvatar = (entity) => {
    if (!entity.isIcon) {
      return <span className="entity-avatar-text">{entity.avatar}</span>
    }
    if (entity.avatar === 'laptop') {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="12" x="3" y="4" rx="2" />
          <line x1="2" y1="20" x2="22" y2="20" />
        </svg>
      )
    }
    if (entity.avatar === 'server') {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
          <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
      )
    }
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    )
  }

  return (
    <div className="entities-page-container">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="entities-page-header">
        <h1 className="entities-title">Entities</h1>
        <p className="entities-subtitle">Monitor and analyse users, devices and destinations for potential insider threats.</p>
      </div>

      {/* ── 4 KPI Metric Cards ───────────────────────────────────────────── */}
      <div className="entities-kpi-grid">
        <div className="kpi-card" onClick={() => setActiveTab('all')}>
          <div className="kpi-icon-box kpi-icon-green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Entities</div>
            <div className="kpi-value text-green">6</div>
            <div className="kpi-sub">Monitored users</div>
          </div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('users')}>
          <div className="kpi-icon-box kpi-icon-blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="12" x="3" y="4" rx="2" />
              <line x1="2" y1="20" x2="22" y2="20" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">User Entities</div>
            <div className="kpi-value">4</div>
            <div className="kpi-sub">Active users</div>
          </div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('devices')}>
          <div className="kpi-icon-box kpi-icon-purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
              <rect x="6" y="14" width="12" height="8" rx="1" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Device Entities</div>
            <div className="kpi-value">2</div>
            <div className="kpi-sub">Active devices</div>
          </div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('destinations')}>
          <div className="kpi-icon-box kpi-icon-amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Destination Entities</div>
            <div className="kpi-value">8</div>
            <div className="kpi-sub">Unique domains</div>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout ───────────────────────────────────────── */}
      <div className="entities-content-grid">
        {/* Left Column: Table & Filters */}
        <div className="entities-left-panel">
          {/* Filter Tabs & Search Bar Row */}
          <div className="entities-filter-row">
            <div className="entities-tabs">
              <button
                className={`entity-tab-btn ${activeTab === 'all' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All Entities
              </button>
              <button
                className={`entity-tab-btn ${activeTab === 'users' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                Users
              </button>
              <button
                className={`entity-tab-btn ${activeTab === 'devices' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('devices')}
              >
                Devices
              </button>
              <button
                className={`entity-tab-btn ${activeTab === 'destinations' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('destinations')}
              >
                Destinations
              </button>
            </div>

            <div className="entities-controls">
              <div className="entities-search-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, type, domain..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="select-pill">
                <span>⇅ Risk Score</span>
                <span className="select-chevron">⌵</span>
              </div>

              <div className="select-pill">
                <span>🗂️ All Types</span>
                <span className="select-chevron">⌵</span>
              </div>
            </div>
          </div>

          {/* Entities Table */}
          <div className="entities-table-card">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ENTITY</th>
                  <th>TYPE</th>
                  <th>RISK SCORE ↕</th>
                  <th>ALERTS ↕</th>
                  <th>LAST ACTIVITY ↕</th>
                  <th>STATUS ↕</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntities.map(e => {
                  const isSelected = selectedEntityId === e.id
                  const riskColor = e.risk >= 70 ? 'text-red' : e.risk >= 40 ? 'text-amber' : 'text-green'

                  return (
                    <tr
                      key={e.id}
                      className={isSelected ? 'row-selected' : ''}
                      onClick={() => setSelectedEntityId(e.id)}
                    >
                      <td>
                        <div className="entity-cell">
                          <div className={`entity-avatar-circle ${e.avatarClass}`}>
                            {renderAvatar(e)}
                          </div>
                          <div>
                            <div className="entity-primary-name">{e.name}</div>
                            <div className="entity-sub-name">{e.sub}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`entity-type-badge ${e.typeClass}`}>
                          {e.type === 'User' ? '👤 ' : e.type === 'Device' ? '💻 ' : '🌐 '}
                          {e.type}
                        </span>
                      </td>
                      <td>
                        <span className={`table-risk-val ${riskColor}`}>{e.risk}</span>
                      </td>
                      <td>
                        <span className="table-alerts-count">{e.alertsCount}</span>
                      </td>
                      <td>
                        <span className="table-meta-text">{e.lastActivity}</span>
                      </td>
                      <td>
                        <span className={`table-status-pill ${e.statusClass}`}>
                          ● {e.status}
                        </span>
                      </td>
                      <td>
                        <button className="table-more-btn" type="button" onClick={ev => ev.stopPropagation()}>
                          ···
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Entity Profile Sidebar Panel */}
        <div className="entity-detail-panel">
          <div className="detail-panel-header">
            <div className="detail-header-left">
              <div className="detail-avatar-circle">
                {selectedEntity.name.slice(0, 1)}
              </div>
              <div>
                <div className="detail-entity-name">{selectedEntity.name}</div>
                <div className="detail-entity-sub">{selectedEntity.sub}</div>
              </div>
            </div>
            <span className="detail-high-badge">
              {selectedEntity.status} Risk
            </span>
          </div>

          {/* Panel Navigation Tabs */}
          <div className="detail-tabs">
            <button
              className={`detail-tab-btn ${panelTab === 'overview' ? 'tab-active' : ''}`}
              onClick={() => setPanelTab('overview')}
            >
              Overview
            </button>
            <button
              className={`detail-tab-btn ${panelTab === 'activity' ? 'tab-active' : ''}`}
              onClick={() => setPanelTab('activity')}
            >
              Activity
            </button>
            <button
              className={`detail-tab-btn ${panelTab === 'alerts' ? 'tab-active' : ''}`}
              onClick={() => setPanelTab('alerts')}
            >
              Alerts ({selectedEntity.alertsCount})
            </button>
            <button
              className={`detail-tab-btn ${panelTab === 'related' ? 'tab-active' : ''}`}
              onClick={() => setPanelTab('related')}
            >
              Related Entities
            </button>
          </div>

          {/* Metadata Information List */}
          <div className="detail-info-list">
            <div className="detail-info-row">
              <span className="info-row-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Type
              </span>
              <span className="info-row-value">{selectedEntity.type}</span>
            </div>

            <div className="detail-info-row">
              <span className="info-row-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Department
              </span>
              <span className="info-row-value">{selectedEntity.department}</span>
            </div>

            <div className="detail-info-row">
              <span className="info-row-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="22" y1="12" x2="18" y2="12" />
                  <line x1="6" y1="12" x2="2" y2="12" />
                </svg>
                Risk Score
              </span>
              <span className="info-row-value text-red">{selectedEntity.risk}</span>
            </div>

            <div className="detail-info-row">
              <span className="info-row-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                Total Alerts
              </span>
              <span className="info-row-value">{selectedEntity.alertsCount}</span>
            </div>

            <div className="detail-info-row">
              <span className="info-row-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Last Activity
              </span>
              <span className="info-row-value">{selectedEntity.lastActivity}</span>
            </div>
          </div>

          {/* Activity Trend Chart */}
          <div className="detail-chart-section">
            <div className="detail-chart-header">
              <span className="detail-chart-title">Activity Trend (Last 30 days)</span>
              <div className="select-pill" style={{ padding: '2px 8px', fontSize: 11 }}>
                <span>Bytes Out</span>
                <span className="select-chevron">⌵</span>
              </div>
            </div>

            <div style={{ height: 115, marginTop: 10 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ACTIVITY_TREND_DATA} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="entityTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#8C9B92', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={{ fill: '#8C9B92', fontSize: 10 }} tickFormatter={v => (v === 0 ? '0' : `${v} GB`)} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${v} GB`, 'Outbound']} contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 11 }} />
                  <Area type="monotone" dataKey="gb" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#entityTrendGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Destinations */}
          <div className="detail-dest-section">
            <div className="detail-dest-header">
              <span className="detail-dest-title">Top Destinations</span>
              <button className="dest-view-all-btn" type="button">
                View all →
              </button>
            </div>

            <div className="detail-dest-list">
              {selectedEntity.topDests.map(d => (
                <div key={d.name} className="dest-item-row">
                  <div className="dest-item-left">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <span className="dest-item-name">{d.name}</span>
                  </div>
                  <div className="dest-item-right">
                    <div className="dest-bar-track">
                      <div className={`dest-bar-fill ${d.barClass}`} style={{ width: d.width }} />
                    </div>
                    <span className="dest-item-bytes">{d.bytes}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
