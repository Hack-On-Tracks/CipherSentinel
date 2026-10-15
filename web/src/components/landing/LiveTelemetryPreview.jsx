import React, { useState } from 'react'
import { Activity, ShieldAlert, ArrowRight, Clock, Globe } from '../icons/LucideIcons.jsx'
import { MOCK_ALERTS } from '../../mockData.js'

export default function LiveTelemetryPreview({ onLaunchDashboard }) {
  const [selectedAlertId, setSelectedAlertId] = useState(MOCK_ALERTS[0].id)

  const activeAlert = MOCK_ALERTS.find((a) => a.id === selectedAlertId) || MOCK_ALERTS[0]

  return (
    <section id="telemetry" className="telemetry-preview-section" aria-labelledby="telemetry-title">
      <div className="section-container">
        
        {/* Header */}
        <div className="section-header-center">
          <div className="section-eyebrow">
            <span className="eyebrow-bullet">●</span>
            <span>LIVE TELEMETRY STREAM</span>
          </div>
          <h2 id="telemetry-title" className="section-title">
            Interactive Alert Intelligence Feed
          </h2>
          <p className="section-subtitle">
            Experience real-time scored alerts generated from continuous 15-minute entity windows. Click any alert to inspect its five-signal evidence payload.
          </p>
        </div>

        {/* Two Column Preview Grid */}
        <div className="telemetry-feed-grid">
          
          {/* Left: Feed List */}
          <div className="telemetry-feed-column">
            <div className="feed-header-bar">
              <span className="feed-status-dot" />
              <span className="feed-title-tag">Scored Alert Stream (30-Day Dataset)</span>
            </div>

            <div className="feed-items-list">
              {MOCK_ALERTS.map((alert) => {
                const isSelected = alert.id === selectedAlertId
                return (
                  <div
                    key={alert.id}
                    className={`feed-item-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedAlertId(alert.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="feed-item-top">
                      <div className="feed-entity-info">
                        <span className="feed-id-badge">{alert.id}</span>
                        <span className="feed-entity-name">{alert.entity}</span>
                        <span className="feed-role-tag">{alert.role}</span>
                      </div>
                      <span className={`feed-risk-pill risk-${alert.severity}`}>
                        Risk {alert.risk}
                      </span>
                    </div>

                    <div className="feed-item-meta">
                      <span>{alert.out_mb} MB Outbound</span>
                      <span>•</span>
                      <span>{alert.destination.sni}</span>
                      <span>•</span>
                      <span>{alert.window}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Selected Alert Evidence Breakdown */}
          <div className="telemetry-evidence-column">
            <div className="evidence-panel-card">
              <div className="evidence-header">
                <div>
                  <span className="evidence-entity-lead">Evidence Dossier: {activeAlert.entity}</span>
                  <h3 className="evidence-title">
                    {activeAlert.out_mb} MB to {activeAlert.destination.sni}
                  </h3>
                </div>
                <div className="evidence-risk-badge">
                  <span className="risk-num">{activeAlert.risk}</span>
                  <span className="risk-scale">/ 100</span>
                </div>
              </div>

              {/* Destination Risk Tag */}
              <div className="evidence-dest-box">
                <Globe size={18} color="#064E3B" />
                <span className="dest-sni">{activeAlert.destination.sni}</span>
                <span className="dest-cat-tag">{activeAlert.destination.category}</span>
                {activeAlert.destination.first_seen_for_user && (
                  <span className="dest-novelty-pill">First Contact for Entity</span>
                )}
              </div>

              {/* Signal Points Distribution */}
              <div className="signals-evidence-list">
                <span className="signals-evidence-title">Five-Signal Score Attribution:</span>
                {activeAlert.signals.map((sig, i) => (
                  <div key={i} className="signal-evidence-row">
                    <div className="sig-evidence-left">
                      <span className="sig-emo">{sig.icon}</span>
                      <span className="sig-lbl">{sig.label}</span>
                    </div>
                    <div className="sig-evidence-right">
                      <span className="sig-detail-text">{sig.detail}</span>
                      <span className="sig-pts-badge">+{sig.points} pts</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommended Action */}
              <div className="evidence-rec-box">
                <span className="rec-box-tag">SOC Recommendation:</span>
                <p className="rec-box-text">{activeAlert.recommended_action}</p>
              </div>

              {/* Button to Dashboard */}
              <button
                type="button"
                className="btn-inspect-full-console"
                onClick={onLaunchDashboard}
              >
                <span>Open Full Investigation Console</span>
                <ArrowRight size={16} strokeWidth={2.2} />
              </button>
            </div>
          </div>

        </div>

      </div>
    </section>
  )
}
