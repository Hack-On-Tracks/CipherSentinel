import React, { useState } from 'react'
import Navbar from './Navbar.jsx'
import HeroSection from './HeroSection.jsx'
import KeyMetricsBar from './KeyMetricsBar.jsx'
import HowItWorksSection from './HowItWorksSection.jsx'
import ScenariosSection from './ScenariosSection.jsx'
import BenchmarkSection from './BenchmarkSection.jsx'
import PrivacySection from './PrivacySection.jsx'
import LandingFooter from './LandingFooter.jsx'
import DemoModal from './DemoModal.jsx'
import InfoDrawer from './InfoDrawer.jsx'
import { Mouse, ChevronDown } from '../icons/LucideIcons.jsx'
import './LandingPage.css'

export default function LandingPage({ onGetStarted, onNavigate }) {
  const navigateFn = onNavigate || onGetStarted
  const [activeNav, setActiveNav] = useState('Home')
  const [demoModalOpen, setDemoModalOpen] = useState(false)
  const [drawerSection, setDrawerSection] = useState(null)

  const handleNavClick = (section) => {
    setActiveNav(section)
    if (section === 'Home') {
      setDrawerSection(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleCloseDrawer = () => {
    setDrawerSection(null)
    setActiveNav('Home')
  }

  const handleScrollExplore = () => {
    const el = document.getElementById('how-it-works')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="cipher-landing-wrapper">
      {/* 1. Navigation Bar */}
      <Navbar
        activeNav={activeNav}
        onNavClick={handleNavClick}
        onGetStarted={onGetStarted}
      />

      {/* 2. Hero Section (Centered primary viewport content matching exact screenshot) */}
      <main className="hero-main-container">
        <HeroSection
          onGetStarted={onGetStarted}
          onWatchDemo={() => setDemoModalOpen(true)}
        />
      </main>

      {/* 3. Bottom Indicator: Scroll To Explore */}
      <div
        className="landing-bottom-indicator"
        onClick={handleScrollExplore}
        role="button"
        tabIndex={0}
        aria-label="Scroll to explore CipherSentinel platform"
      >
        <div className="scroll-explore-group">
          <Mouse size={22} color="#58616A" strokeWidth={1.75} />
          <span className="scroll-explore-text">SCROLL TO EXPLORE</span>
          <ChevronDown size={14} color="#58616A" strokeWidth={2.2} />
        </div>
      </div>

      {/* 4. Layered Organic Dune Waves (Bottom Edge of Hero) */}
      <div className="landing-dunes-container" aria-hidden="true">
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="bottom-dunes-svg"
        >
          <path
            d="M 0 50 Q 220 115 540 100 Q 720 105 900 100 Q 1220 115 1440 40 L 1440 120 L 0 120 Z"
            fill="#EDE8DC"
            opacity="0.55"
          />
          <path
            d="M 0 75 Q 260 120 580 108 Q 720 110 860 108 Q 1180 120 1440 65 L 1440 120 L 0 120 Z"
            fill="#E6E0D2"
            opacity="0.6"
          />
          <path
            d="M 0 95 Q 300 122 620 115 Q 720 116 820 115 Q 1140 122 1440 85 L 1440 120 L 0 120 Z"
            fill="#DFD9C9"
            opacity="0.45"
          />
        </svg>
      </div>

      {/* 5. Key Metrics & Impact Bar */}
      <KeyMetricsBar />

      {/* 6. How It Works Pipeline Architecture */}
      <HowItWorksSection />

      {/* 7. MITRE ATT&CK T1567 Scenarios Benchmark Showcase */}
      <ScenariosSection
        onLaunchDashboard={() => navigateFn('dashboard')}
        onReplayScenario={() => navigateFn('replay')}
      />

      {/* 8. Scientific 4-Method Empirical Benchmark */}
      <BenchmarkSection />

      {/* 9. Privacy-by-Design & Compliance Pillars */}
      <PrivacySection />

      {/* 10. Pre-Footer Hero CTA & Comprehensive Footer */}
      <LandingFooter
        onLaunchDashboard={() => navigateFn('dashboard')}
        onLaunchReplay={() => navigateFn('replay')}
        onLaunchEntities={() => navigateFn('entities')}
      />

      {/* 11. Interactive Architecture Walkthrough Demo Modal */}
      <DemoModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        onLaunchDashboard={() => navigateFn('dashboard')}
      />

      {/* 12. Information Drawer (if invoked) */}
      <InfoDrawer
        section={drawerSection}
        onClose={handleCloseDrawer}
        onLaunchDashboard={() => navigateFn('dashboard')}
      />
    </div>
  )
}
