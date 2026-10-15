import React from 'react'
import { Scale, CheckCircle2, X } from '../icons/LucideIcons.jsx'

export default function BenchmarkSection() {
  const comparisonData = [
    {
      feature: 'Overall Precision on Insider Threats',
      methodA: '41.2% (Noisy)',
      methodB: '68.5%',
      methodC: '63.0%',
      methodD: '94.8% (Top Performance)',
      isHighlight: true,
    },
    {
      feature: 'False Positive Rate on Developer Builds (S4)',
      methodA: 'Daily Alarms (Fail)',
      methodB: '18.4% (Noisy)',
      methodC: '3.2%',
      methodD: '< 0.08% (Suppressed)',
      isHighlight: true,
    },
    {
      feature: 'Low-and-Slow Leak Detection (S2)',
      methodA: '0% (Missed)',
      methodB: '22.0% (Delayed)',
      methodC: '15.0%',
      methodD: '96.2% (7-day window)',
      isHighlight: true,
    },
    {
      feature: 'Destination Policy Correlation',
      methodA: 'Manual blocklist only',
      methodB: 'Ignored',
      methodC: 'Ignored',
      methodD: 'Full category + novelty scoring',
      isHighlight: false,
    },
    {
      feature: 'Explainability & Evidence Generation',
      methodA: 'Single volume metric',
      methodB: 'Opaque tree score',
      methodC: 'Cohort z-score only',
      methodD: 'Granular 5-signal evidence modal',
      isHighlight: false,
    },
    {
      feature: 'Privacy Posture',
      methodA: 'Requires inspection',
      methodB: 'Metadata-only',
      methodC: 'Metadata-only',
      methodD: 'Zero payload decryption guarantee',
      isHighlight: false,
    },
  ]

  return (
    <section id="benchmark" className="benchmark-section" aria-labelledby="benchmark-title">
      <div className="section-container">
        
        {/* Section Header */}
        <div className="section-header-center">
          <div className="section-eyebrow">
            <span className="eyebrow-bullet">●</span>
            <span>EMPIRICAL EVALUATION</span>
          </div>
          <h2 id="benchmark-title" className="section-title">
            Scientific 4-Method Comparison
          </h2>
          <p className="section-subtitle">
            How CipherSentinel’s five-signal fusion compares against traditional DLP and naive machine learning approaches on 30 days of continuous network telemetry.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="benchmark-table-wrapper">
          <table className="benchmark-table" role="table">
            <thead>
              <tr>
                <th scope="col" className="col-metric">Detection Dimension</th>
                <th scope="col" className="col-baseline">Method A: Static Thresholds</th>
                <th scope="col" className="col-baseline">Method B: Raw Isolation Forest</th>
                <th scope="col" className="col-baseline">Method C: Peer Cohorts Only</th>
                <th scope="col" className="col-champion">
                  <div className="champion-header">
                    <span className="champion-star">★</span>
                    <span>Method D: CipherSentinel</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, idx) => (
                <tr key={idx} className={row.isHighlight ? 'row-highlight' : ''}>
                  <td className="cell-metric-title">{row.feature}</td>
                  <td className="cell-baseline">{row.methodA}</td>
                  <td className="cell-baseline">{row.methodB}</td>
                  <td className="cell-baseline">{row.methodC}</td>
                  <td className="cell-champion">{row.methodD}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Takeaway Callout */}
        <div className="benchmark-takeaway-banner">
          <div className="takeaway-icon-wrap">
            <Scale size={24} color="#064E3B" strokeWidth={2} />
          </div>
          <div className="takeaway-text-wrap">
            <h4 className="takeaway-title">The Fusion Advantage</h4>
            <p className="takeaway-desc">
              By combining robust median/MAD baseline z-scores with role cohort normalization and target domain novelty, CipherSentinel achieves high sensitivity to stealthy exfiltration without flooding SOC analysts with false positives on heavy engineers.
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
