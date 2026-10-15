import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const OUTBOUND_LIMITS_DATA = [
  { name: 'Users', value: 1000, label: '1 GB', fill: '#6EE7B7' },
  { name: 'Devices', value: 2000, label: '2 GB', fill: '#93C5FD' },
  { name: 'Domains', value: 500, label: '500 MB', fill: '#FDE68A' },
  { name: 'Scenarios', value: 3000, label: '3 GB', fill: '#FCA5A5' },
]

const LIMIT_RULES_DATA = [
  {
    id: 'lr-1',
    name: 'Large Upload Limit',
    iconType: 'cloud',
    type: 'Size-based',
    typeClass: 'pill-type-size',
    appliesTo: 'User',
    threshold: '1 GB / day',
    riskLevel: 'High',
    riskClass: 'status-high',
    desc: 'Flags users with daily outbound data > 1 GB',
  },
  {
    id: 'lr-2',
    name: 'After-Hours Activity',
    iconType: 'clock',
    type: 'Time-based',
    typeClass: 'pill-type-time',
    appliesTo: 'User',
    threshold: '10 PM – 6 AM',
    riskLevel: 'Review',
    riskClass: 'status-review',
    desc: 'Monitors unusual activity outside working hours',
  },
  {
    id: 'lr-3',
    name: 'Personal Cloud Domains',
    iconType: 'globe',
    type: 'Domain-based',
    typeClass: 'pill-type-domain',
    appliesTo: 'Destination',
    threshold: 'Blocklist (5 domains)',
    riskLevel: 'High',
    riskClass: 'status-high',
    desc: 'Monitors uploads to personal cloud storage',
  },
  {
    id: 'lr-4',
    name: 'Device Upload Rate',
    iconType: 'laptop',
    type: 'Rate-based',
    typeClass: 'pill-type-rate',
    appliesTo: 'Device',
    threshold: '> 100 MB/hour',
    riskLevel: 'Review',
    riskClass: 'status-review',
    desc: 'Flags sustained high upload rate from a device',
  },
  {
    id: 'lr-5',
    name: 'Multiple Destinations',
    iconType: 'wifi',
    type: 'Frequency-based',
    typeClass: 'pill-type-freq',
    appliesTo: 'User',
    threshold: '> 3 new domains/day',
    riskLevel: 'Info',
    riskClass: 'status-low',
    desc: 'Detects unusual distribution of data',
  },
]

export default function LimitsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [riskFilter, setRiskFilter] = useState('All')
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const filteredRules = LIMIT_RULES_DATA.filter(r => {
    if (typeFilter !== 'All' && r.type !== typeFilter) return false
    if (riskFilter !== 'All' && r.riskLevel !== riskFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)
    }
    return true
  })

  const renderRuleIcon = (type) => {
    if (type === 'cloud') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        </svg>
      )
    }
    if (type === 'clock') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    }
    if (type === 'globe') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )
    }
    if (type === 'laptop') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect width="18" height="12" x="3" y="4" rx="2" />
          <line x1="2" y1="20" x2="22" y2="20" />
        </svg>
      )
    }
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    )
  }

  return (
    <div className="limits-page-container">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="limits-page-header">
        <div>
          <h1 className="limits-title">Limits</h1>
          <p className="limits-subtitle">
            View and manage detection thresholds, risk limits and monitoring rules for different scenarios and entity types.
          </p>
        </div>

        <button
          className="how-it-works-btn"
          type="button"
          onClick={() => setShowHowItWorks(v => !v)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
          </svg>
          <span>How it works?</span>
        </button>
      </div>

      {showHowItWorks && (
        <div className="how-it-works-panel animate-slide-in">
          <div className="panel-header">
            <strong>How Limits & Thresholds Operate in CipherSentinel</strong>
            <button className="panel-close-btn" onClick={() => setShowHowItWorks(false)}>✕</button>
          </div>
          <p>
            CipherSentinel limits evaluate multiple orthogonal vectors: volumetric egress anomalies (Size-based), sustained velocity (Rate-based), temporal boundaries (Time-based), and novelty fan-out (Frequency-based). Threshold violations feed into ensemble scoring without decrypting payload traffic.
          </p>
        </div>
      )}

      {/* ── 4 Top KPI Metric Cards ───────────────────────────────────────── */}
      <div className="limits-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Limit Rules</div>
            <div className="kpi-value">12</div>
            <div className="kpi-sub">Across all scenarios</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">User Limits</div>
            <div className="kpi-value">4</div>
            <div className="kpi-sub">Per-user thresholds</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="12" x="3" y="4" rx="2" />
              <line x1="2" y1="20" x2="22" y2="20" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Device Limits</div>
            <div className="kpi-value">3</div>
            <div className="kpi-sub">Per-device thresholds</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Destination Limits</div>
            <div className="kpi-value">5</div>
            <div className="kpi-sub">Domain / service rules</div>
          </div>
        </div>
      </div>

      {/* ── Middle Row: 3 Visual Analysis Cards ──────────────────────────── */}
      <div className="limits-visual-grid">
        {/* Card 1: Outbound Data Limits */}
        <div className="limits-card">
          <div className="limits-card-header">
            <div className="limits-card-title-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span className="limits-card-title">Outbound Data Limits</span>
            </div>
            <div className="limits-card-sub">Configured outbound thresholds by entity type.</div>
          </div>

          <div style={{ height: 180, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={OUTBOUND_LIMITS_DATA} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F4F1" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#6B7D72', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 3000]}
                  ticks={[0, 500, 1000, 2000, 3000]}
                  tick={{ fill: '#6B7D72', fontSize: 10 }}
                  tickFormatter={v => (v === 0 ? '0 MB' : v < 1000 ? `${v} MB` : `${v / 1000} GB`)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v, _, item) => [item.payload.label, 'Limit']}
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 11 }}
                />
                <Bar
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  barSize={32}
                  label={({ x, y, width, index }) => (
                    <text
                      x={x + width / 2}
                      y={y - 8}
                      fill="#1F2937"
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={700}
                    >
                      {OUTBOUND_LIMITS_DATA[index].label}
                    </text>
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: Threshold Distribution */}
        <div className="limits-card">
          <div className="limits-card-header">
            <div className="limits-card-title-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="limits-card-title">Threshold Distribution</span>
            </div>
            <div className="limits-card-sub">Distribution of limit types in the system.</div>
          </div>

          <div className="donut-chart-layout" style={{ marginTop: 14 }}>
            <div className="donut-chart-container">
              <svg width="116" height="116" viewBox="0 0 120 120">
                {/* 12 total: 5 size (42%), 3 rate (25%), 2 time (17%), 2 freq (16%) */}
                {/* Circumference = 2 * PI * 44 ≈ 276.46 */}
                {/* Size: 42% = 116 */}
                <circle
                  cx="60" cy="60" r="44"
                  fill="transparent"
                  stroke="#10B981"
                  strokeWidth="14"
                  strokeDasharray="116 276.46"
                  strokeDashoffset="0"
                  transform="rotate(-90 60 60)"
                />
                {/* Rate: 25% = 69 */}
                <circle
                  cx="60" cy="60" r="44"
                  fill="transparent"
                  stroke="#3B82F6"
                  strokeWidth="14"
                  strokeDasharray="69 276.46"
                  strokeDashoffset="-116"
                  transform="rotate(-90 60 60)"
                />
                {/* Time: 17% = 47 */}
                <circle
                  cx="60" cy="60" r="44"
                  fill="transparent"
                  stroke="#F59E0B"
                  strokeWidth="14"
                  strokeDasharray="47 276.46"
                  strokeDashoffset="-185"
                  transform="rotate(-90 60 60)"
                />
                {/* Freq: 16% = 44 */}
                <circle
                  cx="60" cy="60" r="44"
                  fill="transparent"
                  stroke="#EF4444"
                  strokeWidth="14"
                  strokeDasharray="44 276.46"
                  strokeDashoffset="-232"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="donut-center-text">
                <span className="donut-center-num">12</span>
                <span className="donut-center-label">Total Rules</span>
              </div>
            </div>

            <div className="donut-legend" style={{ gap: 10 }}>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: '#10B981' }} />
                <span className="legend-label" style={{ minWidth: 90 }}>Size-based</span>
                <span className="legend-val">5 (42%)</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: '#3B82F6' }} />
                <span className="legend-label" style={{ minWidth: 90 }}>Rate-based</span>
                <span className="legend-val">3 (25%)</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: '#F59E0B' }} />
                <span className="legend-label" style={{ minWidth: 90 }}>Time-based</span>
                <span className="legend-val">2 (17%)</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: '#EF4444' }} />
                <span className="legend-label" style={{ minWidth: 90 }}>Frequency-based</span>
                <span className="legend-val">2 (16%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Risk Level Mapping */}
        <div className="limits-card">
          <div className="limits-card-header">
            <div className="limits-card-title-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span className="limits-card-title">Risk Level Mapping</span>
            </div>
            <div className="limits-card-sub">How limit breaches are classified.</div>
          </div>

          <div className="risk-mapping-list">
            <div className="risk-mapping-item">
              <span className="table-status-pill status-high" style={{ minWidth: 78, justifyContent: 'center' }}>
                ● High Risk
              </span>
              <div className="risk-mapping-text">
                <div className="risk-mapping-title">Severe deviation from limit</div>
                <div className="risk-mapping-sub">Immediate review required</div>
              </div>
            </div>

            <div className="risk-mapping-item">
              <span className="table-status-pill status-review" style={{ minWidth: 78, justifyContent: 'center' }}>
                ● Review
              </span>
              <div className="risk-mapping-text">
                <div className="risk-mapping-title">Moderate deviation from limit</div>
                <div className="risk-mapping-sub">Needs analyst review</div>
              </div>
            </div>

            <div className="risk-mapping-item">
              <span className="table-status-pill status-low" style={{ minWidth: 78, justifyContent: 'center' }}>
                ● Info
              </span>
              <div className="risk-mapping-text">
                <div className="risk-mapping-title">Slight deviation from limit</div>
                <div className="risk-mapping-sub">Monitor for patterns</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Card: Limit Rules Table ───────────────────────────────── */}
      <div className="limit-rules-card">
        <div className="limit-rules-header">
          <div>
            <div className="limit-rules-title-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span className="limit-rules-title">Limit Rules</span>
            </div>
            <div className="limit-rules-sub">Manage and view all configured limits and thresholds.</div>
          </div>

          <div className="limit-rules-controls">
            <div className="entities-search-box" style={{ width: 170 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search rules..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="select-pill">
              <span>🗂️ Types</span>
              <span className="select-chevron">⌵</span>
            </div>

            <div className="select-pill">
              <span>🗂️ All Risk Levels</span>
              <span className="select-chevron">⌵</span>
            </div>

            <button className="add-rule-btn" type="button" onClick={() => setShowAddModal(true)}>
              + Add Limit Rule
            </button>
          </div>
        </div>

        <div className="entities-table-card" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>TYPE</th>
                <th>APPLIES TO</th>
                <th>THRESHOLD</th>
                <th>RISK LEVEL</th>
                <th>DESCRIPTION</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map(rule => (
                <tr key={rule.id}>
                  <td>
                    <div className="rule-name-cell">
                      <span className="rule-icon">{renderRuleIcon(rule.iconType)}</span>
                      <span className="rule-name-text">{rule.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`rule-type-badge ${rule.typeClass}`}>
                      {rule.type}
                    </span>
                  </td>
                  <td>
                    <span className="rule-applies-text">{rule.appliesTo}</span>
                  </td>
                  <td>
                    <span className="rule-threshold-text">{rule.threshold}</span>
                  </td>
                  <td>
                    <span className={`table-status-pill ${rule.riskClass}`}>
                      ● {rule.riskLevel}
                    </span>
                  </td>
                  <td>
                    <span className="rule-desc-text">{rule.desc}</span>
                  </td>
                  <td>
                    <div className="rule-actions-cell">
                      <button className="rule-action-icon-btn" type="button" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button className="table-more-btn" type="button">
                        ···
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Limit Rule Modal (if clicked) */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="evidence-header">
              <div style={{ fontSize: 18, fontWeight: 800 }}>Create New Limit Rule</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Configure detection rule parameters</div>
            </div>
            <div className="evidence-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Rule Name</label>
                <input className="modal-input" placeholder="e.g. Excessive Bulk Sync" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Rule Type</label>
                <select className="modal-input">
                  <option>Size-based</option>
                  <option>Rate-based</option>
                  <option>Time-based</option>
                  <option>Frequency-based</option>
                  <option>Domain-based</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Threshold</label>
                <input className="modal-input" placeholder="e.g. 500 MB / hour" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => setShowAddModal(false)}>Save Rule</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
