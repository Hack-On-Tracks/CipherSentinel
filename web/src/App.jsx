import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import TopBar   from './components/TopBar.jsx'
import Sidebar  from './components/Sidebar.jsx'
import Dashboard  from './pages/Dashboard.jsx'
import AlertsPage from './pages/AlertsPage.jsx'
import ReplayPage from './pages/ReplayPage.jsx'
import EntitiesPage from './pages/EntitiesPage.jsx'
import ComparePage  from './pages/ComparePage.jsx'
import LimitsPage   from './pages/LimitsPage.jsx'
import { fetchAlerts } from './api.js'
import { MOCK_ALERTS } from './mockData.js'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [selectedAlert, setSelectedAlert] = useState(null)

  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchAlerts(false),
    refetchInterval: 2000,
    placeholderData: { alerts: MOCK_ALERTS, total: MOCK_ALERTS.length },
  })

  const alerts = alertsData?.alerts || MOCK_ALERTS
  const alertCounts = {
    high:   alerts.filter(a => a.severity === 'high').length,
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
      default:          return <Dashboard setPage={setPage} />
    }
  }

  return (
    <>
      <div className="app-bg" aria-hidden="true" />
      <div className="layout">
        <TopBar page={page} setPage={setPage} />
        <div className="layout-body">
          <Sidebar page={page} setPage={setPage} alertCounts={alertCounts} />
          <main className="main-content" id="main-content" role="main">
            {renderPage()}
          </main>
        </div>
      </div>
    </>
  )
}
