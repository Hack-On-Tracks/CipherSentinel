import React from 'react'
import { ShieldCheck, EyeOff, Lock, CheckCircle2 } from '../icons/LucideIcons.jsx'

export default function PrivacySection() {
  const pillars = [
    {
      icon: <EyeOff size={24} color="#064E3B" strokeWidth={2} />,
      title: 'Zero Payload Inspection',
      desc: 'CipherSentinel never reads, proxies, decrypts, or archives packet bodies. Passwords, confidential messages, intellectual property, and personal photos remain cryptographically sealed.',
    },
    {
      icon: <Lock size={24} color="#064E3B" strokeWidth={2} />,
      title: 'Pseudonymous Entities',
      desc: 'All internal modeling operates on synthetic pseudonyms (e.g. U-008, U-019). Identity resolution happens exclusively within your secure SOC identity provider under strict access control.',
    },
    {
      icon: <ShieldCheck size={24} color="#064E3B" strokeWidth={2} />,
      title: 'Recommend-Only Posture',
      desc: 'The platform advises security analysts with clear evidence rather than automatically bricking developer laptops or terminating network access without human oversight.',
    },
    {
      icon: <CheckCircle2 size={24} color="#064E3B" strokeWidth={2} />,
      title: 'Regulatory Compliance',
      desc: 'Eliminating HTTPS man-in-the-middle decryption satisfies GDPR Article 5 data minimization, HIPAA patient confidentiality, and works council privacy mandates.',
    },
  ]

  return (
    <section id="privacy" className="privacy-section" aria-labelledby="privacy-title">
      <div className="section-container">
        
        {/* Header */}
        <div className="section-header-center">
          <div className="section-eyebrow">
            <span className="eyebrow-bullet">●</span>
            <span>PRIVACY-FIRST CYBERSECURITY</span>
          </div>
          <h2 id="privacy-title" className="section-title">
            Security Without Compromising Human Trust
          </h2>
          <p className="section-subtitle">
            Traditional DLP requires intrusive SSL-stripping proxies that introduce security vulnerabilities and regulatory liabilities. CipherSentinel proves metadata alone is sufficient to detect insider risk.
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="privacy-pillars-grid">
          {pillars.map((p, idx) => (
            <div key={idx} className="privacy-card">
              <div className="privacy-icon-wrap">{p.icon}</div>
              <h3 className="privacy-card-title">{p.title}</h3>
              <p className="privacy-card-desc">{p.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
