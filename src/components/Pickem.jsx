import { useEffect, useState, useCallback } from 'react'
import { theme } from '../theme.js'
import { SEASON, TEAM_ID, SPONSORS, teamLogo } from '../config.js'
import { fetchPickemWeek, fetchScoreboardWeek } from '../api.js'
import { gradePicks } from '../games.js'
import { track } from '../analytics.js'
import Section from './Section.jsx'

// The weekly NFL pick'em: every game on the week's slate, tap a side, graded as the finals
// land. No accounts and no backend by design — picks live in THIS browser (localStorage), so
// readers compete against their own season record, and that's said out loud on the card.
// Week resolution and grading both ride the scoreboard feed (api.js); past weeks settle into
// stored results the first time the card loads after their last game, so the season tally
// costs one fetch per unsettled week (normally one), not eighteen.
// Fail-soft: no resolvable week and no stored results → the section renders nothing.

const KEY = `packersPickem:${SEASON}`
const readStore = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}
const writeStore = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }

const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// One team side of a game row: logo + abbr + record, tappable while the game is pregame.
function Side({ team, picked, pickable, onPick, result }) {
  const ring = picked ? (result === 'wrong' ? theme.red : theme.green) : theme.rule
  return (
    <button
      onClick={pickable ? onPick : undefined}
      disabled={!pickable}
      aria-pressed={picked}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 0', minWidth: 0,
        background: picked ? (result === 'wrong' ? '#fdf0ef' : '#eef3f0') : 'transparent',
        border: `1.5px solid ${ring}`, borderRadius: 8, padding: '7px 10px',
        cursor: pickable ? 'pointer' : 'default', opacity: !pickable && !picked ? 0.75 : 1,
        fontFamily: theme.sans, textAlign: 'left',
      }}
    >
      <img src={teamLogo(team.id)} alt="" width={22} height={22} loading="lazy" decoding="async"
        style={{ objectFit: 'contain', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: picked ? 700 : 600, color: theme.ink }}>{team.abbr}</span>
        {/* Week 1 has all 32 clubs at 0–0 — thirty-two identical "0-0"s are noise, not context. */}
        {team.record && team.record !== '0-0' && <span style={{ fontSize: 11, color: theme.muted }}> {team.record}</span>}
      </span>
      {team.score != null && (
        <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: theme.ink, fontVariantNumeric: 'tabular-nums' }}>{team.score}</span>
      )}
      {picked && result && (
        <span aria-label={result === 'correct' ? 'Pick correct' : 'Pick missed'}
          style={{ marginLeft: team.score != null ? 4 : 'auto', fontSize: 13, fontWeight: 700, color: result === 'correct' ? theme.green : theme.red }}>
          {result === 'correct' ? '✓' : '✗'}
        </span>
      )}
    </button>
  )
}

export default function Pickem() {
  const [week, setWeek] = useState(undefined)   // undefined = resolving, null = season over
  const [games, setGames] = useState(null)
  const [store, setStore] = useState(readStore)

  // Settle any past weeks with picks but no stored result — one scoreboard read per
  // unsettled week, results written back so they never refetch.
  const settlePast = useCallback(async (currentWeek) => {
    const s = readStore()
    let changed = false
    for (const wk of Object.keys(s)) {
      const entry = s[wk]
      if (!entry?.picks || entry.result || Number(wk) === currentWeek) continue
      try {
        const g = await fetchScoreboardWeek(Number(wk))
        const grade = gradePicks(g, entry.picks)
        // Settle when every picked game is final — or, once the week is two behind the
        // league clock, on whatever HAS decided: a postponed game must never hold a
        // whole week's correct picks out of the season tally forever.
        const stale = currentWeek != null && Number(wk) < currentWeek - 1
        if (grade.decided && (!grade.pending || stale)) {
          entry.result = { correct: grade.correct, total: grade.decided }
          changed = true
        }
      } catch { /* settles on a later visit */ }
    }
    if (changed) { writeStore(s); setStore(s) }
  }, [])

  const load = useCallback(() => {
    fetchPickemWeek().then(async (wk) => {
      setWeek(wk)
      if (wk != null) {
        try { setGames(await fetchScoreboardWeek(wk)) } catch { setGames(null) }
      }
      settlePast(wk)
    }).catch(() => setWeek(null))
  }, [settlePast])

  useEffect(() => {
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 120000)
    return () => clearInterval(id)
  }, [load])

  const pick = (gameId, teamId) => {
    const s = readStore()
    const entry = s[week] || (s[week] = { picks: {} })
    entry.picks[gameId] = entry.picks[gameId] === teamId ? undefined : teamId
    if (entry.picks[gameId] === undefined) delete entry.picks[gameId]
    writeStore(s)
    setStore(s)
    track('Pickem Pick', { week })
  }

  // Season tally: settled weeks' stored results + the current week's decided games.
  const thisWeek = store[week]?.picks || {}
  const grade = games ? gradePicks(games, thisWeek) : { correct: 0, wrong: 0, pending: 0, decided: 0 }
  const settled = Object.entries(store).filter(([wk, e]) => e?.result && Number(wk) !== week)
  const season = settled.reduce(
    (a, [, e]) => ({ correct: a.correct + e.result.correct, total: a.total + e.result.total }),
    { correct: grade.correct, total: grade.decided },
  )

  // This is a whole TAB, so unlike the fail-soft sections it never renders blank: the
  // offseason shows the final tally (or a "picks open at the slate" note), and a fetch
  // failure shows the note rather than empty chrome.
  const shell = (body) => (
    <Section kicker="The pick'em" title="Call the week" sponsor={SPONSORS.pickem} slot="pickem">{body}</Section>
  )
  const note = (text) => (
    <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>{text}</div>
  )
  if (week === undefined) return shell(note('Loading the week’s slate…'))
  if (week === null) {
    if (!season.total) return shell(note('Picks open when the season’s slate is posted.'))
    return shell(
      <div style={{ border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`, borderRadius: 8, background: theme.wash, padding: '16px 20px', fontFamily: theme.sans }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>Final tally</div>
        <div style={{ fontFamily: theme.serif, fontSize: 22, color: theme.ink, marginTop: 4 }}>
          You called <strong>{season.correct}</strong> of <strong>{season.total}</strong> this season.
        </div>
        <div style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>The board resets when the new season's slate is posted.</div>
      </div>
    )
  }
  if (!games || !games.length) return shell(note('The slate isn’t loading right now — it usually clears on the next refresh.'))

  const pickedCount = Object.keys(thisWeek).length
  let lastDay = ''

  return shell(
    <div>
      {/* The reader's card. Always visible, from an empty sheet onward: a pick'em with no
          running score is a form, and a form is not a habit. The bar makes "you have four left"
          a glance instead of a count, and the records give a returning reader something of
          their own on the page. */}
      <div style={{ borderTop: `2px solid ${theme.green}`, borderBottom: `1px solid ${theme.rule}`, padding: '12px 0 14px', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: theme.serif, fontSize: 22, color: theme.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {pickedCount} <span style={{ fontSize: 15, color: theme.muted }}>of {games.length} called</span>
          </div>
          <div style={{ display: 'flex', gap: 18, fontFamily: theme.sans, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            {grade.decided > 0 && (
              <span style={{ color: theme.muted }}>
                This week <strong style={{ color: grade.correct >= grade.wrong ? theme.green : theme.red, fontSize: 13 }}>{grade.correct}–{grade.wrong}</strong>
              </span>
            )}
            {/* Only once there IS a season behind this week — otherwise it just restates it. */}
            {season.total > grade.decided && (
              <span style={{ color: theme.muted }}>
                Season <strong style={{ color: theme.ink, fontSize: 13 }}>{season.correct}–{season.total - season.correct}</strong>
              </span>
            )}
          </div>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: theme.rule, marginTop: 10, overflow: 'hidden' }} aria-hidden="true">
          {/* Scaled, not widened: animating width relayouts the bar on every frame. */}
          <div style={{ width: '100%', height: '100%', borderRadius: 2, background: theme.gold, transformOrigin: 'left', transform: `scaleX(${pickedCount / games.length})`, transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }} />
        </div>
        <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 9 }}>
          {pickedCount === 0
            ? 'Tap a team to call each game — picks lock at kickoff.'
            : pickedCount < games.length
            ? `${games.length - pickedCount} still to call — picks lock at kickoff.`
            : 'Every game called. Come back after the finals to see how you did.'}
        </div>
      </div>

      {games.map((g) => {
        const pickedTeam = thisWeek[g.id]
        const pickable = g.state === 'pre'
        const winner = g.completed ? (g.home.score > g.away.score ? g.home.id : g.away.score > g.home.score ? g.away.id : null) : null
        const result = (side) => (g.completed && pickedTeam === side ? (winner === side ? 'correct' : 'wrong') : null)
        const day = fmtDay(g.date)
        const dayLabel = day !== lastDay ? (lastDay = day) : null
        const packersGame = g.home.id === TEAM_ID || g.away.id === TEAM_ID
        return (
          <div key={g.id}>
            {dayLabel && (
              <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700, margin: '16px 0 6px' }}>
                {dayLabel}
              </div>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, marginBottom: 6,
              background: packersGame ? theme.wash : 'transparent',
              border: packersGame ? `1px solid ${theme.rule}` : '1px solid transparent',
            }}>
              <Side team={g.away} picked={pickedTeam === g.away.id} pickable={pickable} onPick={() => pick(g.id, g.away.id)} result={result(g.away.id)} />
              <span style={{ fontFamily: theme.sans, fontSize: 10, color: theme.muted, flexShrink: 0 }}>at</span>
              <Side team={g.home} picked={pickedTeam === g.home.id} pickable={pickable} onPick={() => pick(g.id, g.home.id)} result={result(g.home.id)} />
              <span style={{ fontFamily: theme.sans, fontSize: 11, color: g.state === 'in' ? theme.red : theme.muted, fontWeight: g.state === 'in' ? 700 : 400, width: 74, textAlign: 'right', flexShrink: 0 }}>
                {g.state === 'in' ? 'Live' : g.completed ? 'Final' : g.timeValid ? fmtTime(g.date) : 'TBD'}
                {!g.completed && g.state === 'pre' && g.tv ? <span style={{ display: 'block', fontSize: 9.5 }}>{g.tv}</span> : null}
              </span>
            </div>
          </div>
        )
      })}

      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 10 }}>
        Bragging rights only — picks live in this browser, graded as the finals land. Week {week} of {SEASON}.
      </div>
    </div>
  )
}
