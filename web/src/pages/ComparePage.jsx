import { useQuery } from '@tanstack/react-query'
import { fetchCompare } from '../api.js'
import { MOCK_COMPARE } from '../mockData.js'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

const METHODS_META = {
  A_threshold:      { label: 'A · Threshold',      short: 'A',  color: '#ff4757' },
  B_iso_raw:        { label: 'B · Raw IF',          short: 'B',  color: '#ffa502' },
  C_baselines_only: { label: 'C · Baselines Only',  short: 'C',  color: '#4f9eff' },
  D_full_fusion:    { label: 'D · CipherSentinel',  short: 'D',  color: '#22d3a5' },
}

function bestValue(results, metric, higherIsBetter = true) {
  let best = null, bestKey = null
  for (const [key, val] of Object.entries(results)) {
    const v = val[metric]
    if (v == null) continue
    if (best == null || (higherIsBetter ? v > best : v < best)) {
      best = v; bestKey = key
    }
  }
  return bestKey
}

export default function ComparePage() {
  const { data: cmpData } = useQuery({
    queryKey: ['compare'],
    queryFn: fetchCompare,
    placeholderData: MOCK_COMPARE,
  })

  const results = cmpData?.results || MOCK_COMPARE.results
  const methods = cmpData?.methods || MOCK_COMPARE.methods

  const metrics = ['precision', 'recall', 'f1']
  const bestPrec   = bestValue(results, 'precision')
  const bestRecall = bestValue(results, 'recall')
  const bestF1     = bestValue(results, 'f1')
  const bestFAPUW  = bestValue(results, 'false_alerts_per_user_per_week', false)

  // Radar data
  const radarData = metrics.map(m => {
    const row = { metric: m.toUpperCase() }
    for (const [key, val] of Object.entries(results)) {
      row[key] = +(val[m] * 100).toFixed(1)
    }
    return row
  })

  // F1 bar data
  const f1Data = Object.entries(results).map(([key, val]) => ({
    name: METHODS_META[key]?.label || key,
    F1:   +(val.f1 * 100).toFixed(1),
    Precision: +(val.precision * 100).toFixed(1),
    Recall: +(val.recall * 100).toFixed(1),
  }))

  // Days to first alert for S3
  const daysData = ['A_threshold', 'B_iso_raw', 'C_baselines_only', 'D_full_fusion'].map(key => ({
    name: METHODS_META[key]?.label || key,
    S3:   results[key]?.days_to_first_S3 ?? null,
    S5:   results[key]?.days_to_first_S5 ?? null,
  }))

  return (
    <div>
      <h1 className="page-title">⚖ Method Comparison</h1>
      <p className="page-subtitle">
        Four detection methods evaluated on identical labelled event streams
      </p>

      {/* Caveat */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(255,165,2,0.08)',
        border: '1px solid rgba(255,165,2,0.2)',
        borderRadius: 10,
        fontSize: 12,
        color: 'var(--risk-review)',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        ⚠️ {cmpData?.caveat || MOCK_COMPARE.caveat}
      </div>

      {/* Method descriptions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {Object.entries(methods).map(([key, desc]) => (
          <div key={key} style={{
            padding: '12px 14px',
            background: 'var(--bg-glass)',
            border: `1px solid ${METHODS_META[key]?.color}33`,
            borderRadius: 10,
            borderLeft: `3px solid ${METHODS_META[key]?.color}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: METHODS_META[key]?.color, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Method {METHODS_META[key]?.short}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.4 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Main metrics table */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">📊 Performance Metrics</div>
        </div>
        <div className="table-wrap">
          <table aria-label="Comparison metrics table">
            <thead>
              <tr>
                <th>Method</th>
                <th>TP</th><th>FP</th><th>FN</th><th>TN</th>
                <th>Precision</th><th>Recall</th><th>F1</th>
                <th>FA/User/Wk</th>
                <th>Days→S3</th>
                <th>Days→S5</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(results).map(([key, val]) => {
                const meta = METHODS_META[key]
                return (
                  <tr key={key}>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta?.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: key === 'D_full_fusion' ? 700 : 400, color: key === 'D_full_fusion' ? 'var(--accent-green)' : 'var(--text-0)', fontSize: 12 }}>
                          {meta?.label || key}
                        </span>
                      </span>
                    </td>
                    <td className="td-mono" style={{ color: 'var(--accent-green)' }}>{val.TP}</td>
                    <td className="td-mono" style={{ color: val.FP > 2 ? 'var(--risk-high)' : 'var(--text-1)' }}>{val.FP}</td>
                    <td className="td-mono" style={{ color: val.FN > 0 ? 'var(--risk-review)' : 'var(--text-1)' }}>{val.FN}</td>
                    <td className="td-mono">{val.TN}</td>
                    <td className={key === bestPrec ? 'compare-winner td-mono' : 'compare-loser td-mono'}>
                      {(val.precision * 100).toFixed(1)}%
                    </td>
                    <td className={key === bestRecall ? 'compare-winner td-mono' : 'td-mono'}>
                      {(val.recall * 100).toFixed(1)}%
                    </td>
                    <td className={key === bestF1 ? 'compare-winner td-mono' : 'td-mono'}>
                      {(val.f1 * 100).toFixed(1)}%
                    </td>
                    <td className={key === bestFAPUW ? 'compare-winner td-mono' : 'td-mono'}>
                      {val.false_alerts_per_user_per_week}
                    </td>
                    <td className="td-mono" style={{ color: val.days_to_first_S3 == null ? 'var(--risk-high)' : val.days_to_first_S3 < 10 ? 'var(--accent-green)' : 'var(--text-1)' }}>
                      {val.days_to_first_S3 != null ? val.days_to_first_S3 : '✗ Missed'}
                    </td>
                    <td className="td-mono" style={{ color: val.days_to_first_S5 == null ? 'var(--risk-high)' : val.days_to_first_S5 < 5 ? 'var(--accent-green)' : 'var(--text-1)' }}>
                      {val.days_to_first_S5 != null ? val.days_to_first_S5 : '✗ Missed'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        {/* F1 bar chart */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>📈 F1 / Precision / Recall</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={f1Data} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,158,255,0.07)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fill: 'var(--text-2)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--text-0)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Precision" fill="#4f9eff" radius={[2,2,0,0]} />
              <Bar dataKey="Recall"    fill="#8b5cf6" radius={[2,2,0,0]} />
              <Bar dataKey="F1"        fill="#22d3a5" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Days to first alert */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>⏱ Days to First Alert</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.4 }}>
            Lower = better. <strong style={{ color: 'var(--risk-high)' }}>✗ Missed</strong> = never alerted on that scenario.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(results).map(([key, val]) => {
              const meta = METHODS_META[key]
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                  <div style={{ width: 110, color: 'var(--text-1)', fontWeight: key === 'D_full_fusion' ? 700 : 400 }}>
                    {meta?.label}
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <span style={{ fontSize: 10, color: 'var(--text-3)' }}>S3: </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        color: val.days_to_first_S3 == null ? 'var(--risk-high)' : val.days_to_first_S3 < 6 ? 'var(--accent-green)' : 'var(--text-1)',
                        fontWeight: 700,
                      }}>
                        {val.days_to_first_S3 != null ? `${val.days_to_first_S3}d` : '✗'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: 'var(--text-3)' }}>S5: </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        color: val.days_to_first_S5 == null ? 'var(--risk-high)' : val.days_to_first_S5 < 4 ? 'var(--accent-green)' : 'var(--text-1)',
                        fontWeight: 700,
                      }}>
                        {val.days_to_first_S5 != null ? `${val.days_to_first_S5}d` : '✗'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
