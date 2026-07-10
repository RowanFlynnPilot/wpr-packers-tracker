import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { headshot } from '../config.js'
import { fetchRoster } from '../api.js'
import Section from './Section.jsx'
import { openPlayerCard } from './PlayerCard.jsx'

// "The trainer's room" — who's dinged up right now, from the injury tags ESPN carries on the
// roster feed (one fetch, shared with the leader tables). Owns its Section chrome and is fully
// fail-soft: no injuries (or a failed fetch) renders nothing at all — a healthy roster
// shouldn't show an empty sick bay.
const SEVERITY = { out: 3, 'injured reserve': 4, ir: 4, doubtful: 2, questionable: 1 }
const sev = (status) => SEVERITY[(status || '').toLowerCase()] ?? 1

export default function InjuryReport() {
  const [players, setPlayers] = useState(null)

  useEffect(() => {
    fetchRoster().then(({ list }) => {
      const hurt = list
        .map((p) => {
          const inj = p.injuries?.[0]
          if (!inj?.status) return null
          return { ...p, status: inj.status, detail: inj.details?.type || '' }
        })
        .filter(Boolean)
        .sort((a, b) => sev(b.status) - sev(a.status) || a.name.localeCompare(b.name))
      setPlayers(hurt)
    }).catch(() => {})
  }, [])

  if (!players || !players.length) return null

  const badge = (status) => (
    <span style={{
      fontFamily: theme.sans, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: sev(status) >= 3 ? '#fff' : theme.green,
      background: sev(status) >= 3 ? theme.red : theme.gold,
      borderRadius: 3, padding: '2px 6px', whiteSpace: 'nowrap',
    }}>{status}</span>
  )

  return (
    <Section kicker="The trainer's room" title="Injury report">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {players.map((p) => (
          <div key={p.id} role="button" tabIndex={0} onClick={() => openPlayerCard(p.id)} onKeyDown={(e) => e.key === 'Enter' && openPlayerCard(p.id)} className="card-hover"
            style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${theme.rule}`, borderRadius: 6, padding: '9px 11px', background: '#fff', cursor: 'pointer' }}>
            <img src={headshot(p.id)} alt="" width={34} height={34} style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: theme.serif, fontSize: 14.5, color: theme.ink, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 2 }}>{p.pos}{p.detail ? ` · ${p.detail}` : ''}</div>
            </div>
            {badge(p.status)}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 12 }}>
        {players.length} on the report · most serious first
      </div>
    </Section>
  )
}
