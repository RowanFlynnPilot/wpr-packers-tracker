import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, DIVISION_NAME } from '../config.js'
import { oddsText, SIMS } from '../playoffSim.js'
import { buildWeek, swing as swingOf, rootingRows } from '../rooting.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Section from './Section.jsx'
import TeamLogo from './TeamLogo.jsx'

// "Who to root for": every game of the week that moves the Packers' odds, biggest swing first —
// each one run through the house sim both ways (playoffSim.js gameOutcomes) on ONE shared seed,
// so the Packers' own row matches the hero's stakes line to the point and the rows compare on
// the same dice. Live games show the score and whether it's going Green Bay's way; finals say
// whether it went that way. Measures the playoff odds until the spot is clinched, then the
// division (openRace); sits out once both are settled, before Week 1, and in the postseason.
// Owns its Section; fail-soft.
const SHOWN = 5

const kickoff = (g) => g.timeValid
  ? new Date(g.date).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  : `${new Date(g.date).toLocaleDateString('en-US', { weekday: 'short' })} · time TBD`

export default function RootingGuide() {
  const [data, setData] = useState(null)
  const [all, setAll] = useState(false)
  const narrow = useIsNarrow()

  // Every minute while a game in the slate is on, every five otherwise; a hidden tab skips the
  // fetch but keeps the schedule. A failed refresh keeps what's on screen.
  useEffect(() => {
    let alive = true, timer, last = null
    const tick = async () => {
      if (!document.hidden) {
        try { last = await buildWeek(); if (alive) setData(last) } catch { /* keep the prior read */ }
      }
      if (alive) timer = setTimeout(tick, last?.games.some((g) => g.state === 'in') ? 60000 : 300000)
    }
    tick()
    return () => { alive = false; clearTimeout(timer) }
  }, [])

  if (!data) return null
  const swing = swingOf
  const mine = data.games.find((g) => g.mine)
  const others = rootingRows(data)
  if (!others.length && !(mine && swing(mine) >= 1)) return null

  const scale = Math.max(1, ...data.games.map(swing))
  const shown = all ? others : others.slice(0, SHOWN)
  const done = data.games.every((g) => g.state === 'post')
  const decided = others.filter((g) => g.winner)
  const went = decided.filter((g) => g.winner === g.root).length
  const race = data.metric === 'division' ? `${DIVISION_NAME} title odds` : 'playoff odds'

  const status = (g, root) => {
    const lead = (s, o) => (s > o ? theme.green : s < o ? theme.red : theme.muted)
    const score = `${g.away.abbr} ${g.away.score}, ${g.home.abbr} ${g.home.score}`
    if (g.state === 'in') {
      const [s, o] = root === 'home' ? [g.home.score, g.away.score] : [g.away.score, g.home.score]
      return (
        <span>
          <span style={{ color: theme.goldText, fontWeight: 700 }}>Live</span> · <span style={{ color: lead(s, o), fontWeight: 700 }}>{score}</span>
          {g.detail ? ` · ${g.detail.replace(/ - /g, ' · ')}` : ''}
        </span>
      )
    }
    if (g.state === 'post') {
      const good = g.winner === root
      return (
        <span>
          Final · {score} ·{' '}
          <span style={{ color: good ? theme.green : theme.red, fontWeight: 700 }}>
            {good ? '✓ Went the Packers’ way' : '✗ Went against them'}
          </span>
        </span>
      )
    }
    return <span>{kickoff(g)}{g.tv ? ` · ${g.tv}` : ''}</span>
  }

  const bar = (g) => (
    <div aria-hidden="true" style={{ height: 4, borderRadius: 2, background: theme.rule, marginTop: 7 }}>
      <div style={{ width: `${(swing(g) / scale) * 100}%`, height: '100%', borderRadius: 2, background: g.mine ? theme.gold : theme.green }} />
    </div>
  )

  const points = (g) => (
    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: theme.serif, fontSize: narrow ? 20 : 22, color: theme.green, lineHeight: 1 }}>{swing(g)}</span>
      <span style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginLeft: 3 }}>{swing(g) === 1 ? 'pt' : 'pts'}</span>
    </div>
  )

  const side = (s, strong) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, verticalAlign: 'middle' }}>
      <TeamLogo id={s.id} size={18} />
      <span style={{ color: strong ? theme.ink : theme.muted, fontWeight: strong ? 700 : 400 }}>{s.name}</span>
    </span>
  )

  // The Packers' own game, pinned first: the yardstick the other swings are read against.
  let mineRow = null
  if (mine) {
    const gbHome = mine.home.id === TEAM_ID
    const [me, opp] = gbHome ? [mine.home, mine.away] : [mine.away, mine.home]
    const [win, loss] = gbHome ? [mine.ifHome, mine.ifAway] : [mine.ifAway, mine.ifHome]
    mineRow = (
      <li style={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 14, alignItems: 'start', padding: '12px 14px', margin: '0 0 6px', background: theme.wash, borderTop: `3px solid ${theme.gold}`, borderRadius: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700, marginBottom: 4 }}>The Packers’ game</div>
          <div style={{ fontFamily: theme.sans, fontSize: 14, lineHeight: 1.5 }}>
            {side(me, true)} <span style={{ color: theme.muted }}>{gbHome ? 'vs' : 'at'}</span> {side(opp, false)}
          </div>
          <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 2, lineHeight: 1.45 }}>
            {mine.state === 'pre'
              ? <>A win → <strong style={{ color: theme.green }}>{oddsText(win)}</strong> · a loss → <strong style={{ color: theme.red }}>{oddsText(loss)}</strong> · {kickoff(mine)}</>
              : mine.state === 'post'
                ? <>Final · <strong style={{ color: mine.winner === (gbHome ? 'home' : 'away') ? theme.green : theme.red }}>Packers {me.score}, {opp.name} {opp.score}</strong> — {race} now at {oddsText(mine.winner === (gbHome ? 'home' : 'away') ? win : loss)}</>
                : status(mine, gbHome ? 'home' : 'away')}
          </div>
          {bar(mine)}
        </div>
        {points(mine)}
      </li>
    )
  }

  return (
    <Section kicker="Scoreboard watch" title={done ? `How Week ${data.week} broke for the Packers` : `Who to root for in Week ${data.week}`}>
      <p style={{ fontFamily: theme.serif, fontSize: narrow ? 15.5 : 17, color: theme.ink, lineHeight: 1.45, margin: '-6px 0 16px', maxWidth: 620, textWrap: 'pretty' }}>
        {done
          ? <>{went} of {decided.length} results that mattered went the Packers’ way.</>
          : <>{mine
              ? `Every game this week that moves the Packers’ ${race}, biggest swing first.`
              : `Green Bay is off this week, so this is the whole show: every game that moves the Packers’ ${race}, biggest swing first.`}
            {decided.length > 0 && <> So far, <strong>{went} of {decided.length}</strong> decided {decided.length === 1 ? 'game has' : 'games have'} gone their way.</>}</>}
      </p>
      {/* Capped so the swing number stays within a glance of the teams on a wide screen. */}
      <div style={{ maxWidth: 640 }}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {mineRow}
        {shown.length > 0 && (
          <li aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, padding: '10px 14px 4px' }}>
            <span>Root for</span><span>Swing</span>
          </li>
        )}
        {shown.map((g) => {
          const [r, o] = g.root === 'home' ? [g.home, g.away] : [g.away, g.home]
          return (
            <li key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 14, alignItems: 'start', padding: '11px 14px', borderTop: `1px solid ${theme.rule}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: theme.sans, fontSize: 14, lineHeight: 1.5 }}>
                  <span className="sr-only">Root for </span>{side(r, true)} <span style={{ color: theme.muted }}>over</span> {side(o, false)}
                </div>
                <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 2, lineHeight: 1.45 }}>{status(g, g.root)}</div>
                {bar(g)}
              </div>
              {points(g)}
            </li>
          )
        })}
      </ul>
      {others.length > SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} className="link-hover"
          style={{ display: 'block', margin: '8px auto 0', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 10px', fontFamily: theme.sans, fontSize: 12.5, fontWeight: 700, color: theme.green }}>
          {all ? 'Show fewer' : `Show all ${others.length} games`}
        </button>
      )}
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 12, lineHeight: 1.5 }}>
        Swing: how far apart the Packers’ {race} land under the two results, in points. Our house model — {SIMS.toLocaleString()} simulations per result, run in your browser{data.metric === 'division' ? ' (their playoff spot is already clinched)' : ''}. Games between two AFC teams don’t move it.
      </div>
    </Section>
  )
}
