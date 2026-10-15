import { useEffect, useMemo, useState } from 'react'
import { fetchCertificateDevices, fetchTransfers, fetchTransferInbox, loginTransfer, sendTransfer, downloadTransfer } from '../api.js'

const SESSION_KEY = 'ciphersentinel.transfer.session'
const fmtBytes = (n) => n < 1024 ? `${n} B` : `${(n / 1024 / 1024).toFixed(2)} MB`

export default function TransferPage() {
  const [devices, setDevices] = useState([])
  const [session, setSession] = useState(() => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch { return null } })
  const [pin, setPin] = useState('')
  const [deviceId, setDeviceId] = useState('ADMIN')
  const [recipient, setRecipient] = useState('')
  const [file, setFile] = useState(null)
  const [events, setEvents] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const activeDevices = useMemo(() => devices.filter(d => d.enrollment_status === 'enrolled' && d.lifecycle_status === 'active'), [devices])

  useEffect(() => {
    fetchCertificateDevices().then(data => { setDevices(data.devices || []); setRecipient(data.devices?.find(d => d.organization_id === 'ORG-A' && d.device_id !== 'ORG-A-DEVICE-001')?.device_id || data.devices?.[0]?.device_id || '') }).catch(() => setError('Could not load enrolled devices. Check that the API is running.'))
  }, [])
  useEffect(() => {
    if (!session?.token) return
    const load = () => fetchTransfers(session.token).then(data => setEvents(data.transfers || [])).catch(() => { setSession(null); sessionStorage.removeItem(SESSION_KEY) })
    load()
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [session?.token])

  async function signIn(e) {
    e.preventDefault(); setError(''); setMessage('')
    try { const result = await loginTransfer(deviceId, pin); setSession(result); sessionStorage.setItem(SESSION_KEY, JSON.stringify(result)); setPin('') }
    catch (err) { setError(err.response?.data?.detail || 'Sign in failed') }
  }
  function signOut() { sessionStorage.removeItem(SESSION_KEY); setSession(null); setEvents([]); setMessage('') }
  async function transfer(e) {
    e.preventDefault(); setError(''); setMessage('')
    if (!file) return setError('Choose a file first.')
    if (file.size > 5 * 1024 * 1024) return setError('Files must be 5 MB or smaller.')
    try {
      const content_base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file) })
      const event = await sendTransfer(session.token, { to_device_id: recipient, filename: file.name, content_type: file.type || 'application/octet-stream', content_base64 })
      setMessage(event.status === 'blocked' ? `Blocked as malicious activity: ${event.reason}. The admin dashboard has recorded this event.` : `Delivered ${event.filename} to ${event.to_device_id}.`)
      setFile(null); e.target.reset()
      const data = await fetchTransfers(session.token); setEvents(data.transfers || [])
    } catch (err) { setError(err.response?.data?.detail || 'Transfer failed') }
  }
  async function getInbox() { try { const data = await fetchTransferInbox(session.token); setEvents(data.transfers || []) } catch (err) { setError(err.response?.data?.detail || 'Could not load inbox') } }

  const isAdmin = session?.role === 'admin'
  return <div className="transfer-page">
    <header className="transfer-header"><div><div className="transfer-eyebrow">DEVICE-TO-DEVICE DEMO</div><h1>Secure file transfer</h1><p>Verify an enrolled device, send a file, and review the policy decision.</p></div>{session && <button className="transfer-secondary" onClick={signOut}>Sign out · {isAdmin ? 'Admin' : session.device_id}</button>}</header>
    <div className="transfer-notice"><strong>Local demo mode</strong><span>Device identity is matched to the certificate inventory after PIN login. The current localhost setup does not perform mutual TLS. Files are limited to 5 MB and kept in memory until the API restarts.</span></div>
    {!session ? <section className="transfer-card transfer-login"><div><h2>Sign in to a demo identity</h2><p>Use an active enrolled device or the admin view. Demo PIN: <strong>246810</strong></p></div><form onSubmit={signIn}>
      <label>Identity<select value={deviceId} onChange={e => setDeviceId(e.target.value)}><option value="ADMIN">Admin dashboard</option>{activeDevices.map(d => <option key={d.device_id} value={d.device_id}>{d.device_id} · {d.organization_id}</option>)}</select></label>
      <label>Demo PIN<input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter demo PIN" required /></label>
      <button className="transfer-primary">Verify and sign in</button></form></section> : isAdmin ? <section className="transfer-card"><div className="transfer-section-heading"><div><h2>Admin transfer monitor</h2><p>All device transfer decisions across the demo.</p></div><span className="transfer-count">{events.length} events</span></div><EventList events={events} devices={devices} admin /></section> : <>
      <section className="transfer-card transfer-send"><div className="transfer-section-heading"><div><h2>Send a file</h2><p>Signed in as <strong>{session.device_id}</strong> · {activeDevices.find(d => d.device_id === session.device_id)?.organization_id}</p></div><span className="transfer-secure">✓ Device verified</span></div>
        <form onSubmit={transfer} className="transfer-form"><label>Recipient device<select value={recipient} onChange={e => setRecipient(e.target.value)}>{activeDevices.filter(d => d.device_id !== session.device_id).map(d => <option key={d.device_id} value={d.device_id}>{d.device_id} · {d.organization_id}</option>)}</select></label><label className="transfer-file-label">File (up to 5 MB)<input type="file" onChange={e => setFile(e.target.files?.[0] || null)} /></label><button className="transfer-primary" disabled={!recipient || !file}>Send file</button></form>
        <p className="transfer-policy">Transfers between organizations are blocked by policy and appear in the admin monitor as malicious activity. Same-organization transfers are delivered to the recipient inbox.</p>
      </section>
      <section className="transfer-card"><div className="transfer-section-heading"><div><h2>My device activity</h2><p>Recent sent and received files.</p></div><button className="transfer-secondary" onClick={getInbox}>Show received files</button></div><EventList events={events} devices={devices} onDownload={async event => { try { await downloadTransfer(session.token, event.id, event.filename) } catch (err) { setError(err.response?.data?.detail || 'File unavailable') } }} current={session.device_id} /></section>
    </>}
    {(message || error) && <div className={`transfer-feedback ${error ? 'is-error' : message.startsWith('Blocked') ? 'is-blocked' : 'is-success'}`} role="status">{error || message}</div>}
    <div className="transfer-demo-tip"><strong>Live demo flow</strong><span>Sign in as an ORG-A device and send a PDF to the ORG-B device to show the blocked alert. Sign in as Admin to monitor decisions, or use a second ORG-A device to demonstrate delivery and inbox download.</span></div>
  </div>
}

function EventList({ events, devices, admin = false, current, onDownload }) {
  const names = Object.fromEntries(devices.map(d => [d.device_id, `${d.device_id} (${d.organization_id})`]))
  if (!events.length) return <div className="transfer-empty">No transfer events yet. Send a file to populate this activity feed.</div>
  return <div className="transfer-events">{events.map(event => <article className={`transfer-event ${event.status}`} key={event.id}><div className="transfer-event-icon">{event.status === 'blocked' ? '!' : '↗'}</div><div className="transfer-event-main"><strong>{event.filename}</strong><span>{names[event.from_device_id] || event.from_device_id} → {names[event.to_device_id] || event.to_device_id}</span><small>{new Date(event.timestamp).toLocaleString()} · {fmtBytes(event.size_bytes)}</small>{event.reason && <small className="transfer-reason">{event.reason}</small>}</div><div className={`transfer-status ${event.status}`}>{event.status === 'blocked' ? 'Blocked · malicious' : 'Delivered'}</div>{!admin && event.status === 'delivered' && event.to_device_id === current && onDownload && <button className="transfer-download" onClick={() => onDownload(event)}>Download</button>}</article>)}</div>
}
