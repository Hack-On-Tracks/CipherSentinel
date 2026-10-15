import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import TopBar from './components/TopBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AlertsPage from './pages/AlertsPage.jsx'
import ReplayPage from './pages/ReplayPage.jsx'
import EntitiesPage from './pages/EntitiesPage.jsx'
import ComparePage from './pages/ComparePage.jsx'
import LimitsPage from './pages/LimitsPage.jsx'
import LandingPage from './components/landing/LandingPage.jsx'
import { fetchAlerts } from './api.js'
import { MOCK_ALERTS } from './mockData.js'

const VALID_PAGES = ['landing', 'dashboard', 'alerts', 'replay', 'entities', 'compare', 'limits']

function getPageFromUrl() {
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  if (VALID_PAGES.includes(hash)) return hash

  const path = window.location.pathname.replace(/^\/|\/$/g, '').toLowerCase()
  if (VALID_PAGES.includes(path)) return path
  if (path === '' || path === 'index.html' || path === 'home') return 'landing'

  return 'landing'
}

export default function App() {
  const [page, setPageState] = useState(getPageFromUrl)
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [theme, setTheme] = useState('light')
  const [searchQuery, setSearchQuery] = useState('')

  // Navigate and sync URL + document title
  const navigate = useCallback((newPage) => {
    if (!VALID_PAGES.includes(newPage)) return
    setPageState(newPage)

    const newPath = newPage === 'landing' ? '/' : `/${newPage}`
    if (window.location.pathname !== newPath) {
      window.history.pushState({ page: newPage }, '', newPath)
    }

    const titleMap = {
      landing: 'CipherSentinel – Insider Threat Intelligence',
      dashboard: 'Dashboard – CipherSentinel',
      alerts: 'Alerts – CipherSentinel',
      replay: 'Scenario Replay – CipherSentinel',
      entities: 'Entities & Baselines – CipherSentinel',
      compare: 'Model Benchmark – CipherSentinel',
      limits: 'System Limits – CipherSentinel',
    }
    document.title = titleMap[newPage] || 'CipherSentinel'
  }, [])

  // Listen to browser Back/Forward (popstate & hashchange)
  useEffect(() => {
    const handlePopState = () => {
      const pageFromUrl = getPageFromUrl()
      setPageState(pageFromUrl)
    }

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('hashchange', handlePopState)

    // Synchronize initial URL
    const initialPage = getPageFromUrl()
    const targetPath = initialPage === 'landing' ? '/' : `/${initialPage}`
    if (window.location.pathname !== targetPath && !window.location.hash) {
      window.history.replaceState({ page: initialPage }, '', targetPath)
    }

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('hashchange', handlePopState)
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      try { return await fetchAlerts(false) }
      catch { return { alerts: MOCK_ALERTS, total: MOCK_ALERTS.length } }
    },
    refetchInterval: 5000,
    placeholderData: { alerts: MOCK_ALERTS, total: MOCK_ALERTS.length },
  })

  const alerts = alertsData?.alerts || MOCK_ALERTS
  const alertCounts = {
    high: alerts.filter(a => a.severity === 'high').length,
    review: alerts.filter(a => a.severity === 'review').length,
  }

  // If on landing page, render LandingPage with navigate helper
  if (page === 'landing') {
    return <LandingPage onGetStarted={() => navigate('dashboard')} />
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard setPage={navigate} setSelectedAlert={setSelectedAlert} />
      case 'alerts':    return <AlertsPage />
      case 'replay':    return <ReplayPage />
      case 'entities':  return <EntitiesPage />
      case 'compare':   return <ComparePage />
      case 'limits':    return <LimitsPage />
      default:          return <Dashboard setPage={navigate} setSelectedAlert={setSelectedAlert} />
    }
  }

  return (
    <div className="app-root" data-theme={theme}>
      <div className="layout">
        <Sidebar page={page} setPage={navigate} alertCounts={alertCounts} />
        <div className="layout-main">
          <TopBar
            page={page}
            setPage={navigate}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            theme={theme}
            setTheme={setTheme}
          />
          <main className="main-content" id="main-content" role="main">
            {renderPage()}
          </main>
        </div>
      </div>
    </div>
  )
}
