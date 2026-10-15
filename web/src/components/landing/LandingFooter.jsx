import React from 'react'
import { CipherShield, ArrowRight, ShieldCheck, EyeOff, Lock } from '../icons/LucideIcons.jsx'

export default function LandingFooter({ onLaunchDashboard, onLaunchReplay, onLaunchEntities }) {
  return (
    <footer className="landing-footer-container" role="contentinfo">
      
      {/* Pre-Footer Hero CTA Banner */}
      <div className="section-container">
        <div className="pre-footer-cta-card">
          <div className="pre-footer-content">
            <span className="pre-footer-badge">ENTERPRISE INSIDER INTELLIGENCE</span>
            <h2 className="pre-footer-title">
              Detect Threats Early. Protect Privacy Always.
            </h2>
            <p className="pre-footer-subtitle">
              Start monitoring encrypted network metadata streams in minutes. Eliminate blind spots from personal cloud drops without breaking SSL/TLS cryptography.
            </p>
            <div className="pre-footer-buttons">
              <button
                type="button"
                className="btn-cta-primary"
                onClick={onLaunchDashboard}
              >
                <span>Launch Live Dashboard</span>
                <ArrowRight size={18} strokeWidth={2.4} />
              </button>
              <button
                type="button"
                className="btn-cta-secondary"
                onClick={onLaunchDashboard}
              >
                <span>Replay Scenarios</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="main-footer-wrap">
        <div className="section-container">
          <div className="footer-columns-grid">
            
            {/* Col 1: Brand & Philosophy */}
            <div className="footer-col footer-col-brand">
              <div className="footer-brand-header">
                <CipherShield size={32} />
                <div>
                  <span className="footer-brand-title">CipherSentinel</span>
                  <span className="footer-brand-sub">Insider Threat Intelligence</span>
                </div>
              </div>
              <p className="footer-brand-desc">
                AI-powered cybersecurity platform detecting insider threats from encrypted network traffic metadata without reading payload content.
              </p>
              <div className="footer-pill-badges">
                <span className="footer-mini-pill">MITRE ATT&CK T1567</span>
                <span className="footer-mini-pill">Zero Decryption</span>
              </div>
            </div>

            {/* Col 2: Platform Links */}
            <div className="footer-col">
              <h4 className="footer-col-title">Platform</h4>
              <ul className="footer-nav-list">
                <li><a href="#how-it-works" className="footer-link">How It Works</a></li>
                <li><a href="#scenarios" className="footer-link">MITRE Scenarios</a></li>
                <li><a href="#benchmark" className="footer-link">Empirical Benchmark</a></li>
                <li><a href="#privacy" className="footer-link">Privacy & Compliance</a></li>
              </ul>
            </div>

            {/* Col 3: Detection Science */}
            <div className="footer-col">
              <h4 className="footer-col-title">Detection Science</h4>
              <ul className="footer-nav-list">
                <li><span className="footer-static-item">Median / MAD Self-Baselines</span></li>
                <li><span className="footer-static-item">Destination Novelty & Policy</span></li>
                <li><span className="footer-static-item">Isolation Forest Anomaly Tree</span></li>
                <li><span className="footer-static-item">Departmental Role Cohorts</span></li>
                <li><span className="footer-static-item">7-Day Slow-Leak Accumulator</span></li>
              </ul>
            </div>

            {/* Col 4: Trust & Compliance */}
            <div className="footer-col">
              <h4 className="footer-col-title">Trust & Privacy</h4>
              <ul className="footer-nav-list">
                <li><a href="#privacy" className="footer-link">Zero Payload Guarantee</a></li>
                <li><span className="footer-static-item">GDPR Article 5 Minimization</span></li>
                <li><span className="footer-static-item">HIPAA Privacy Rule Compliant</span></li>
                <li><span className="footer-static-item">Pseudonymous Entity Graph</span></li>
                <li><span className="footer-static-item">Human-in-the-Loop Posture</span></li>
              </ul>
            </div>

          </div>

          {/* Bottom Copyright & Disclaimer Bar */}
          <div className="footer-bottom-bar">
            <div className="footer-copyright-text">
              © {new Date().getFullYear()} CipherSentinel. MITRE ATT&CK T1567 Insider Threat Intelligence Prototype.
            </div>
            <div className="footer-bottom-status">
              <span className="status-live-dot" />
              <span>Telemetry Engine Active • Prepared Synthetic Dataset Seed 42</span>
            </div>
          </div>

        </div>
      </div>

    </footer>
  )
}
