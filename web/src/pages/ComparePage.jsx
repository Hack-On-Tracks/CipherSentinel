import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const PERFORMANCE_DATA = [
  { name: 'A - Threshold', precision: 33.3, recall: 40.0, f1: 36.4 },
  { name: 'B - Raw IF', precision: 33.3, recall: 60.0, f1: 42.9 },
  { name: 'C - Baselines Only', precision: 66.7, recall: 80.0, f1: 72.7 },
  { name: 'D - CipherSentinel', precision: 83.3, recall: 100.0, f1: 90.9 },
]

const DAYS_TO_ALERT_DATA = [
  { name: 'A - Threshold', s2: 0, s2Missed: true, s3: 5 },
  { name: 'B - Raw IF', s2: 20, s2Missed: false, s3: 4 },
  { name: 'C - Baselines Only', s2: 10, s2Missed: false, s3: 3 },
  { name: 'D - CipherSentinel', s2: 5, s2Missed: false, s3: 2 },
]

const DETAILED_METRICS_DATA = [
  {
    method: 'A - Threshold',
    dotColor: '#EF4444',
    tp: 2,
    fp: 4,
    fn: 3,
    tn: 900,
    precision: '33.3%',
    precColor: 'text-red',
    recall: '40.0%',
    f1: '36.4%',
    faUserWk: '0.44',
    daysS2: 'X Missed',
    s2Color: 'text-red',
    daysS3: '12',
  },
  {
    method: 'B - Raw IF',
    dotColor: '#F59E0B',
    tp: 3,
    fp: 6,
    fn: 2,
    tn: 898,
    precision: '33.3%',
    precColor: 'text-red',
    recall: '60.0%',
    f1: '42.9%',
    faUserWk: '0.67',
    daysS2: '20',
    s2Color: '',
    daysS3: '8',
  },
  {
    method: 'C - Baselines Only',
    dotColor: '#3B82F6',
    tp: 4,
    fp: 2,
    fn: 1,
    tn: 902,
    precision: '66.7%',
    precColor: 'text-coral',
    recall: '80.0%',
    f1: '72.7%',
    faUserWk: '0.22',
    daysS2: '10',
    s2Color: '',
    daysS3: '5',
  },
  {
    method: 'D - CipherSentinel',
    dotColor: '#10B981',
    tp: 5,
    fp: 1,
    fn: 0,
    tn: 903,
    precision: '83.3%',
    precColor: 'text-green',
    recall: '100.0%',
    recColor: 'text-green',
    f1: '90.9%',
    f1Color: 'text-green',
    faUserWk: '0.11',
    faColor: 'text-green',
    daysS2: '5',
    s2Color: 'text-green',
    daysS3: '3',
    s3Color: 'text-green',
  },
]

export default function ComparePage() {
  const [dateFilter, setDateFilter] = useState('Last 30 days')
  const [scenarioFilter, setScenarioFilter] = useState('All Scenarios')

  return (
    <div className="compare-page-container">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="compare-page-header">
        <div>
          <h1 className="compare-title">Compare Methods</h1>
          <p className="compare-subtitle">Compare different detection approaches across key metrics and scenarios.</p>
        </div>

        <div className="compare-header-controls">
          <div className="select-pill" style={{ padding: '8px 14px', fontSize: 12.5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{dateFilter}</span>
            <span className="select-chevron">⌵</span>
          </div>

          <div className="select-pill" style={{ padding: '8px 14px', fontSize: 12.5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
            <span>{scenarioFilter}</span>
            <span className="select-chevron">⌵</span>
          </div>
        </div>
      </div>

      {/* ── 4 Top KPI Metric Cards ───────────────────────────────────────── */}
      <div className="compare-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Best F1 Score</div>
            <div className="kpi-value text-green">90.9%</div>
            <div className="kpi-sub">D - CipherSentinel</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Highest Precision</div>
            <div className="kpi-value text-blue">83.3%</div>
            <div className="kpi-sub">D - CipherSentinel</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Highest Recall</div>
            <div className="kpi-value text-purple">100.0%</div>
            <div className="kpi-sub">D - CipherSentinel</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Lowest False Alerts</div>
            <div className="kpi-value text-orange">0.11</div>
            <div className="kpi-sub">D - CipherSentinel</div>
          </div>
        </div>
      </div>

      {/* ── Side-by-Side Comparison Charts ───────────────────────────────── */}
      <div className="compare-charts-grid">
        {/* Chart 1: Performance Comparison */}
        <div className="compare-chart-card">
          <div className="chart-header-group">
            <div className="chart-icon-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span className="compare-chart-title">Performance Comparison</span>
            </div>
            <div className="compare-chart-sub">Compare precision, recall and F1 score across different methods.</div>
          </div>

          <div style={{ height: 240, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PERFORMANCE_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F4F1" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#6B7D72', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#6B7D72', fontSize: 11 }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v, name) => [`${v}%`, name]}
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 11 }}
                />
                <Bar dataKey="precision" name="Precision" fill="#60A5FA" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="recall" name="Recall" fill="#A855F7" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="f1" name="F1" fill="#2DD4BF" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Custom Bottom Legend */}
          <div className="compare-chart-legend">
            <div className="legend-item"><span className="legend-box" style={{ background: '#60A5FA' }} />Precision</div>
            <div className="legend-item"><span className="legend-box" style={{ background: '#A855F7' }} />Recall</div>
            <div className="legend-item"><span className="legend-box" style={{ background: '#2DD4BF' }} />F1</div>
          </div>
        </div>

        {/* Chart 2: Days to First Alert */}
        <div className="compare-chart-card">
          <div className="chart-header-group">
            <div className="chart-header-flex">
              <div className="chart-icon-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="compare-chart-title">Days to First Alert</span>
              </div>
              <div className="days-legend">
                <span className="legend-item"><span className="legend-box" style={{ background: '#A7F3D0' }} />S2 (Low-and-Slow)</span>
                <span className="legend-item"><span className="legend-box" style={{ background: '#FDE68A' }} />S3 (Channel Evasion)</span>
              </div>
            </div>
            <div className="compare-chart-sub">Lower is better. <span style={{ color: '#EF4444', fontWeight: 600 }}>✕ Missed</span> = never alerted on that scenario.</div>
          </div>

          <div style={{ height: 240, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DAYS_TO_ALERT_DATA} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F4F1" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#6B7D72', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 30]} ticks={[0, 10, 20, 30]} tick={{ fill: '#6B7D72', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v, name) => [`${v} days`, name === 's2' ? 'S2' : 'S3']}
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 11 }}
                />
                <Bar
                  dataKey="s2"
                  name="S2 (Low-and-Slow)"
                  fill="#A7F3D0"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                  label={({ x, y, width, value, index }) => {
                    if (index === 0) {
                      return <text x={x + width / 2} y={y - 8} fill="#EF4444" textAnchor="middle" fontSize={11} fontWeight={700}>✕</text>
                    }
                    return <text x={x + width / 2} y={y - 8} fill="#4B5563" textAnchor="middle" fontSize={11} fontWeight={600}>{value}d</text>
                  }}
                />
                <Bar
                  dataKey="s3"
                  name="S3 (Channel Evasion)"
                  fill="#FDE68A"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                  label={({ x, y, width, value }) => (
                    <text x={x + width / 2} y={y - 8} fill="#4B5563" textAnchor="middle" fontSize={11} fontWeight={600}>{value}d</text>
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Detailed Metrics Table ───────────────────────────────────────── */}
      <div className="detailed-metrics-card">
        <div className="detailed-metrics-header">
          <div>
            <div className="detailed-title-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 8h10" />
                <path d="M7 12h10" />
                <path d="M7 16h10" />
              </svg>
              <span className="compare-chart-title">Detailed Metrics</span>
            </div>
            <div className="compare-chart-sub">Complete comparison of all methods across key evaluation metrics.</div>
          </div>

          <button className="download-report-btn" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download Report</span>
          </button>
        </div>

        <div className="compare-table-wrapper">
          <table className="custom-table compare-table">
            <thead>
              <tr>
                <th>METHOD</th>
                <th>TP</th>
                <th>FP</th>
                <th>FN</th>
                <th>TN</th>
                <th>PRECISION</th>
                <th>RECALL</th>
                <th>F1</th>
                <th>FA/USER/WK</th>
                <th>DAYS → S2</th>
                <th>DAYS → S3</th>
              </tr>
            </thead>
            <tbody>
              {DETAILED_METRICS_DATA.map((row) => (
                <tr key={row.method}>
                  <td>
                    <div className="method-cell">
                      <span className="method-dot" style={{ backgroundColor: row.dotColor }} />
                      <span className="method-name">{row.method}</span>
                    </div>
                  </td>
                  <td>{row.tp}</td>
                  <td>{row.fp}</td>
                  <td>{row.fn}</td>
                  <td>{row.tn}</td>
                  <td className={row.precColor || ''}>{row.precision}</td>
                  <td className={row.recColor || ''}>{row.recall}</td>
                  <td className={row.f1Color || ''}>{row.f1}</td>
                  <td className={row.faColor || ''}>{row.faUserWk}</td>
                  <td className={row.s2Color || ''}>{row.daysS2}</td>
                  <td className={row.s3Color || ''}>{row.daysS3}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
