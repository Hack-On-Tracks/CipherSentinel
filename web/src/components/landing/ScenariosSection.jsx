import React, { useState } from 'react'
import { ShieldAlert, CheckCircle2, Activity, ArrowRight, Laptop, Users, Globe } from '../icons/LucideIcons.jsx'

export default function ScenariosSection({ onLaunchDashboard, onReplayScenario }) {
  const [activeScenarioId, setActiveScenarioId] = useState('S2')

  const scenarios = [
    {
      id: 'S2',
      tag: 'Critical Threat',
      title: 'Midnight Exfiltration to Mega.nz',
      entity: 'U-008 (Finance Analyst)',
      volume: '400 MB Burst',
      time: '02:00 AM (Off-hours)',
      destination: 'mega.nz (Personal File Sharing)',
      riskScore: 87,
      severity: 'high',
      expected: 'High Alert (Score 87)',
      details: 'A finance employee uploads 400 MB at 2:00 AM to a newly encountered personal storage service. The upload is 61x their historical median (z = 61.0). High-entropy bursts and novelty score trigger immediate SOC escalation.',
      verdict: 'Escalate to security team; verify with manager before access restriction.',
      signalsTriggered: ['Self-baseline (z=61.0)', 'Destination policy (mega.nz)', 'Isolation Forest (0.90)', 'Off-hours burst'],
    },
    {
      id: 'S3',
      tag: 'Low-and-Slow Leak',
      title: 'Stealthy 10-Day WeTransfer Exfil',
      entity: 'U-019 (HR Specialist)',
      volume: '40 MB / day for 10 days',
      time: '10:00 AM (Standard hours)',
      destination: 'wetransfer.com (One-time transfer)',
      riskScore: 55,
      severity: 'review',
      expected: 'Mid-Period Alert',
      details: 'To evade single-flow burst thresholds, the user limits each transfer to 40 MB during business hours. The 7-day slow-leak accumulator identifies the cumulative outbound drift, triggering an alert on day 5.',
      verdict: 'Investigate transfer authorization with HR leadership.',
      signalsTriggered: ['7-day accumulator (400 MB)', 'Peer-group deviation (z=6.0)', 'Destination policy'],
    },
    {
      id: 'S4',
      tag: 'Tool Evasion',
      title: 'Sync-Tool JA4 & Anonymizer',
      entity: 'U-009 (Finance Controller)',
      volume: '250 MB Outbound',
      time: '14:15 PM',
      destination: 'drive.google.com (Unusual Account)',
      riskScore: 74,
      severity: 'high',
      expected: 'Review / High Alert',
      details: 'The user utilizes an unapproved sync tool. The client TLS Client Hello JA4 fingerprint matches known exfiltration utilities rather than standard corporate browsers.',
      verdict: 'Escalate to security team; investigate endpoint software inventory.',
      signalsTriggered: ['JA4 fingerprint anomaly', 'Self-deviation (z=15.0)', 'Volume deviation'],
    },
    {
      id: 'S5',
      tag: 'Departing Insider',
      title: 'Departing Employee 2-Week Ramp',
      entity: 'U-024 (Sales Director)',
      volume: 'Exponential Egress Ramp',
      time: 'Evenings & Weekends',
      destination: 'Dropbox & Box endpoints',
      riskScore: 68,
      severity: 'review',
      expected: 'Pre-Exit Detection',
      details: 'Sales director after submitting resignation progressively copies client rosters and contracts. The progressive volume ramp violates peer-group benchmarks 6 days before their final work day.',
      verdict: 'Review egress audit trail with legal and HR prior to exit interview.',
      signalsTriggered: ['Peer cohort divergence', 'Accumulative drift', 'Off-schedule activity'],
    },
    {
      id: 'S1',
      tag: 'Hard Negative (Clean)',
      title: 'Heavy Developer 2 GB Daily Builds',
      entity: 'U-003 (Senior DevOps)',
      volume: '2.4 GB Docker Images',
      time: '16:30 PM (Working hours)',
      destination: 'ecr.aws.com / docker.io',
      riskScore: 18,
      severity: 'clean',
      expected: 'No Alert (Clean Suppression)',
      details: 'Developers routinely push large multi-gigabyte build artifacts. Static threshold systems raise daily false alarms. CipherSentinel peer-group cohort modeling recognizes this as routine for engineering.',
      verdict: 'Normal engineering operation. Baseline updated; zero alert noise.',
      signalsTriggered: ['Peer cohort matches Engineering median', 'Sanctioned corporate destination'],
    },
    {
      id: 'S6',
      tag: 'Hard Negative (Clean)',
      title: 'New Laptop 3 GB First-Day Onboarding',
      entity: 'U-012 (New Hire - Marketing)',
      volume: '3.1 GB Initial Cloud Sync',
      time: '09:30 AM (Day 1)',
      destination: 'onedrive.microsoft.com',
      riskScore: 32,
      severity: 'clean',
      expected: 'Clean / Low Risk',
      details: 'A newly provisioned corporate laptop syncs corporate OneDrive files on day 1. The system identifies sanctioned corporate tenant SNI and onboarding window flags, preventing false alarm fatigue.',
      verdict: 'Approved corporate sync. No security action required.',
      signalsTriggered: ['Sanctioned corporate tenant', 'Low destination risk'],
    },
  ]

  const active = scenarios.find((s) => s.id === activeScenarioId) || scenarios[0]

  return (
    <section id="scenarios" className="scenarios-section" aria-labelledby="scenarios-title">
      <div className="section-container">
        
        {/* Section Header */}
        <div className="section-header-center">
          <div className="section-eyebrow">
            <span className="eyebrow-bullet">●</span>
            <span>MITRE ATT&CK T1567 BENCHMARK</span>
          </div>
          <h2 id="scenarios-title" className="section-title">
            Battle-Tested Against Real Insider Vectors
          </h2>
          <p className="section-subtitle">
            Explore the 6 deterministic synthetic scenarios evaluated across 30 days of enterprise network telemetry, testing both malicious exfiltration and hard-negative suppression.
          </p>
        </div>

        {/* Scenarios Tab Selector */}
        <div className="scenarios-tabs-bar" role="tablist">
          {scenarios.map((sc) => (
            <button
              key={sc.id}
              type="button"
              role="tab"
              aria-selected={activeScenarioId === sc.id}
              className={`scenario-tab-btn ${activeScenarioId === sc.id ? 'is-active' : ''}`}
              onClick={() => setActiveScenarioId(sc.id)}
            >
              <span className="sc-btn-id">{sc.id}</span>
              <span className="sc-btn-name">{sc.title}</span>
            </button>
          ))}
        </div>

        {/* Selected Scenario Showcase Card */}
        <div className="scenario-detail-card">
          <div className="scenario-card-header">
            <div className="sc-header-left">
              <span className="sc-id-badge">{active.id}</span>
              <div>
                <h3 className="sc-headline-title">{active.title}</h3>
                <span className="sc-tag-pill">{active.tag}</span>
              </div>
            </div>

            <div className="sc-header-right">
              <div className="sc-verdict-box">
                <span className="verdict-label">System Output</span>
                <span className={`verdict-pill verdict-${active.severity}`}>
                  {active.expected}
                </span>
              </div>
            </div>
          </div>

          <div className="sc-meta-metrics-grid">
            <div className="sc-meta-item">
              <span className="sc-meta-k">Entity</span>
              <span className="sc-meta-v">{active.entity}</span>
            </div>
            <div className="sc-meta-item">
              <span className="sc-meta-k">Volume</span>
              <span className="sc-meta-v">{active.volume}</span>
            </div>
            <div className="sc-meta-item">
              <span className="sc-meta-k">Time of Event</span>
              <span className="sc-meta-v">{active.time}</span>
            </div>
            <div className="sc-meta-item">
              <span className="sc-meta-k">Target Destination</span>
              <span className="sc-meta-v">{active.destination}</span>
            </div>
          </div>

          <div className="sc-narrative-box">
            <div className="narrative-heading">Detection Narrative & Analysis:</div>
            <p className="narrative-text">{active.details}</p>
          </div>

          <div className="sc-signals-footer">
            <div className="sc-signals-list-wrap">
              <span className="signals-tag-label">Signals Triggered:</span>
              <div className="signals-chips-wrap">
                {active.signalsTriggered.map((sig, i) => (
                  <span key={i} className="sig-chip">
                    ✓ {sig}
                  </span>
                ))}
              </div>
            </div>

            <div className="sc-playbook-rec">
              <span className="playbook-label">SOC Playbook Recommendation:</span>
              <span className="playbook-val">{active.verdict}</span>
            </div>
          </div>

          <div className="scenario-card-cta">
            <button
              type="button"
              className="btn-scenario-replay"
              onClick={() => (onReplayScenario ? onReplayScenario(active.id) : onLaunchDashboard())}
            >
              <span>Replay Scenario in Live Engine</span>
              <ArrowRight size={16} strokeWidth={2.2} />
            </button>
          </div>
        </div>

      </div>
    </section>
  )
}
