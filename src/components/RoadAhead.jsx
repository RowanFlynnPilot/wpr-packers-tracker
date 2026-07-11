import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, DIVISION, SEASON } from '../config.js'
import { fetchDivisionSchedules, fetchStandingsBundle } from '../api.js'
import Section from './Section.jsx'
import TeamLogo from './TeamLogo.jsx'

// "The road ahead" — how hard each NFC North team's remaining schedule is: the aggregate win%
// of their unplayed opponents, weighted by games. Before Week 1 that's the classic preseason
// strength-of-schedule read (opponents weighted by last season's records — the note says so).
// Hardest road first; bars are stretched across the observed range so small differences still
// read. Owns its Section; fail-soft.
export default function RoadAhead() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    Promise.all([fetchDivisionSchedules(SEASON), fetchStandingsBundle()]).then(([schedules, bundle]) => {
      if (!alive) return
      const table = {}
      bundle.league.forEach((r) => { table[r.id] = r })
      const out = schedules.map(({ id, games }) => {
        let w = 0, g = 0, count = 0
        games.forEach((game) => {
          if (game.state === 'post') return
          count++
          const t = table[game.oppId]
          if (!t || t.wins + t.losses + t.ties === 0) return
          w += (t.wins + t.ties / 2) / (t.wins + t.losses + t.ties)
          g++
        })
        return { id, games: count, oppPct: g ? w / g : null }
      }).filter((r) => r.oppPct != null && r.games > 0)
      out.sort((a, b) => b.oppPct - a.oppPct)
      setData({ rows: out, season: bundle.season })
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!data || data.rows.length < 2) return null
  const { rows, season } = data

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
      {season < SEASON && (
        <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 8 }}>
          Opponent strength based on final {season} records until the new season has results.
        </div>
      )}
    </Section>
  )
}
