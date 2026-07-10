import { useEffect, useState, useCallback } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, DIVISION, DIVISION_NAME, SPONSORS, SEASON } from '../config.js'
import { fetchStandingsBundle } from '../api.js'
import { track } from '../analytics.js'
import { destination } from '../embed.js'
import TeamLogo from './TeamLogo.jsx'

const REFRESH_MS = 120000

// Compact NFC North standings for sidebar/in-article embeds. The whole card is one link into
// the full tracker (target=_top navigates the hosting page, not the iframe). Fail-soft.
export default function MiniStandings() {
  const [bundle, setBundle] = useState(null)

  const load = useCallback(() => {
    fetchStandingsBundle().then(setBundle).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const refresh = () => { if (!document.hidden) load() }
    const id = setInterval(refresh, REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [load])

  const card = {
    display: 'block', maxWidth: 420, margin: '0 auto', textDecoration: 'none', overflow: 'hidden',
    background: '#fff', border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`,
    borderRadius: 8, fontFamily: theme.sans,
  }
  const band = (text) => (
    <div style={{ background: theme.green, color: '#fff', fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', padding: '5px 8px', textAlign: 'center' }}>{text}</div>
  )
  const footer = (
    <div style={{ borderTop: `1px solid ${theme.rule}`, margin: '0 12px', padding: '7px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      {SPONSORS.header ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{ fontSize: 8, letterSpacing: '0.12em', fontWeight: 700, color: theme.goldText, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Presented by</span>
          {SPONSORS.header.logo
            ? <img src={SPONSORS.header.logo} alt={SPONSORS.header.name} style={{ height: 20, objectFit: 'contain', display: 'block' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
            : <span style={{ fontSize: 8.5, color: theme.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SPONSORS.header.name}</span>}
        </span>
      ) : <span />}
      <span style={{ fontSize: 11, fontWeight: 700, color: theme.green, whiteSpace: 'nowrap' }}>Full tracker {'→'}</span>
    </div>
  )
  const linkProps = { href: destination(), target: '_top', onClick: () => track('Mini Click', { widget: 'standings' }) }

  if (!bundle) {
    return (
      <a {...linkProps} className="mini-card" style={card}>
        {band(`${DIVISION_NAME} standings`)}
        <div style={{ padding: '16px 14px', fontFamily: theme.serif, fontSize: 16, color: theme.ink, textAlign: 'center' }}>The Packers, by the numbers</div>
        {footer}
      </a>
    )
  }

  const rows = bundle.standings
  const stale = bundle.season < SEASON
  const th = { fontFamily: theme.sans, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, textAlign: 'right', padding: '4px 6px' }
  const td = { fontFamily: theme.sans, fontSize: 12.5, color: theme.ink, textAlign: 'right', padding: '5px 6px', borderTop: `1px solid ${theme.rule}`, whiteSpace: 'nowrap' }

  return (
    <a {...linkProps} className="mini-card" style={card}>
      {band(`${DIVISION_NAME} standings${stale ? ` · final ${bundle.season}` : ''}`)}
      <div style={{ padding: '6px 12px 2px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Team</th>
              <th style={th}>W</th><th style={th}>L</th><th style={th}>T</th><th style={th}>Pct</th><th style={th}>Strk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const me = t.id === TEAM_ID
              const sc = t.streak || '—'
              return (
                <tr key={t.id} style={me ? { background: theme.wash } : undefined}>
                  <td style={{ ...td, textAlign: 'left' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: theme.serif, fontSize: 14, fontWeight: me ? 700 : 400, color: me ? theme.green : theme.ink }}>
                      <TeamLogo id={t.id} size={18} />
                      {DIVISION[t.id] || t.name}
                    </span>
                  </td>
                  <td style={td}>{t.wins}</td>
                  <td style={td}>{t.losses}</td>
                  <td style={td}>{t.ties}</td>
                  <td style={td}>{t.pct}</td>
                  <td style={{ ...td, color: sc[0] === 'W' ? theme.green : sc[0] === 'L' ? theme.red : theme.muted, fontWeight: 700 }}>{sc}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {footer}
    </a>
  )
}
