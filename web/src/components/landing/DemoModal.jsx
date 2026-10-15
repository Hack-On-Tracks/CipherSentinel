import React, { useState } from 'react'
import { X, ArrowRight, CipherShield, Lock, Activity, AlertTriangle, FileText } from '../icons/LucideIcons.jsx'

export default function DemoModal({ isOpen, onClose, onLaunchDashboard }) {
  const [currentStep, setCurrentStep] = useState(0)

  if (!isOpen) return null

  const steps = [
    {
      title: '1. Ingest Encrypted Telemetry',
      badge: 'Zero Decryption',
      desc: 'CipherSentinel extracts TLS Client Hello / Server Hello handshakes, SNI targets, session timing intervals, and packet size distribution histograms without opening payload content.',
      detail: 'Crucially, application layer payloads (HTTP headers, tokens, customer data) remain 100% encrypted and uninspected.',
      metrics: [
        { label: 'Cipher Suite', val: 'TLS_AES_256_GCM_SHA384' },
        { label: 'JA4 Fingerprint', val: 't13d1516h2_8daaf6152771' },
        { label: 'Payload Inspection', val: '0% (Completely Untouched)' },
      ],
    },
    {
      title: '2. Baseline Entity Behavioral Modeling',
      badge: 'Context Engine',
      desc: 'Machine learning models map historical norms for each employee, endpoint, and department, modeling baseline upload volumes, active hours, and sanctioned cloud destinations.',
      detail: 'An isolation forest algorithm quantifies deviations from normal peer group behavior in real time.',
      metrics: [
        { label: 'Entity', val: 'Sarah Lin (DevOps Eng)' },
        { label: 'Standard Egress', val: '4.2 MB / day (p95)' },
        { label: 'Peer Group Delta', val: '+1,840% deviation' },
      ],
    },
    {
      title: '3. Anomaly & Threat Detection',
      badge: 'AI Classifier',
      desc: 'When an employee attempts data exfiltration or displays credential abuse, high-entropy bursts and off-hours beaconing trigger immediate alerts.',
      detail: 'Off-hours transfers and burst ratios to uncommon external hosts are flagged before data leaves the network.',
      metrics: [
        { label: 'Observed Burst', val: '312 MB via port 443' },
        { label: 'Time of Event', val: '02:41 AM (Off-hours)' },
        { label: 'Risk Score', val: '94 / 100 (Critical)' },
      ],
    },
    {
      title: '4. Explainable Insights & SOC Context',
      badge: 'Security SOC Ready',
      desc: 'CipherSentinel delivers explainable reasoning with transparent evidence, highlighting the exact metadata anomalies without violating employee privacy.',
      detail: 'Security teams receive deterministic root-cause summaries ready for SIEM / SOAR triage.',
      metrics: [
        { label: 'Primary Factor', val: 'High burst ratio to unclassified ASN' },
        { label: 'Suggested Action', val: 'Revoke AWS SSO token & quarantine endpoint' },
        { label: 'False Positive Rate', val: '< 0.08%' },
      ],
    },
  ]

  const active = steps[currentStep]

  return (
    <div className="demo-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="demo-modal-title">
      <div className="demo-modal-backdrop" onClick={onClose} />
      
      <div className="demo-modal-container">
        {/* Modal Header */}
        <div className="demo-modal-header">
          <div className="demo-header-title-box">
            <CipherShield size={32} />
            <div>
              <h2 id="demo-modal-title" className="demo-modal-title">
                Architecture Demo: Encrypted Metadata Analysis
              </h2>
              <p className="demo-modal-subtitle">
                How CipherSentinel detects insider threat vectors without inspecting payload content
              </p>
            </div>
          </div>
          <button
            type="button"
            className="demo-close-btn"
            onClick={onClose}
            aria-label="Close demo modal"
          >
            <X size={20} color="#58616A" strokeWidth={2} />
          </button>
        </div>

        {/* Step Tabs */}
        <div className="demo-step-tabs" role="tablist">
          {steps.map((s, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={currentStep === idx}
              className={`demo-step-tab-btn ${currentStep === idx ? 'is-active' : ''}`}
              onClick={() => setCurrentStep(idx)}
            >
              <span className="step-num">{idx + 1}</span>
              <span>{s.badge}</span>
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="demo-modal-body">
          <div className="demo-step-card">
            <div className="demo-card-top">
              <div>
                <h3 className="demo-card-title">{active.title}</h3>
                <span className="demo-pill-tag">{active.badge}</span>
              </div>
            </div>

            <p className="demo-card-desc">{active.desc}</p>
            <p className="demo-card-detail">{active.detail}</p>

            <div className="demo-metrics-grid">
              {active.metrics.map((m, i) => (
                <div key={i} className="demo-metric-cell">
                  <div className="metric-label">{m.label}</div>
                  <div className="metric-val">{m.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="demo-modal-footer">
          <div className="demo-nav-controls">
            <button
              type="button"
              className="btn-modal-prev"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep(c => Math.max(0, c - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-modal-next"
              disabled={currentStep === steps.length - 1}
              onClick={() => setCurrentStep(c => Math.min(steps.length - 1, c + 1))}
            >
              Next Step
            </button>
          </div>

          <button
            type="button"
            className="btn-modal-dashboard"
            onClick={() => {
              onClose()
              onLaunchDashboard()
            }}
          >
            <span>Launch Live Dashboard</span>
            <ArrowRight size={16} strokeWidth={2.2} />
          </button>
        </div>

      </div>
    </div>
  )
}
