import React from 'react'
import {
  Users,
  Laptop,
  Globe,
  CipherShield,
  AlertTriangle,
  BarChart3,
  FileText,
} from '../icons/LucideIcons.jsx'

export default function TrafficFlowIllustration() {
  return (
    <div className="diagram-showcase" aria-label="CipherSentinel Threat Intelligence Architecture Diagram">
      <div className="diagram-canvas-wrap">
        
        {/* SVG Connector & Orbit Layer */}
        <svg
          viewBox="0 0 685 360"
          className="diagram-svg-layer"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* 1. Concentric Background Orbit Rings centered behind Center Card (cx=342, cy=180) */}
          <circle
            cx="342"
            cy="180"
            r="115"
            fill="none"
            stroke="rgba(6, 78, 59, 0.12)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <circle
            cx="342"
            cy="180"
            r="160"
            fill="none"
            stroke="rgba(6, 78, 59, 0.08)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />

          {/* Orbit Accent Dots */}
          <circle cx="342" cy="65" r="2.5" fill="#064E3B" opacity="0.45" />
          <circle cx="457" cy="180" r="2.5" fill="#064E3B" opacity="0.45" />
          <circle cx="342" cy="295" r="2.5" fill="#064E3B" opacity="0.45" />
          <circle cx="227" cy="180" r="2.5" fill="#064E3B" opacity="0.45" />
          <circle cx="445" cy="100" r="2.5" fill="#064E3B" opacity="0.35" />
          <circle cx="240" cy="260" r="2.5" fill="#064E3B" opacity="0.35" />

          {/* 2. Left Connector Curves (Green: Inputs to Center) */}
          {/* Top curve: Users (175, 65) -> Center (265, 160) */}
          <path
            d="M 175 65 C 220 65, 230 160, 265 160"
            fill="none"
            stroke="#064E3B"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Middle line: Devices (175, 180) -> Center (265, 180) */}
          <path
            d="M 175 180 L 265 180"
            fill="none"
            stroke="#064E3B"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Bottom curve: Encrypted Traffic (175, 295) -> Center (265, 200) */}
          <path
            d="M 175 295 C 220 295, 230 200, 265 200"
            fill="none"
            stroke="#064E3B"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Left Node Anchor Dots (at the right edge of input cards) */}
          <circle cx="175" cy="65" r="4.5" fill="#064E3B" />
          <circle cx="175" cy="180" r="4.5" fill="#064E3B" />
          <circle cx="175" cy="295" r="4.5" fill="#064E3B" />

          {/* 3. Right Connector Curves (Center to Outputs) */}
          {/* Top curve: Center (420, 160) -> Risky Behavior (490, 65) [Soft Red] */}
          <path
            d="M 420 160 C 455 160, 465 65, 490 65"
            fill="none"
            stroke="#F04444"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Middle line: Center (420, 180) -> Anomalies Identified (490, 180) [Amber] */}
          <path
            d="M 420 180 L 490 180"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Bottom curve: Center (420, 200) -> Explainable Alerts (490, 295) [Green] */}
          <path
            d="M 420 200 C 455 200, 465 295, 490 295"
            fill="none"
            stroke="#064E3B"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Right Node Anchor Dots along connector paths */}
          <circle cx="458" cy="98" r="4.5" fill="#F04444" />
          <circle cx="470" cy="180" r="4.5" fill="#F59E0B" />
          <circle cx="460" cy="262" r="4.5" fill="#064E3B" />
        </svg>

        {/* HTML Cards Grid Overlay */}
        <div className="diagram-grid">
          
          {/* LEFT COLUMN: Input Telemetry Cards */}
          <div className="diagram-col diagram-col-inputs">
            {/* Card 1: Users */}
            <div className="diag-card diag-card-input">
              <div className="diag-icon-wrap">
                <Users size={20} color="#0D1E16" strokeWidth={1.8} />
              </div>
              <div className="diag-text-wrap">
                <span className="diag-title">Users</span>
                <span className="diag-subtitle">Employee activity</span>
              </div>
            </div>

            {/* Card 2: Devices */}
            <div className="diag-card diag-card-input">
              <div className="diag-icon-wrap">
                <Laptop size={20} color="#0D1E16" strokeWidth={1.8} />
              </div>
              <div className="diag-text-wrap">
                <span className="diag-title">Devices</span>
                <span className="diag-subtitle">Endpoints & systems</span>
              </div>
            </div>

            {/* Card 3: Encrypted Traffic */}
            <div className="diag-card diag-card-input">
              <div className="diag-icon-wrap">
                <Globe size={20} color="#0D1E16" strokeWidth={1.8} />
              </div>
              <div className="diag-text-wrap">
                <span className="diag-title">Encrypted Traffic</span>
                <span className="diag-subtitle">TLS/HTTPS metadata</span>
              </div>
            </div>
          </div>

          {/* CENTER NODE: CipherSentinel Processing Engine */}
          <div className="diagram-col diagram-col-center">
            <div className="diag-center-card">
              <CipherShield size={50} className="center-shield-img" />
              <div className="center-brand-name">CipherSentinel</div>
              <div className="center-brand-sub">Analyze • Detect • Explain</div>
            </div>
          </div>

          {/* RIGHT COLUMN: Output Intelligence Cards */}
          <div className="diagram-col diagram-col-outputs">
            {/* Output 1: Risky Behavior (Pastel Red) */}
            <div className="diag-card diag-card-risk">
              <div className="diag-icon-wrap diag-icon-risk">
                <AlertTriangle size={20} color="#F04444" strokeWidth={2} />
              </div>
              <div className="diag-text-wrap">
                <span className="diag-title">Risky Behavior</span>
                <span className="diag-subtitle">Detected early</span>
              </div>
            </div>

            {/* Output 2: Anomalies Identified (Pastel Amber) */}
            <div className="diag-card diag-card-anomaly">
              <div className="diag-icon-wrap diag-icon-anomaly">
                <BarChart3 size={20} color="#F59E0B" />
              </div>
              <div className="diag-text-wrap">
                <span className="diag-title">Anomalies Identified</span>
                <span className="diag-subtitle">AI-powered analysis</span>
              </div>
            </div>

            {/* Output 3: Explainable Alerts (Pastel Sage Green) */}
            <div className="diag-card diag-card-explainable">
              <div className="diag-icon-wrap diag-icon-explainable">
                <FileText size={20} color="#064E3B" strokeWidth={2} />
              </div>
              <div className="diag-text-wrap">
                <span className="diag-title">Explainable Alerts</span>
                <span className="diag-subtitle">Clear reasons & context</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
