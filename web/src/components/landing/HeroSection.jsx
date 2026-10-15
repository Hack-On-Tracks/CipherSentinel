import React from 'react'
import { ArrowRight, Play } from '../icons/LucideIcons.jsx'
import TrafficFlowIllustration from './TrafficFlowIllustration.jsx'

export default function HeroSection({ onGetStarted, onWatchDemo }) {
  return (
    <section className="hero-section" aria-labelledby="hero-headline">
      <div className="hero-layout-grid">
        
        {/* LEFT COLUMN: 45% Width */}
        <div className="hero-text-column">
          
          {/* Top Pill Badge */}
          <div className="hero-badge-pill" role="note">
            <span className="badge-bullet" aria-hidden="true">●</span>
            <span className="badge-text">AI-POWERED &nbsp;•&nbsp; PRIVACY-FIRST &nbsp;•&nbsp; ENCRYPTED TRAFFIC</span>
          </div>

          {/* Main Headline (Exact text & colors matching screenshot) */}
          <h1 id="hero-headline" className="hero-main-headline">
            <span className="headline-dark">Detect Early.</span>
            <br />
            <span className="headline-green">Prevent Always.</span>
          </h1>

          {/* Supporting Paragraph */}
          <p className="hero-supporting-paragraph">
            CipherSentinel analyzes encrypted network traffic metadata to detect insider threats, identify risky behavior, and provide explainable alerts — without reading payload content.
          </p>

          {/* Horizontally Aligned CTA Buttons */}
          <div className="hero-cta-group">
            <button
              type="button"
              className="btn-hero-primary"
              onClick={onGetStarted}
              aria-label="Get Started with CipherSentinel"
            >
              <span>Get Started</span>
              <ArrowRight size={18} strokeWidth={2.4} className="hero-arrow-icon" />
            </button>

            <button
              type="button"
              className="btn-hero-secondary"
              onClick={onWatchDemo}
              aria-label="Watch interactive product demo"
            >
              <Play size={18} color="#064E3B" className="hero-play-icon" />
              <span>Watch Demo</span>
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: 55% Width Illustration */}
        <div className="hero-illustration-column">
          <TrafficFlowIllustration />
        </div>

      </div>
    </section>
  )
}
