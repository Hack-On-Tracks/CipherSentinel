import React from 'react'
import { Lock, Cpu, Sliders, CheckCircle2 } from '../icons/LucideIcons.jsx'

export default function HowItWorksSection() {
  const steps = [
    {
      num: '01',
      title: 'Encrypted Telemetry Ingestion',
      subtitle: 'Passive packet observation with zero payload inspection',
      icon: <Lock size={22} color="#064E3B" strokeWidth={2} />,
      points: [
        'Extracts TLS handshake metadata (Client Hello, Server Hello, cipher suites, JA4 hashes).',
        'Tracks flow volume, burst entropy, packet size histograms, and inter-arrival timing.',
        'Never inspects or decrypts application payloads, protecting employee privacy and company credentials.',
      ],
      chip: 'Zero Decryption',
    },
    {
      num: '02',
      title: 'Robust Dual-Window Baselines',
      subtitle: 'Self-history modeling combined with departmental role cohorts',
      icon: <Cpu size={22} color="#064E3B" strokeWidth={2} />,
      points: [
        'Calculates 30-day rolling Median and Median Absolute Deviation (MAD) for each pseudonymous user.',
        'Groups entities into role cohorts (Engineering, Finance, HR, Sales) to contextualize data velocity.',
        'Intelligently allows 2 GB builds for developers while detecting 40 MB uncharacteristic uploads for HR.',
      ],
      chip: 'Median / MAD Context',
    },
    {
      num: '03',
      title: 'Five-Signal Fusion Scoring',
      subtitle: 'Multivariate anomaly detection mapped to MITRE ATT&CK T1567',
      icon: <Sliders size={22} color="#064E3B" strokeWidth={2} />,
      points: [
        'Combines Isolation Forest (40%), self-deviation (20%), destination policy (15%), peer cohorts (15%), and slow leaks (10%).',
        'Produces calibrated scores from 0 to 100: Info (0–39), Review (40–69), and High (70–100).',
        '7-day accumulator captures stealthy low-and-slow exfiltration designed to bypass burst alarms.',
      ],
      chip: 'Calibrated 0-100 Score',
    },
    {
      num: '04',
      title: 'Explainable SOC Response',
      subtitle: 'Deterministic root-cause evidence for security operations',
      icon: <CheckCircle2 size={22} color="#064E3B" strokeWidth={2} />,
      points: [
        'Delivers plain-language explanations of exact signal contributions, percentiles, and destination risks.',
        'Provides actionable recommendations (e.g. verify with manager, inspect endpoint credentials).',
        'Recommend-only posture ensures legitimate business workflows are never disrupted automatically.',
      ],
      chip: 'Transparent Evidence',
    },
  ]

  return (
    <section id="how-it-works" className="how-it-works-section" aria-labelledby="how-it-works-title">
      <div className="section-container">
        
        {/* Section Header */}
        <div className="section-header-center">
          <div className="section-eyebrow">
            <span className="eyebrow-bullet">●</span>
            <span>END-TO-END PIPELINE</span>
          </div>
          <h2 id="how-it-works-title" className="section-title">
            How CipherSentinel Detects Insider Threats
          </h2>
          <p className="section-subtitle">
            A privacy-preserving architecture that extracts behavioral anomaly signals from encrypted network metadata without ever opening confidential payloads.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="steps-cards-grid">
          {steps.map((st, idx) => (
            <div key={idx} className="step-card">
              <div className="step-card-header">
                <span className="step-badge-num">{st.num}</span>
                <span className="step-chip-tag">{st.chip}</span>
              </div>

              <div className="step-card-icon-title">
                <div className="step-icon-wrap">{st.icon}</div>
                <div>
                  <h3 className="step-card-title">{st.title}</h3>
                  <div className="step-card-subtitle">{st.subtitle}</div>
                </div>
              </div>

              <ul className="step-bullets-list">
                {st.points.map((pt, pIdx) => (
                  <li key={pIdx} className="step-bullet-item">
                    <span className="bullet-tick">✓</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
