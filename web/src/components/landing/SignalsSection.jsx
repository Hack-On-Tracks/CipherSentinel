import React, { useState } from 'react'
import { Sliders, ShieldAlert, CheckCircle2, Activity, ArrowRight } from '../icons/LucideIcons.jsx'

export default function SignalsSection({ onLaunchDashboard }) {
  // Interactive Weights and Sliders
  const [signalValues, setSignalValues] = useState({
    self: 80,
    dest: 75,
    iso: 70,
    peer: 65,
    leak: 40,
  })

  const signalsMeta = [
    {
      id: 'self',
      weight: 20,
      title: 'Self-Baseline Deviation',
      formula: 'Robust z-score via median / MAD',
      desc: 'Compares the entity’s current 15-min egress volume against their 30-day personal baseline median and spread.',
      icon: '📊',
    },
    {
      id: 'dest',
      weight: 15,
      title: 'Destination Policy & Novelty',
      formula: 'Category risk + domain novelty score',
      desc: 'Evaluates target SNI risk (personal storage like mega.nz, file drops like wetransfer.com, vs corporate cloud storage).',
      icon: '🎯',
    },
    {
      id: 'iso',
      weight: 40,
      title: 'Isolation Forest Anomaly',
      formula: 'Multivariate tree isolation score (0-1)',
      desc: 'Unsupervised ML model trained on 17 window features covering byte volume and direction, user/peer deviation, destination and port novelty, JA4 rarity, timing, duration, and cumulative behavior.',
      icon: '🌲',
    },
    {
      id: 'peer',
      weight: 15,
      title: 'Peer-Group Cohort Deviation',
      formula: 'Z-score relative to role cohort',
      desc: 'Benchmarks activity against departmental peers (Finance, HR, Engineering, Sales) to avoid false positives on heavy roles.',
      icon: '👥',
    },
    {
      id: 'leak',
      weight: 10,
      title: 'Slow-Leak Accumulator',
      formula: '7-day rolling window transfer',
      desc: 'Detects stealthy, low-volume exfiltration spread across multiple days that evades per-flow burst thresholds.',
      icon: '☁️',
    },
  ]

  // Calculate composite score
  const totalScore = Math.round(
    (signalValues.self * 0.20) +
    (signalValues.dest * 0.15) +
    (signalValues.iso * 0.40) +
    (signalValues.peer * 0.15) +
    (signalValues.leak * 0.10)
  )

  let severity = 'info'
  let severityLabel = 'Low Risk (Info)'
  let actionText = 'Normal activity pattern. Telemetry logged; no SOC escalation needed.'

  if (totalScore >= 70) {
    severity = 'high'
    severityLabel = 'Critical Risk (High)'
    actionText = 'Escalate to SOC analyst immediately; confirm with manager before account disruption.'
  } else if (totalScore >= 40) {
    severity = 'review'
    severityLabel = 'Moderate Risk (Review)'
    actionText = 'Queue for security analyst review; monitor secondary flows for persistent beaconing.'
  }

  const applyPreset = (preset) => {
    if (preset === 's1') {
      setSignalValues({ self: 95, dest: 90, iso: 88, peer: 75, leak: 60 })
    } else if (preset === 's2') {
      setSignalValues({ self: 45, dest: 70, iso: 50, peer: 55, leak: 85 })
    } else if (preset === 's3') {
      setSignalValues({ self: 70, dest: 80, iso: 95, peer: 65, leak: 45 })
    } else if (preset === 's4') {
      setSignalValues({ self: 25, dest: 10, iso: 20, peer: 20, leak: 10 })
    }
  }

  return (
    <section id="signals" className="signals-section" aria-labelledby="signals-title">
      <div className="section-container">
        
        {/* Header */}
        <div className="section-header-center">
          <div className="section-eyebrow">
            <span className="eyebrow-bullet">●</span>
            <span>DETECTION METHODOLOGY</span>
          </div>
          <h2 id="signals-title" className="section-title">
            The Five-Signal Fusion Engine
          </h2>
          <p className="section-subtitle">
            Rather than relying on noisy static thresholds or unexplainable black-box AI, CipherSentinel correlates five distinct behavioral signals to produce a calibrated 0–100 threat score.
          </p>
        </div>

        {/* Interactive Simulator Grid */}
        <div className="signals-interactive-grid">
          
          {/* Left Column: Signal Sliders & Weights */}
          <div className="signals-sliders-column">
            <div className="signals-column-heading">
              <span className="column-title">Calibrated Signal Weights</span>
              <span className="column-subtitle">Adjust the sliders to test the live scoring formula</span>
            </div>

            <div className="sliders-list">
              {signalsMeta.map((s) => (
                <div key={s.id} className="signal-slider-card">
                  <div className="signal-slider-header">
                    <div className="signal-title-wrap">
                      <span className="signal-icon">{s.icon}</span>
                      <div>
                        <span className="signal-name">{s.title}</span>
                        <span className="signal-formula">{s.formula}</span>
                      </div>
                    </div>
                    <div className="signal-weight-badge">
                      <span>Weight: {s.weight}%</span>
                    </div>
                  </div>

                  <p className="signal-desc-text">{s.desc}</p>

                  <div className="slider-control-row">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={signalValues[s.id]}
                      onChange={(e) =>
                        setSignalValues({
                          ...signalValues,
                          [s.id]: Number(e.target.value),
                        })
                      }
                      className="signal-range-input"
                      aria-label={`${s.title} intensity`}
                    />
                    <span className="slider-val-tag">{signalValues[s.id]}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Presets Bar */}
            <div className="presets-bar">
              <span className="presets-label">Load Synthetic Scenarios:</span>
              <div className="presets-buttons-wrap">
                <button
                  type="button"
                  className="btn-preset"
                  onClick={() => applyPreset('s2')}
                >
                  S1: Off-Hours Burst Exfiltration
                </button>
                <button
                  type="button"
                  className="btn-preset"
                  onClick={() => applyPreset('s3')}
                >
                  S2: Low-and-Slow Leak
                </button>
                <button
                  type="button"
                  className="btn-preset"
                  onClick={() => applyPreset('s1')}
                >
                  S3: Rare Client + Port Evasion
                </button>
                <button
                  type="button"
                  className="btn-preset"
                  onClick={() => applyPreset('s4')}
                >
                  S4: Legitimate Engineering Release
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Composite Score Card */}
          <div className="signals-score-column">
            <div className={`score-display-card score-theme-${severity}`}>
              <div className="score-card-header">
                <span className="score-card-tag">COMPOSITE RISK CALCULATION</span>
                <span className={`severity-pill severity-${severity}`}>
                  {severityLabel}
                </span>
              </div>

              {/* Large Circular / Number Gauge */}
              <div className="score-gauge-wrap">
                <div className="score-number-display">
                  <span className="score-huge-num">{totalScore}</span>
                  <span className="score-max-denom">/ 100</span>
                </div>
                <div className="score-status-line">
                  {totalScore >= 70
                    ? 'Exceeds High Severity Threshold (≥ 70)'
                    : totalScore >= 40
                    ? 'Requires Security Review (40–69)'
                    : 'Within Normal Baseline (0–39)'}
                </div>
              </div>

              {/* Formula Breakdown Breakdown Table */}
              <div className="formula-breakdown-card">
                <div className="breakdown-title">Signal Contribution Breakdown:</div>
                <div className="breakdown-list">
                  <div className="breakdown-row">
                    <span>Self-Baseline (20%)</span>
                    <span className="breakdown-val">+{Math.round(signalValues.self * 0.20)} pts</span>
                  </div>
                  <div className="breakdown-row">
                    <span>Destination Policy (15%)</span>
                    <span className="breakdown-val">+{Math.round(signalValues.dest * 0.15)} pts</span>
                  </div>
                  <div className="breakdown-row">
                    <span>Isolation Forest (40%)</span>
                    <span className="breakdown-val">+{Math.round(signalValues.iso * 0.40)} pts</span>
                  </div>
                  <div className="breakdown-row">
                    <span>Peer-Group Cohort (15%)</span>
                    <span className="breakdown-val">+{Math.round(signalValues.peer * 0.15)} pts</span>
                  </div>
                  <div className="breakdown-row">
                    <span>Slow-Leak Window (10%)</span>
                    <span className="breakdown-val">+{Math.round(signalValues.leak * 0.10)} pts</span>
                  </div>
                </div>
              </div>

              {/* Recommended SOC Action */}
              <div className="action-recommendation-box">
                <div className="rec-box-header">
                  <span className="rec-icon">⚡</span>
                  <span className="rec-title">Recommended SOC Playbook:</span>
                </div>
                <p className="rec-text">{actionText}</p>
              </div>

              {/* Direct Link to Live Dashboard */}
              <button
                type="button"
                className="btn-score-launch"
                onClick={onLaunchDashboard}
              >
                <span>Inspect in Live Dashboard</span>
                <ArrowRight size={16} strokeWidth={2.2} />
              </button>
            </div>
          </div>

        </div>

      </div>
    </section>
  )
}
