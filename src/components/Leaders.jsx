import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { headshot, SEASON } from '../config.js'
import { fetchTeamLeaders, fetchLeagueLeaders } from '../api.js'
import { Loading, ErrorState } from './Status.jsx'
import { openPlayerCard } from './PlayerCard.jsx'

// Team statistical leaders, offense and defense, with NFL top-5 rank chips. One leaders fetch
// (resolved through the roster) + one league-wide fetch for the chips. Before Week 1 these are
// last season's final leaders, labeled.

const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
const CAT_SHORT = {
  passingYards: 'passing', rushingYards: 'rushing', receivingYards: 'receiving',
  totalTackles: 'tackles', sacks: 'sacks', interceptions: 'INTs',
  passingTouchdowns: 'pass TD', rushingTouchdowns: 'rush TD', receivingTouchdowns: 'rec TD',
  receptions: 'catches', quarterbackRating: 'rating', totalPoints: 'scoring',
}
function rankNote(league, id) {
  if (!league) return null
  let best = null
  Object.entries(league).forEach(([cat, byId]) => {
    const rank = byId[id]
    if (rank && rank <= 5 && CAT_SHORT[cat] && (!best || rank < best.rank)) best = { rank, cat }
  })
  if (!best) return null
  const label = CAT_SHORT[best.cat]
  return best.rank === 1 ? `Leads the NFL · ${label}` : `${ord(best.rank)} in the NFL · ${label}`
}

// "Player to watch" spotlight above the tables: the passing leader and the tackles leader.
function Spotlight({ qb, def, league }) {
  const Item = ({ p, role }) => {
    if (!p?.name) return null
    const note = rankNote(league, p.id)
    return (
      <div role="button" tabIndex={0} onClick={() => openPlayerCard(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlayerCard(p.id) } }}
        style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 240px', cursor: 'pointer' }}>
        <img src={headshot(p.id)} alt="" width={64} height={64} style={{ borderRadius: '50%', background: '#fff', objectFit: 'cover', flexShrink: 0, boxShadow: `0 0 0 2px ${theme.gold}` }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>{role}</div>
          <div style={{ fontFamily: theme.serif, fontSize: 19, color: theme.ink }}>{p.name}</div>
          <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 1 }}>
            {[p.pos && `${p.pos}${p.jersey ? ` #${p.jersey}` : ''}`, p.display].filter(Boolean).join(' · ')}
          </div>
          {note && <div style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: theme.goldText, marginTop: 2 }}>{note}</div>}
        </div>
      </div>
    )
  }
  if (!qb?.name && !def?.name) return null
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 8, padding: '16px 18px', marginBottom: 26, background: theme.wash }}>
      <Item p={qb} role="Running the offense" />
      <Item p={def} role="Anchoring the defense" />
    </div>
  )
}

// One leader board. The top player reads as the headline — bigger headshot, gold ring, bold
// value — and every row carries a proportional bar so the gaps are visible at a glance, not
// just legible in the numbers.
function LeaderTable({ title, rows, league }) {
  if (!rows?.length) return null
  const max = Math.max(...rows.map((r) => r.value || 0)) || 1
  return (
    <div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, marginBottom: 10, fontWeight: 700 }}>{title}</div>
      {rows.map((r, i) => {
        const note = rankNote(league, r.id)
        const lead = i === 0
        return (
          <div key={r.id} className="hover-row" onClick={() => openPlayerCard(r.id)} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlayerCard(r.id) } }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: lead ? '9px 6px' : '7px 6px', borderTop: i ? `1px solid ${theme.rule}` : 'none', cursor: 'pointer' }}>
            <img src={headshot(r.id)} alt="" width={lead ? 40 : 30} height={lead ? 40 : 30}
              style={{ borderRadius: '50%', background: theme.wash, objectFit: 'cover', flexShrink: 0, boxShadow: lead ? `0 0 0 2px ${theme.gold}` : undefined }}
              onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ fontFamily: theme.serif, fontSize: lead ? 16 : 15, fontWeight: lead ? 700 : 400, color: theme.ink }}>{r.name || 'Unknown'}</span>
                  {r.pos && <span style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted }}> · {r.pos}</span>}
                </span>
                <span style={{ fontFamily: theme.sans, fontSize: lead ? 14 : 12.5, fontWeight: lead ? 700 : 400, color: theme.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{r.display}</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: theme.wash, marginTop: 5, overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, height: '100%', borderRadius: 2, background: theme.green }} />
              </div>
              {note && <div style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: theme.goldText, marginTop: 3, whiteSpace: 'nowrap' }}>{note}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// `side` selects which unit to show: 'offense' or 'defense'.
export default function Leaders({ side }) {
  const [data, setData] = useState(null)
  const [league, setLeague] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchTeamLeaders().then(setData).catch(() => setError(true))
    fetchLeagueLeaders().then(setLeague).catch(() => {})
  }, [])

  if (error) return <ErrorState />
  if (!data) return <Loading />

  const c = data.categories
  const top = (cat, n) => (c[cat] || []).filter((l) => l.name).slice(0, n)
  const offense = side === 'offense'

  const tables = offense
    ? [
        ['Passing yards', top('passingYards', 3)],
        ['Rushing yards', top('rushingYards', 5)],
        ['Receiving yards', top('receivingYards', 5)],
      ]
    : [
        ['Tackles', top('totalTackles', 5)],
        ['Sacks', top('sacks', 5)],
        ['Interceptions', top('interceptions', 4)],
      ]

  if (!tables.some(([, rows]) => rows.length)) {
    return <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>Leaders appear once the season has stats.</div>
  }

  return (
    <div>
      <Spotlight
        league={league}
        qb={offense
          ? top('passingLeader', 1)[0]
            // The passingYards fallback's display is a bare number — give it its unit, same
            // treatment as the tackles line below.
            || (() => { const t = top('passingYards', 1)[0]; return t && { ...t, display: `${t.display} pass yds` } })()
          : null}
        def={offense ? null : (() => { const t = top('totalTackles', 1)[0]; return t && { ...t, display: `${t.display} tackles` } })()}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 32 }}>
        {tables.map(([title, rows]) => <LeaderTable key={title} title={title} rows={rows} league={league} />)}
      </div>
      {data.season < SEASON && (
        <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 16 }}>
          Final {data.season} leaders — the new season's numbers take over after Week 1.
        </div>
      )}
    </div>
  )
}
