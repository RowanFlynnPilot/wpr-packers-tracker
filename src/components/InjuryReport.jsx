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
//
// Two groups: THIS WEEK's game statuses (out, doubtful, questionable) lead, because that's the
// news a reader came for; injured reserve — long-term, already known — follows. Sorted purely
// by severity, IR came first and the week's "Out" list (Micah Parsons, Oct 2026) sat at the
// bottom of nineteen cards.
const SEVERITY = { out: 3, 'injured reserve': 4, ir: 4, doubtful: 2, questionable: 1 }
const sev = (status) => SEVERITY[(status || '').toLowerCase()] ?? 1
const isIR = (status) => sev(status) === 4

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
      fontFamily: theme.sans, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: sev(status) >= 3 ? '#fff' : theme.green,
      background: sev(status) >= 3 ? theme.red : theme.gold,
      borderRadius: 3, padding: '2px 6px', whiteSpace: 'nowrap',
    }}>{isIR(status) ? 'IR' : status}</span>
  )

  const groups = [
    { label: 'This week', list: players.filter((p) => !isIR(p.status)) },
    { label: 'Injured reserve', list: players.filter((p) => isIR(p.status)) },
  ].filter((g) => g.list.length)

  return (
    <Section kicker="The trainer's room" title="Injury report">
      {groups.map((g, gi) => (
      <div key={g.label} style={{ marginTop: gi ? 18 : 0 }}>
      {groups.length > 1 && (
        <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700, marginBottom: 8 }}>
          {g.label} <span style={{ color: theme.muted, fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>· {g.list.length}</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
        {g.list.map((p) => (
          <div key={p.id} role="button" tabIndex={0} onClick={() => openPlayerCard(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlayerCard(p.id) } }} className="card-hover"
            style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${theme.rule}`, borderRadius: 6, padding: '9px 11px', background: '#fff', cursor: 'pointer' }}>
            <img src={headshot(p.id, 34)} alt="" width={34} height={34} loading="lazy" decoding="async" style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              {/* Wraps rather than truncates — a card that says "Johnathan Bald…" tells the
                  reader less than it costs them, and half this roster has a long surname. */}
              <div style={{ fontFamily: theme.serif, fontSize: 14.5, color: theme.ink, lineHeight: 1.15 }}>{p.name}</div>
              <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 2 }}>{p.pos}{p.detail ? ` · ${p.detail}` : ''}</div>
            </div>
            {badge(p.status)}
          </div>
        ))}
      </div>
      </div>
      ))}
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 12 }}>
        {players.length} on the report · this week's game statuses first, most serious first
      </div>
    </Section>
  )
}
