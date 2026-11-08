import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SEASON, DIVISION_NAME } from '../config.js'
import { fetchStandings, fetchStatsSeason, fetchPickemWeek, fetchScoreboardWeek } from '../api.js'
import { conferenceTeams, gameOutcomes, seedFrom, openRace, oddsText, SIMS } from '../playoffSim.js'
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
const MIN_SWING = 1 // under a point, a game isn't a rooting interest

// Outcomes already worked out, by table seed + game. A run is ~10 ms on a laptop (3–4× that on a
// phone) and a week is ~25 runs, so a refresh with unchanged standings recomputes nothing, and
// the first pass yields between games instead of freezing the page for a second.
const memo = new Map()
const breathe = () => new Promise((r) => setTimeout(r, 0))

const rec = (t) => `${t.wins}–${t.losses}${t.ties ? `–${t.ties}` : ''}`

// Does the table already count this final? A final's scoreboard records are post-game, and the
// standings match them once ESPN posts the result; until then the standings match the pre-game
// record. true / false — or undefined when neither fits (skip the game rather than guess).
function inTable(g, byId, homeWon) {
  let post = true, pre = true
  for (const [side, won] of [[g.home, homeWon], [g.away, !homeWon]]) {
    const t = byId.get(side.id)
    if (!t) continue
    if (!side.record) return undefined
    const [w = 0, l = 0, tie = 0] = side.record.split('–').map(Number)
    if (rec(t) !== side.record) post = false
    if (rec(t) !== `${w - (won ? 1 : 0)}–${l - (won ? 0 : 1)}${tie ? `–${tie}` : ''}`) pre = false
  }
  return post ? true : pre ? false : undefined
}

async function buildWeek() {
  if (await fetchStatsSeason() !== SEASON) return null
  const week = await fetchPickemWeek()
  if (!week) return null
  const [rows, slate] = await Promise.all([fetchStandings(SEASON), fetchScoreboardWeek(week)])
  const teams = conferenceTeams(rows)
  if (!teams) return null
  const metric = openRace(rows.find((r) => r.id === TEAM_ID)?.clincher)
  if (!metric) return null
  const seed = seedFrom(teams)
  if (memo.size > 400) memo.clear()
  const byId = new Map(teams.map((t) => [t.id, t]))
  const games = []
  for (const g of slate) {
    // A game between two AFC teams changes nothing in a model of the NFC field.
    if (!byId.has(g.home.id) && !byId.has(g.away.id)) continue
    let winner = null, counted = false
    if (g.state === 'post') {
      if (g.home.score == null || g.home.score === g.away.score) continue // a tie leaves no side
      winner = g.home.score > g.away.score ? 'home' : 'away'
      counted = inTable(g, byId, winner === 'home')
      if (counted === undefined) continue
    }
    const key = `${seed}:${g.id}:${counted ? 1 : 0}`
    if (!memo.has(key)) {
      await breathe()
      const [w, l] = winner === 'home' ? [g.home.id, g.away.id] : [g.away.id, g.home.id]
      memo.set(key, gameOutcomes(teams, g.home.id, g.away.id, seed, counted ? { winId: w, loseId: l } : null))
    }
    const res = memo.get(key)
    const h = res.home.exact[metric], a = res.away.exact[metric]
    games.push({
      ...g,
      mine: g.home.id === TEAM_ID || g.away.id === TEAM_ID,
      ifHome: res.home[metric],
      ifAway: res.away[metric],
      exact: Math.abs(h - a),
      root: h >= a ? 'home' : 'away',
      winner,
    })
  }
  return { week, metric, games }
}

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
  const swing = (g) => Math.abs(g.ifHome - g.ifAway)
  const mine = data.games.find((g) => g.mine)
  const others = data.games.filter((g) => !g.mine && swing(g) >= MIN_SWING).sort((a, b) => b.exact - a.exact)
  if (!others.length && !(mine && swing(mine) >= MIN_SWING)) return null

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
