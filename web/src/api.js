import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: BASE })

export const fetchHealth    = () => api.get('/health').then(r => r.data)
export const fetchAlerts    = (live = false) => api.get('/api/alerts', { params: { live, limit: 200 } }).then(r => r.data)
export const fetchAlert     = (id) => api.get(`/api/alerts/${id}`).then(r => r.data)
export const fetchTimeline  = (id) => api.get(`/api/entities/${id}/timeline`).then(r => r.data)
export const fetchEntities  = () => api.get('/api/entities').then(r => r.data)
export const fetchCompare   = () => api.get('/api/compare').then(r => r.data)
export const fetchScenarios = () => api.get('/api/scenarios').then(r => r.data)

export const startReplay    = (scenario = 'ALL') => api.post('/api/replay/start', null, { params: { scenario } }).then(r => r.data)
export const stopReplay     = () => api.post('/api/replay/stop').then(r => r.data)
export const postFeedback   = (id, verdict, notes = '') =>
  api.post(`/api/alerts/${id}/feedback`, { verdict, notes }).then(r => r.data)

export default api
