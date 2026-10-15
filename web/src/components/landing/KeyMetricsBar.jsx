import React from 'react'
import { EyeOff, Activity, ShieldCheck, Clock, Zap } from '../icons/LucideIcons.jsx'

export default function KeyMetricsBar() {
  const metrics = [
    {
      icon: <EyeOff size={22} color="#064E3B" strokeWidth={2} />,
      val: '0 Bytes',
      label: 'Payload Decrypted',
      desc: 'Zero SSL inspection or certificate interception',
    },
    {
      icon: <Activity size={22} color="#064E3B" strokeWidth={2} />,
      val: '5-Signal',
      label: 'Fusion Engine',
      desc: 'Self, peer, destination, ML & slow-leak correlation',
    },
    {
      icon: <ShieldCheck size={22} color="#064E3B" strokeWidth={2} />,
      val: '< 0.08%',
      label: 'False Positive Rate',
      desc: 'Role-cohort filtering eliminates developer build noise',
    },
    {
      icon: <Clock size={22} color="#064E3B" strokeWidth={2} />,
      val: '< 150 ms',
      label: 'Inference Latency',
      desc: 'Sub-second stream processing on 15-min entity windows',
    },
  ]

  return (
    <section className="key-metrics-section" aria-label="Key Platform Metrics">
      <div className="section-container">
        <div className="metrics-grid">
          {metrics.map((m, idx) => (
            <div key={idx} className="metric-card">
              <div className="metric-icon-box">{m.icon}</div>
              <div className="metric-value-box">
                <span className="metric-headline-num">{m.val}</span>
                <span className="metric-headline-label">{m.label}</span>
              </div>
              <p className="metric-sub-desc">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
