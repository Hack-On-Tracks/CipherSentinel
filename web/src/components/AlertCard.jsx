import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postFeedback } from '../api.js'
import { severityClass, formatBytes, formatWindow, signalLabel, categoryTag } from '../utils.js'

function RiskMeter({ risk, severity }) {
  return (
    <div>
      <div className="risk-meter">
        <div
          className={`risk-fill ${severity}`}
          style={{ width: `${risk}%` }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
        <span>0</span><span>INFO</span><span style={{ color: 'var(--risk-review)' }}>REVIEW</span>
        <span style={{ color: 'var(--risk-high)' }}>HIGH</span><span>100</span>
      </div>
    </div>
  )
}

export default function AlertCard({ alert, expanded = false, onClick }) {
  const sc = severityClass(alert.severity)
  const cat = categoryTag(alert.destination?.category)

  return (
    <div
      id={`alert-card-${alert.id}`}
      className={`alert-card ${sc} animate-slide-in`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
      aria-label={`Alert ${alert.id}: ${alert.entity} risk ${alert.risk}`}
    >
      <div className="alert-header">
        <div>
          <div className="alert-entity">{alert.entity}</div>
          <div className="alert-role">{alert.role} · {formatWindow(alert.window)}</div>
        </div>
        <div className="risk-badge">
          <div className={`risk-score ${sc}`}>{alert.risk}</div>
          <div className={`severity-pill ${sc}`}>
            <span>{sc === 'high' ? '🔴' : sc === 'review' ? '🟡' : '🟢'}</span>
            {alert.severity}
          </div>
        </div>
      </div>

      <div className="alert-dest">
        <span style={{ color: 'var(--text-2)' }}>→</span>
        <span>{alert.destination?.sni || '—'}</span>
        <span className={`dest-tag ${alert.destination?.category}`}>{cat.label}</span>
        {alert.destination?.first_seen_for_user && (
          <span className="dest-tag" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-cyan)', borderColor: 'rgba(0,212,255,0.2)' }}>
            New for user
          </span>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
        📤 {formatBytes(alert.out_mb * 1e6)} outbound
      </div>

      <RiskMeter risk={alert.risk} severity={sc} />

      <div className="signal-bars">
        {alert.signals?.filter(s => s.points > 0).map(s => (
          <div key={s.name} className="signal-pill">
            <span>{signalLabel(s.name)}</span>
            <span className="pts">+{s.points.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AlertDetail({ alert, onClose }) {
  const qc = useQueryClient()
  const [feedbackSent, setFeedbackSent] = useState(null)

  const mutation = useMutation({
    mutationFn: ({ verdict }) => postFeedback(alert.id, verdict),
    onSuccess: (_, vars) => {
      setFeedbackSent(vars.verdict)
      qc.invalidateQueries(['alerts'])
    },
  })

  const sc = severityClass(alert.severity)
  const cat = categoryTag(alert.destination?.category)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Evidence card for ${alert.entity}`}>
        {/* Header */}
        <div className="evidence-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                EVIDENCE CARD · {alert.id}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-0)', letterSpacing: -0.5, marginBottom: 4 }}>
                {alert.entity}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                {alert.role} · {formatWindow(alert.window)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={`risk-score ${sc}`} style={{ fontSize: 36, marginBottom: 4 }}>{alert.risk}</div>
              <div className={`severity-pill ${sc}`}>
                {sc === 'high' ? '🔴' : '🟡'} {alert.severity}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-1)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>→ <strong style={{ color: 'var(--text-0)', fontFamily: 'var(--font-mono)' }}>{alert.destination?.sni}</strong></span>
            <span className={`dest-tag ${alert.destination?.category}`}>{cat.label}</span>
            {alert.destination?.first_seen_for_user && <span className="dest-tag" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-cyan)', borderColor: 'rgba(0,212,255,0.2)' }}>🆕 First contact</span>}
          </div>
        </div>

        <div className="evidence-body">
          {/* Risk meter */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Risk Score
            </div>
            <div className="risk-meter" style={{ height: 12 }}>
              <div className={`risk-fill ${sc}`} style={{ width: `${alert.risk}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
              <span>0</span><span style={{ color: 'var(--risk-review)' }}>40 Review</span>
              <span style={{ color: 'var(--risk-high)' }}>70 High</span><span>100</span>
            </div>
          </div>

          {/* Signal breakdown */}
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Signal Breakdown
          </div>
          {alert.signals?.map(s => (
            <div key={s.name} className="signal-row">
              <div className="signal-name">{signalLabel(s.name)}</div>
              <div className="pts-num">+{s.points?.toFixed(1)}</div>
              <div className="signal-detail">{s.detail}</div>
            </div>
          ))}

          {/* Explainable AI (SHAP TreeExplainer) */}
          {alert.shap_explanation && alert.shap_explanation.length > 0 && (
            <div style={{
              marginTop: 18,
              padding: '12px 14px',
              background: 'rgba(0, 212, 255, 0.05)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🧠</span>
                  <span>Explainable AI · SHAP TreeExplainer</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  Local Feature Attribution
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alert.shap_explanation.map((item, idx) => {
                  const impactVal = item.impact || 0;
                  const isPositive = impactVal >= 0;
                  const maxImpact = Math.max(...alert.shap_explanation.map(x => Math.abs(x.impact || 0)), 0.1);
                  const barWidth = Math.min(100, Math.max(12, Math.round((Math.abs(impactVal) / maxImpact) * 100)));

                  return (
                    <div key={idx} style={{ fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ color: 'var(--text-1)' }}>{item.label}</span>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          color: isPositive ? 'var(--risk-high)' : 'var(--accent-green)'
                        }}>
                          {isPositive ? '+' : ''}{impactVal.toFixed(3)}
                        </span>
                      </div>
                      <div style={{
                        height: 5,
                        background: 'rgba(255,255,255,0.08)',
                        borderRadius: 3,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${barWidth}%`,
                          background: isPositive
                            ? 'linear-gradient(90deg, #ff9f43, #ff4757)'
                            : 'linear-gradient(90deg, #00d2d3, #2ed573)',
                          borderRadius: 3,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommended action */}

          <div style={{
            marginTop: 20,
            padding: '14px 16px',
            background: sc === 'high' ? 'rgba(255,71,87,0.08)' : 'rgba(255,165,2,0.08)',
            border: `1px solid ${sc === 'high' ? 'rgba(255,71,87,0.2)' : 'rgba(255,165,2,0.2)'}`,
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: sc === 'high' ? 'var(--risk-high)' : 'var(--risk-review)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Recommended Action
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5 }}>
              {alert.recommended_action}
            </div>
          </div>

          {/* Analyst feedback */}
          <div className="feedback-row">
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginRight: 'auto', alignSelf: 'center' }}>
              Analyst feedback:
            </div>
            {feedbackSent ? (
              <div style={{ fontSize: 12, color: 'var(--accent-green)' }}>
                ✓ Recorded: {feedbackSent.replace('_', ' ')}
              </div>
            ) : (
              <>
                <button
                  id={`btn-tp-${alert.id}`}
                  className="btn btn-sm btn-danger"
                  onClick={() => mutation.mutate({ verdict: 'true_positive' })}
                  disabled={mutation.isPending}
                >
                  🎯 True Positive
                </button>
                <button
                  id={`btn-fp-${alert.id}`}
                  className="btn btn-sm btn-secondary"
                  onClick={() => mutation.mutate({ verdict: 'false_positive' })}
                  disabled={mutation.isPending}
                >
                  ✓ False Positive
                </button>
              </>
            )}
            <button id={`btn-close-${alert.id}`} className="btn btn-sm btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}
