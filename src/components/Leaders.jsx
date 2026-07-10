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
function Spotlight({ qb, def }) {
  const Item = ({ p, role }) => !p?.name ? null : (
    <div role="button" tabIndex={0} onClick={() => openPlayerCard(p.id)} onKeyDown={(e) => e.key === 'Enter' && openPlayerCard(p.id)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 240px', cursor: 'pointer' }}>
      <img src={headshot(p.id)} alt="" width={54} height={54} style={{ borderRadius: '50%', background: theme.wash, objectFit: 'cover', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>{role}</div>
        <div style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink }}>{p.name}</div>
        <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 1 }}>{p.display}</div>
      </div>
    </div>
  )
  if (!qb?.name && !def?.name) return null
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 8, padding: '16px 18px', marginBottom: 26, background: theme.wash }}>
      <Item p={qb} role="Running the offense" />
      <Item p={def} role="Anchoring the defense" />
    </div>
  )
}

function LeaderTable({ title, rows, league }) {
  if (!rows?.length) return null
  return (
    <div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, marginBottom: 10, fontWeight: 700 }}>{title}</div>
      {rows.map((r, i) => {
        const note = rankNote(league, r.id)
        return (
          <div key={r.id} className="hover-row" onClick={() => openPlayerCard(r.id)} role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && openPlayerCard(r.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderTop: i ? `1px solid ${theme.rule}` : 'none', cursor: 'pointer' }}>
            <img src={headshot(r.id)} alt="" width={30} height={30} style={{ borderRadius: '50%', background: theme.wash, objectFit: 'cover', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontFamily: theme.serif, fontSize: 15, color: theme.ink }}>{r.name || 'Unknown'}</span>
              {r.pos && <span style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted }}> · {r.pos}</span>}
              {note && <span style={{ display: 'block', fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: theme.goldText, marginTop: 1, whiteSpace: 'nowrap' }}>{note}</span>}
            </div>
            <span style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>{r.display}</span>
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
        ['Passing', top('passingYards', 3)],
        ['Rushing', top('rushingYards', 5)],
        ['Receiving', top('receivingYards', 5)],
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
        qb={offense ? top('passingLeader', 1)[0] || top('passingYards', 1)[0] : null}
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
