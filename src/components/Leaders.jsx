import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { headshot, SEASON } from '../config.js'
import { fetchTeamLeaders, fetchLeagueLeaders, fetchAthleteOverviews } from '../api.js'
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

// The supporting line under each board row, from the athlete overview feed — the stats that
// give the headline number its shape (a back's yards mean more next to his per-carry average).
// Keyed by the board's leader category; zeros stay only where zero IS the story (TD, INT).
const DETAILS = {
  passingYards: [['Passing Touchdowns', 'TD'], ['Interceptions', 'INT'], ['Completion Percentage', 'cmp%']],
  rushingYards: [['Rushing Touchdowns', 'TD'], ['Yards Per Rush Attempt', 'yds/carry'], ['Rushing Attempts', 'carries']],
  receivingYards: [['Receiving Touchdowns', 'TD'], ['Receptions', 'catches'], ['Yards Per Reception', 'yds/catch']],
  totalTackles: [['Solo Tackles', 'solo'], ['Sacks', 'sacks'], ['Passes Defended', 'passes def.']],
  sacks: [['Total Tackles', 'tackles'], ['Stuffs', 'TFL'], ['Forced Fumbles', 'FF']],
  interceptions: [['Passes Defended', 'passes def.'], ['Interception Touchdowns', 'pick-six'], ['Total Tackles', 'tackles']],
}
const KEEP_ZERO = new Set(['TD', 'INT'])
function detailLine(overview, picks) {
  if (!overview || !picks) return null
  const stats = overview.splits?.['Regular Season']
  if (!stats) return null
  const parts = []
  for (const [displayName, short] of picks) {
    const i = overview.displayNames.indexOf(displayName)
    if (i === -1) continue
    const v = stats[i]
    if (v == null || v === '') continue
    if (!parseFloat(String(v).replace(/,/g, '')) && !KEEP_ZERO.has(short)) continue
    parts.push(`${v} ${short}`)
  }
  return parts.length ? parts.join(' · ') : null
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
function LeaderTable({ title, rows, league, overviews, picks }) {
  if (!rows?.length) return null
  const max = Math.max(...rows.map((r) => r.value || 0)) || 1
  return (
    <div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, marginBottom: 10, fontWeight: 700 }}>{title}</div>
      {rows.map((r, i) => {
        const note = rankNote(league, r.id)
        const detail = detailLine(overviews?.[r.id], picks)
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
              {detail && <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 3 }}>{detail}</div>}
              {note && <div style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: theme.goldText, marginTop: 2, whiteSpace: 'nowrap' }}>{note}</div>}
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
  const [overviews, setOverviews] = useState(null) // id → overview, for the per-row detail lines
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchTeamLeaders().then(setData).catch(() => setError(true))
    fetchLeagueLeaders().then(setLeague).catch(() => {})
  }, [])

  // One small overview read per boarded player (pooled in the API layer, cached + shared with
  // the player cards), so each row can carry its supporting stats. Fail-soft per player — a
  // miss just means no line.
  useEffect(() => {
    if (!data) return
    let alive = true
    const ids = [...new Set(Object.values(data.categories).flat().map((l) => l.id).filter(Boolean))]
    fetchAthleteOverviews(ids).then((map) => { if (alive) setOverviews(map) }).catch(() => {})
    return () => { alive = false }
  }, [data])

  if (error) return <ErrorState />
  if (!data) return <Loading />

  const c = data.categories
  const top = (cat, n) => (c[cat] || []).filter((l) => l.name).slice(0, n)
  const offense = side === 'offense'

  const tables = offense
    ? [
        ['Passing yards', top('passingYards', 3), 'passingYards'],
        ['Rushing yards', top('rushingYards', 5), 'rushingYards'],
        ['Receiving yards', top('receivingYards', 5), 'receivingYards'],
      ]
    : [
        ['Tackles', top('totalTackles', 5), 'totalTackles'],
        ['Sacks', top('sacks', 5), 'sacks'],
        ['Interceptions', top('interceptions', 4), 'interceptions'],
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
        {tables.map(([title, rows, cat]) => <LeaderTable key={title} title={title} rows={rows} league={league} overviews={overviews} picks={DETAILS[cat]} />)}
      </div>
      {data.season < SEASON && (
        <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 16 }}>
          Final {data.season} leaders — the new season's numbers take over after Week 1.
        </div>
      )}
    </div>
  )
}
