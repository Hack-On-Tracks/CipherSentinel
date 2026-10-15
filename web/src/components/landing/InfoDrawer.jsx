import React from 'react'
import { X, ArrowRight, CipherShield } from '../icons/LucideIcons.jsx'

export default function InfoDrawer({ section, onClose, onLaunchDashboard }) {
  if (!section || section === 'Home') return null

  const contentMap = {
    'How It Works': {
      title: 'How CipherSentinel Operates',
      subtitle: 'Passive packet inspection at the transport layer without breaking cryptography',
      points: [
        {
          heading: '1. Handshake & Flow Metadata Capture',
          text: 'CipherSentinel extracts TLS Client Hello and Server Hello metadata, cipher negotiation suites, session durations, and packet size distribution histograms.',
        },
        {
          heading: '2. Zero Decryption & Perfect Privacy',
          text: 'No certificates are forged, no SSL/TLS proxying is performed, and no payload bytes are decrypted. Employee personal data, private messages, and customer records remain 100% private.',
        },
        {
          heading: '3. Behavioral Anomaly Scoring',
          text: 'Baseline machine learning models correlate outbound traffic rhythms with historical user patterns. Deviations in data velocity, burst entropy, and destination ASN trigger risk evaluation.',
        },
      ],
    },
    'Features': {
      title: 'Platform Capabilities',
      subtitle: 'Engineered for modern enterprise security and SOC operations',
      points: [
        {
          heading: 'Metadata-Only Threat Detection',
          text: 'Detect data exfiltration attempts, compromised insider credentials, off-hours uploads, and unauthorized cloud backups through network flow characteristics alone.',
        },
        {
          heading: 'Explainable AI Scoring',
          text: 'Every alert comes with granular telemetry explanations, showing exact deviations in packet counts, timing intervals, and peer-group comparisons.',
        },
        {
          heading: 'Real-Time Alert Triage',
          text: 'Direct integration with SOC workflows, alerting analysts only when high-confidence anomalies exceed defined behavioral thresholds.',
        },
        {
          heading: 'Compliance & Employee Trust',
          text: 'Satisfies GDPR, HIPAA, and CCPA requirements by eliminating employee snooping risks inherent in legacy HTTPS decryption proxies.',
        },
      ],
    },
    'Technology': {
      title: 'Core Technology Stack',
      subtitle: 'High-throughput stream processing meets advanced behavioral machine learning',
      points: [
        {
          heading: 'JA3 / JA4 Client Fingerprinting',
          text: 'Identifies client applications, exfiltration scripts, and malware agents even when traffic is fully encrypted.',
        },
        {
          heading: 'Isolation Forests & Gradient Boosted Classifiers',
          text: 'Lightweight models trained on multi-dimensional flow metrics running with sub-second inference latency.',
        },
        {
          heading: 'Asynchronous Stream Ingestion',
          text: 'Handles multi-gigabit network mirror feeds with negligible CPU footprint and zero latency impact on production traffic.',
        },
      ],
    },
    'About': {
      title: 'About CipherSentinel',
      subtitle: 'Redefining insider threat intelligence through privacy-first cybersecurity',
      points: [
        {
          heading: 'The Vision',
          text: 'As 95%+ of enterprise network traffic is encrypted, traditional payload-inspecting DLP solutions face broken cryptography, prohibitive compute costs, and severe regulatory hurdles.',
        },
        {
          heading: 'Our Approach',
          text: 'CipherSentinel proves that network metadata contains sufficient high-dimensional signal to identify malicious insider behavior early — protecting corporate assets while respecting human privacy.',
        },
      ],
    },
  }

  const data = contentMap[section] || contentMap['How It Works']

  return (
    <div className="info-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby="info-drawer-title">
      <div className="info-drawer-backdrop" onClick={onClose} />
      
      <div className="info-drawer-panel">
        <div className="info-drawer-header">
          <div className="drawer-header-brand">
            <CipherShield size={26} />
            <span className="drawer-badge">{section}</span>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close information panel"
          >
            <X size={20} color="#58616A" strokeWidth={2} />
          </button>
        </div>

        <div className="info-drawer-body">
          <h2 id="info-drawer-title" className="drawer-title">{data.title}</h2>
          <p className="drawer-subtitle">{data.subtitle}</p>

          <div className="drawer-points-list">
            {data.points.map((pt, idx) => (
              <div key={idx} className="drawer-point-card">
                <div className="point-card-header">
                  <div className="point-bullet">✓</div>
                  <h3 className="point-heading">{pt.heading}</h3>
                </div>
                <p className="point-text">{pt.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="info-drawer-footer">
          <button
            type="button"
            className="btn-drawer-cta"
            onClick={() => {
              onClose()
              onLaunchDashboard()
            }}
          >
            <span>Launch CipherSentinel Console</span>
            <ArrowRight size={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  )
}
