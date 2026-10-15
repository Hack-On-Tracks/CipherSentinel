import React, { useState } from 'react'
import { CipherShield, ArrowRight, Menu, X } from '../icons/LucideIcons.jsx'

export default function Navbar({
  activeNav = 'Home',
  onNavClick,
  onGetStarted,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { id: 'Home', label: 'Home' },
    { id: 'How It Works', label: 'How It Works' },
    { id: 'Features', label: 'Features' },
    { id: 'Technology', label: 'Technology' },
    { id: 'About', label: 'About' },
  ]

  const handleItemClick = (id) => {
    onNavClick(id)
    setMobileMenuOpen(false)

    const sectionMap = {
      'Home': 0,
      'How It Works': 'how-it-works',
      'Features': 'scenarios',
      'Technology': 'benchmark',
      'About': 'privacy',
    }

    const target = sectionMap[id]
    if (target === 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target) {
      const el = document.getElementById(target)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  return (
    <header className="landing-navbar-header" role="banner">
      <nav className="landing-navbar" aria-label="Main Navigation">
        
        {/* Left: Brand Identity */}
        <div
          className="navbar-brand-group"
          onClick={() => handleItemClick('Home')}
          role="button"
          tabIndex={0}
          aria-label="CipherSentinel Home"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleItemClick('Home')
          }}
        >
          <div className="brand-logo-shield" aria-hidden="true">
            <CipherShield size={36} />
          </div>
          <div className="brand-titles">
            <span className="brand-name">CipherSentinel</span>
            <span className="brand-subtitle">Insider Threat Intelligence</span>
          </div>
        </div>

        {/* Center: Desktop Navigation Links */}
        <ul className="navbar-links" role="menubar">
          {navItems.map((item) => {
            const isActive = activeNav === item.id
            return (
              <li key={item.id} role="none" className="nav-item-wrapper">
                <button
                  type="button"
                  role="menuitem"
                  className={`nav-link-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => handleItemClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="nav-active-underline" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>

        {/* Right: Primary Call to Action */}
        <div className="navbar-actions">
          <button
            type="button"
            className="btn-get-started"
            onClick={onGetStarted}
            aria-label="Get Started with CipherSentinel"
          >
            <span>Get Started</span>
            <ArrowRight size={17} strokeWidth={2.2} className="btn-arrow-icon" />
          </button>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={22} color="#101820" /> : <Menu size={22} color="#101820" />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer" role="menu">
          <ul className="mobile-nav-list">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`mobile-nav-link ${activeNav === item.id ? 'is-active' : ''}`}
                  onClick={() => handleItemClick(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
            <li className="mobile-nav-cta">
              <button
                type="button"
                className="btn-get-started mobile-w-full"
                onClick={() => {
                  setMobileMenuOpen(false)
                  onGetStarted()
                }}
              >
                <span>Get Started</span>
                <ArrowRight size={17} strokeWidth={2.2} />
              </button>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
