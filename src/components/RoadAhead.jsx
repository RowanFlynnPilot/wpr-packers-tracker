import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, DIVISION, SEASON } from '../config.js'
import { fetchDivisionSchedules, fetchStandings } from '../api.js'
import Section from './Section.jsx'
import TeamLogo from './TeamLogo.jsx'

// How much last season's record counts, measured in games of this season. Six, because that's
// what it's worth as a predictor: a team's win% correlates only about a third from one year to
// the next, and six games of the current season carry that same reliability (6 / (6 + 12) —
// 12 being the NFL regression constant the playoff model uses). So in Week 3 last season still
// carries two-thirds of the weight, by Week 6 half, and by December this season has taken over.
//
// Before the blend, the section switched from last season's records to this season's the day
// Week 1 ended — and rated schedules on two- and three-game records: a 2–0 opponent counted as
// a 1.000 team. The noise ranked the division's roads by who happened to win in September.
const PRIOR_GAMES = 6

// Each opponent's strength: this season's record plus last season's, the latter counted as
// PRIOR_GAMES games. With no games played it IS last season's win% — the classic preseason
// strength-of-schedule number — so one formula serves every phase.
function strength(cur, prev) {
  const prevPct = prev ? (prev.wins + prev.ties / 2) / Math.max(1, prev.wins + prev.losses + prev.ties) : 0.5
  const w = cur ? cur.wins + cur.ties / 2 : 0
  const g = cur ? cur.wins + cur.losses + cur.ties : 0
  return (w + PRIOR_GAMES * prevPct) / (g + PRIOR_GAMES)
}

// "The road ahead" — how hard each NFC North team's remaining schedule is: the blended strength
// of their unplayed opponents, weighted by games (an opponent met twice counts twice). Hardest
// road first; bars are stretched across the observed range so small differences still read.
// Owns its Section; fail-soft.
export default function RoadAhead() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetchDivisionSchedules(SEASON),
      fetchStandings(SEASON).catch(() => []), // not published before the season exists
      fetchStandings(SEASON - 1),
    ]).then(([schedules, curRows, prevRows]) => {
      if (!alive) return
      const cur = Object.fromEntries(curRows.map((r) => [r.id, r]))
      const prev = Object.fromEntries(prevRows.map((r) => [r.id, r]))
      const out = schedules.map(({ id, games }) => {
        const left = games.filter((game) => game.state !== 'post')
        if (!left.length) return null
        const total = left.reduce((sum, game) => sum + strength(cur[game.oppId], prev[game.oppId]), 0)
        return { id, games: left.length, oppPct: total / left.length }
      }).filter(Boolean)
      out.sort((a, b) => b.oppPct - a.oppPct)
      const played = curRows.reduce((max, r) => Math.max(max, r.wins + r.losses + r.ties), 0)
      setData({ rows: out, played })
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!data || data.rows.length < 2) return null
  const { rows, played } = data

  const pcts = rows.map((r) => r.oppPct)
  const lo = Math.min(...pcts), hi = Math.max(...pcts)
  const span = Math.max(0.02, hi - lo) // floor the range so near-identical schedules don't zero out
  const width = (v) => 25 + ((v - lo) / span) * 75 // 25–100% keeps every bar visible
  const fmt = (v) => `.${String(Math.round(v * 1000)).padStart(3, '0')}`

  // Editorial verdict: Packers vs the rival with the softest road left.
  const me = rows.find((r) => r.id === TEAM_ID)
  const rival = rows.filter((r) => r.id !== TEAM_ID).sort((a, b) => a.oppPct - b.oppPct)[0]
  const verdict = me && rival
    ? me.oppPct < rival.oppPct
      ? `Green Bay's remaining slate (${fmt(me.oppPct)} opponents) is softer than every rival's — the schedule leans their way.`
      : `The ${DIVISION[rival.id]} have the softest road left (${fmt(rival.oppPct)} opponents vs Green Bay's ${fmt(me.oppPct)}).`
    : null

  return (
    <Section kicker="Strength of schedule" title="The road ahead">
      <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 16px', maxWidth: 600, lineHeight: 1.5 }}>
        Combined winning percentage of each team's remaining opponents — the longer the bar, the harder the road.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map((r) => {
          const isMe = r.id === TEAM_ID
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, width: 110, flexShrink: 0 }}>
                <TeamLogo id={r.id} size={18} />
                <span style={{ fontFamily: theme.serif, fontSize: 14, fontWeight: isMe ? 700 : 400, color: isMe ? theme.green : theme.ink }}>{DIVISION[r.id]}</span>
              </span>
              <div style={{ flex: 1, height: 12, borderRadius: 6, background: theme.wash, overflow: 'hidden' }}>
                <div style={{ width: `${width(r.oppPct)}%`, height: '100%', borderRadius: 6, background: isMe ? theme.green : theme.rule, border: isMe ? 'none' : `1px solid ${theme.rule}` }} />
              </div>
              <span style={{ fontFamily: theme.sans, fontSize: 12, color: isMe ? theme.green : theme.muted, fontWeight: isMe ? 700 : 400, width: 86, flexShrink: 0 }}>
                {fmt(r.oppPct)} · {r.games} left
              </span>
            </div>
          )
        })}
      </div>
      {verdict && <div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginTop: 14, lineHeight: 1.5 }}>{verdict}</div>}
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 8, lineHeight: 1.5 }}>
        {played === 0
          ? `Opponent strength based on final ${SEASON - 1} records until the new season has results.`
          : `Opponents' ${SEASON} records are blended with their ${SEASON - 1} finals, which count as ${PRIOR_GAMES} games — early-season records are mostly noise, so this year's results take over as they add up.`}
      </div>
    </Section>
  )
}
