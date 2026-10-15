// Shared utilities for CipherSentinel UI

export function severityClass(severity) {
  return severity === 'high' ? 'high' : severity === 'review' ? 'review' : 'info'
}

export function riskColor(risk) {
  if (risk >= 70) return 'var(--risk-high)'
  if (risk >= 40) return 'var(--risk-review)'
  return 'var(--risk-info)'
}

export function formatBytes(bytes) {
  if (bytes == null) return '—'
  const b = Number(bytes)
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`
  return `${b} B`
}

export function formatWindow(w) {
  if (!w) return '—'
  return w.replace('T', ' ').slice(0, 16)
}

export function signalLabel(name) {
  const map = {
    self_deviation:     '📊 Self-Baseline',
    destination_policy: '🎯 Dest Policy',
    isolation_forest:   '🌲 Iso Forest',
    peer_deviation:     '👥 Peer Group',
    slow_leak:          '🐢 Slow-Leak',
  }
  return map[name] || name
}

export function categoryTag(cat) {
  const map = {
    anonymiser:            { label: '🔴 Anonymiser',    cls: 'anonymiser' },
    personal_file_sharing: { label: '🟠 Personal Share', cls: 'personal_file_sharing' },
    file_transfer:         { label: '🟣 File Transfer',  cls: 'file_transfer' },
    sanctioned:            { label: '🟢 Sanctioned',    cls: 'sanctioned' },
    personal_mail:         { label: '📧 Personal Mail', cls: 'file_transfer' },
    unknown:               { label: '⚪ Unknown',        cls: '' },
  }
  return map[cat] || { label: cat, cls: '' }
}

export function scenarioLabel(sc) {
  const map = {
    S1: '⚒ S1: Heavy Uploader',
    S2: '🚨 S2: Midnight Upload',
    S3: '🐌 S3: Low-and-Slow',
    S4: '🔧 S4: Sync Tool',
    S5: '📈 S5: Departing Employee',
    S6: '💻 S6: New Laptop (Hard –)',
    ALL: '🌐 Full Stream',
  }
  return map[sc] || sc
}
