const LIMITS = [
  {
    icon: '🔒',
    title: 'Encrypted Client Hello (ECH)',
    desc: 'When ECH is active, the TLS handshake hides the server name (SNI). CipherSentinel falls back to IP novelty, volume patterns and timing signals, but loses service identification.',
  },
  {
    icon: '🌐',
    title: 'QUIC / HTTP3',
    desc: 'QUIC encrypts more of the handshake than TLS 1.3 and is harder to parse at the flow level. Packet-level features are available; SNI is often absent.',
  },
  {
    icon: '🔐',
    title: 'VPN Tunnels',
    desc: 'If an insider routes exfiltration through a corporate-sanctioned VPN or an approved proxy, all flows appear as a single approved destination. The system is blind inside the tunnel.',
  },
  {
    icon: '🐢',
    title: 'Ultra-low-and-slow Theft',
    desc: 'An attacker who stays below 5 MB/day to a sanctioned service (e.g. GitHub) may never cross the slow-leak threshold. Evasion is possible but costly in time.',
  },
  {
    icon: '📡',
    title: 'Shared CDN Addresses',
    desc: 'Many services share CDN IP ranges (Cloudflare, Akamai). If ECH is active, a destination like mega.nz may be indistinguishable from a legitimate CDN host by IP alone.',
  },
  {
    icon: '🤖',
    title: 'Synthetic Data Only',
    desc: 'All labelled exfiltration scenarios are synthetic. Results show the detector is internally coherent. Real-world performance requires a pilot on actual flow logs.',
  },
  {
    icon: '📱',
    title: 'No Endpoint Signal',
    desc: 'Without an endpoint agent, there is no visibility into which process or application generated the traffic. A sync client looks the same as a browser in the JA4 fingerprint band.',
  },
  {
    icon: '🏢',
    title: 'No Payload Inspection',
    desc: 'CipherSentinel never reads file contents. It can show a transfer was unusually large to a personal storage site, but it cannot confirm that the file was confidential. The output is a risk ranking, not a leak detection.',
  },
]

const WHAT_WE_SEE = [
  { signal: 'Bytes and packets per direction', notes: 'Always visible' },
  { signal: 'Timing, duration, gaps between connections', notes: 'Always visible' },
  { signal: 'Destination IP and port', notes: 'Always visible' },
  { signal: 'Server name (SNI)', notes: 'Visible unless ECH or QUIC' },
  { signal: 'JA4 client fingerprint', notes: 'Visible in TLS handshake' },
  { signal: 'Certificate fields', notes: 'TLS 1.2 only; encrypted in 1.3' },
  { signal: 'File contents', notes: '🚫 Never – not inspected' },
  { signal: 'Application-layer payload', notes: '🚫 Never – not inspected' },
]

export default function LimitsPage() {
  return (
    <div>
      <h1 className="page-title">🔍 System Limits</h1>
      <p className="page-subtitle">
        What CipherSentinel can and cannot see · transparency is part of the design
      </p>

      {/* Privacy statement */}
      <div style={{
        padding: '16px 20px',
        background: 'rgba(34,211,165,0.06)',
        border: '1px solid rgba(34,211,165,0.2)',
        borderRadius: 12,
        marginBottom: 24,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}>
        <div style={{ fontSize: 24 }}>🛡️</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 6 }}>
            Privacy by Design
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6 }}>
            CipherSentinel operates exclusively on TLS flow <strong>metadata</strong>: connection timing, byte counts and server names.
            Zero payload bytes are read or stored. User identities are pseudonymous by default.
            The system <strong>recommends</strong> analyst review; it never blocks traffic or disables accounts automatically.
          </div>
        </div>
      </div>

      {/* Visibility table */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>👁 What Encryption Still Reveals</div>
        <div className="table-wrap">
          <table aria-label="Signal visibility table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Availability</th>
              </tr>
            </thead>
            <tbody>
              {WHAT_WE_SEE.map(r => (
                <tr key={r.signal}>
                  <td style={{ fontWeight: 500, color: 'var(--text-0)' }}>{r.signal}</td>
                  <td style={{
                    color: r.notes.includes('Never') ? 'var(--risk-high)' :
                           r.notes.includes('unless') ? 'var(--risk-review)' :
                           'var(--accent-green)',
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {r.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Limits grid */}
      <div className="card-title" style={{ marginBottom: 16 }}>⚠️ Known Limitations</div>
      <div className="limits-grid">
        {LIMITS.map((l, i) => (
          <div key={i} className="limit-item">
            <div className="limit-icon">{l.icon}</div>
            <div>
              <div className="limit-title">{l.title}</div>
              <div className="limit-desc">{l.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Judge Q&A */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>❓ Anticipated Questions</div>
        {[
          {
            q: "How do you know it works on real traffic?",
            a: "We don't yet. The evaluation uses injected scenarios in synthetic flow logs. The next step is a pilot on an organisation's own Zeek flow logs with appropriate data-governance sign-off.",
          },
          {
            q: "Why not decrypt traffic?",
            a: "TLS interception adds legal, privacy, and certificate-pinning problems. Metadata analysis achieves useful signal without any of those risks and without touching content.",
          },
          {
            q: "Can an attacker evade this?",
            a: "Yes: by throttling below the baseline, by using a sanctioned service, or by tunnelling through an approved proxy. The slow-leak accumulator raises the time-cost of evasion but does not eliminate it.",
          },
          {
            q: "Why no deep learning?",
            a: "There are no real labelled exfiltration examples to train a deep model on. Interpretable signals can be defended line by line to an analyst or a regulator. Online autoencoders such as Kitsune are the roadmap item.",
          },
        ].map((qa, i) => (
          <div key={i} style={{
            borderBottom: i < 3 ? '1px solid var(--border-subtle)' : 'none',
            paddingBottom: 16,
            marginBottom: i < 3 ? 16 : 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', marginBottom: 6 }}>Q: {qa.q}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>A: {qa.a}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
