import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import TopBar from './components/TopBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AlertsPage from './pages/AlertsPage.jsx'
import ReplayPage from './pages/ReplayPage.jsx'
import EntitiesPage from './pages/EntitiesPage.jsx'
import ComparePage from './pages/ComparePage.jsx'
import LimitsPage from './pages/LimitsPage.jsx'
import { fetchAlerts } from './api.js'
import { MOCK_ALERTS } from './mockData.js'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [theme, setTheme] = useState('light')
  const [searchQuery, setSearchQuery] = useState('')

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

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard setPage={setPage} setSelectedAlert={setSelectedAlert} />
      case 'alerts':    return <AlertsPage />
      case 'replay':    return <ReplayPage />
      case 'entities':  return <EntitiesPage />
      case 'compare':   return <ComparePage />
      case 'limits':    return <LimitsPage />
      default:          return <Dashboard setPage={setPage} setSelectedAlert={setSelectedAlert} />
    }
  }

  return (
    <div className="app-root" data-theme={theme}>
      <div className="layout">
        <Sidebar page={page} setPage={setPage} alertCounts={alertCounts} />
        <div className="layout-main">
          <TopBar
            page={page}
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
