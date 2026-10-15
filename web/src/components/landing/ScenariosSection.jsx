import React, { useState } from 'react'
import { ShieldAlert, CheckCircle2, Activity, ArrowRight, Laptop, Users, Globe } from '../icons/LucideIcons.jsx'

export default function ScenariosSection({ onLaunchDashboard, onReplayScenario }) {
  const [activeScenarioId, setActiveScenarioId] = useState('S1')

  const scenarios = [
    {
      id: 'S1',
      tag: 'Priority 1 · Burst Exfiltration',
      title: 'Off-Hours Upload Through a New Channel',
      entity: 'U-008 (Finance Analyst)',
      volume: '400 MB Burst',
      time: '02:00 AM (Off-hours)',
      destination: 'mega.nz (Personal File Sharing)',
      riskScore: 92,
      severity: 'high',
      expected: 'High Alert (illustrative score 92)',
      details: 'A finance employee uploads 400 MB at 2:00 AM to a new personal storage destination using an unusual port and a rare sync-tool fingerprint. Several independent behavioral dimensions are anomalous at once.',
      verdict: 'Escalate to security team; verify with manager before access restriction.',
      signalsTriggered: ['Isolation Forest (40-point maximum)', 'User and peer deviation', 'Destination/port novelty', 'Off-hours activity'],
      isoInputs: [
        ['out_bytes_log + byte_asymmetry', 'Flags a large upload-heavy burst.'],
        ['out_z + peer_z', 'Measures how far the upload departs from this user and finance peers.'],
        ['new_dest_user + bytes_to_novel_dst_log', 'Captures first contact and the volume sent to it.'],
        ['is_off_hours + active_hours_dev', 'Finds activity outside the user’s normal schedule.'],
        ['novel_dst_port + ja4_rare', 'Highlights an unfamiliar service port and rare client fingerprint.'],
      ],
    },
    {
      id: 'S2',
      tag: 'Priority 2 · Cumulative Exfiltration',
      title: 'Low-and-Slow Transfer Across Eight Days',
      entity: 'U-019 (HR Specialist)',
      volume: '60 MB / day for 8 days',
      time: '20:00 (Off-hours)',
      destination: 'wetransfer.com (Repeated transfer)',
      riskScore: 78,
      severity: 'review',
      expected: 'Review / High as evidence accumulates',
      details: 'An HR user sends 60 MB per day to the same external file-transfer service at 20:00. Each transfer stays below a 100 MB/window threshold; rolling volume and repeated off-hours behavior build the anomaly over time.',
      verdict: 'Investigate transfer authorization with HR leadership.',
      signalsTriggered: ['Isolation Forest (40-point maximum)', 'cum_out_7d_mb_log', 'out_z + peer_z', 'active_hours_dev'],
      isoInputs: [
        ['cum_out_7d_mb_log', 'Tracks repeated egress that stays below a one-window threshold.'],
        ['out_z + peer_z', 'Compares each daily transfer with the user and role cohort.'],
        ['new_dest_user + category_risk', 'Adds context for a new file-transfer destination.'],
        ['is_off_hours + active_hours_dev', 'Measures timing irregularity across the sequence.'],
        ['conn_count_log + byte_asymmetry', 'Describes transfer cadence and upload-heavy direction.'],
      ],
    },
    {
      id: 'S3',
      tag: 'Priority 3 · Channel Evasion',
      title: 'Rare Client, Port, and Destination Region',
      entity: 'U-009 (Finance Controller)',
      volume: '120 MB repeated over five days',
      time: '14:00 (unfamiliar channel)',
      destination: 'filebin.net (new region, port 4444)',
      riskScore: 88,
      severity: 'high',
      expected: 'High Alert (illustrative score 88)',
      details: 'A finance user repeatedly sends data to an anonymising file host from a new destination region, using a rare client fingerprint and a previously unseen high port. The volume is moderate, so context and behavior matter more than a size threshold.',
      verdict: 'Escalate to security team; investigate endpoint software inventory.',
      signalsTriggered: ['Isolation Forest (40-point maximum)', 'ja4_rare + novel_dst_port', 'new_region_and_destination', 'category_risk'],
      isoInputs: [
        ['ja4_rare', 'Detects a client TLS fingerprint rarely seen in the environment.'],
        ['novel_dst_port + risky_dst_port_share', 'Identifies a new or unusual destination service port.'],
        ['new_region_and_destination', 'Marks a first-seen destination in a new geography.'],
        ['new_dest_user + bytes_to_novel_dst_log', 'Measures novelty and outbound volume to that channel.'],
        ['out_z + peer_z + category_risk', 'Adds user, role, and destination-risk context.'],
      ],
    },
    {
      id: 'S4',
      tag: 'Hard Negative · Legitimate Activity',
      title: 'Large Sanctioned Engineering Release',
      entity: 'U-000 (Engineer)',
      volume: '3 GB release repeated on a known channel',
      time: '09:05 AM (Working hours)',
      destination: 'onedrive.live.com (Sanctioned)',
      riskScore: 68,
      severity: 'review',
      expected: 'Review only (no high alerts in replay)',
      details: 'An engineer repeats a 3 GB release during normal hours to an established sanctioned service over port 443. The multivariate Isolation Forest still contributes points, but the combined score stays below the high-severity threshold. This is a calibration control for legitimate high-volume work.',
      verdict: 'Review the established release profile; no urgent restriction or escalation.',
      signalsTriggered: ['Isolation Forest: 32.8 / 40', 'Established destination and port', 'Normal active hours', 'Combined risk remains below 70'],
      isoInputs: [
        ['out_bytes_log', 'Sees the large transfer, then evaluates it with the other behavior.'],
        ['out_z + peer_z', 'Checks that this volume fits the engineer’s own and peer patterns.'],
        ['new_dest_user + new_dest_org', 'Confirms the release uses an established destination.'],
        ['is_off_hours + active_hours_dev', 'Confirms the activity occurs during the usual work schedule.'],
        ['novel_dst_port + category_risk', 'Confirms the channel and service category are expected.'],
      ],
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
            Explore three priority-ordered exfiltration patterns and one legitimate high-volume control. Isolation Forest carries 40 of the 100 risk points; each scenario shows which model inputs explain its behavior.
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

          <div className="sc-narrative-box">
            <div className="narrative-heading">Isolation Forest inputs used:</div>
            <ul className="narrative-text">
              {active.isoInputs.map(([feature, purpose]) => <li key={feature}><strong>{feature}</strong> — {purpose}</li>)}
            </ul>
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
