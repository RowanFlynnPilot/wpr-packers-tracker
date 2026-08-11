import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SEASON, DIVISION, DIVISION_NAME, TEAM_NAMES, CAMP_OPEN } from '../config.js'
import { fetchStandingsBundle, fetchSeasonGames, fetchTeamSchedule, fetchGameSummary, fetchPredictor } from '../api.js'
import { gamesBack, teamGameLeaders, scheduleNotes } from '../games.js'
import Section from './Section.jsx'

// "The storylines" — a short editorial lede written by the data itself: deterministic template
// sentences filled from feeds the page already reads (no backend, no generator — same trick as
// the road-ahead verdict, at paragraph length). Phase-aware: in season it recaps the last game,
// places the team in the race, and frames the next kickoff (with ESPN's FPI number when
// published); in the offseason it wraps last season and points at the opener. Owns its
// Section; fail-soft — missing pieces drop sentences, never the page.
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
const fmtWhen = (iso) => new Date(iso).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })

// Which day of training camp today is (day 1 = the first practice, CAMP_OPEN in config), or
// null when unset, camp hasn't opened, or the count has gone stale — a forgotten config line
// next summer should mute the count, not have the lede claiming day 300 of camp.
function campDayToday() {
  if (!CAMP_OPEN) return null
  const [y, m, d] = CAMP_OPEN.split('-').map(Number)
  const today = new Date()
  const n = Math.floor((today.setHours(0, 0, 0, 0) - new Date(y, m - 1, d)) / 86400000) + 1
  return n >= 1 && n <= 45 ? n : null
}

export default function Storylines() {
  const [lines, setLines] = useState(null)
  const [offseason, setOffseason] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [bundle, { games }] = await Promise.all([fetchStandingsBundle(), fetchSeasonGames()])
      const off = bundle.season < SEASON
      const me = bundle.standings.find((t) => t.id === TEAM_ID)
      const rank = bundle.standings.findIndex((t) => t.id === TEAM_ID) + 1
      const rec = (t) => `${t.wins}–${t.losses}${t.ties ? `–${t.ties}` : ''}`
      const out = []

      if (off) {
        const live = games.some((g) => g.state === 'in')

        // ---- The daily beat: training camp and the exhibition slate. Rewritten from the
        // calendar every day (camp day, days to kickoff, the latest exhibition result), so
        // the lede reads different tomorrow than it does today. Sits out while a game is
        // live — the hero above IS the story then.
        if (!live) {
          const preNext = games.find((g) => g.seasonType === 1 && g.state === 'pre')
          const preFinals = games.filter((g) => g.seasonType === 1 && g.state === 'post')
          const regNext = games.find((g) => g.seasonType === 2 && g.state === 'pre')
          const countdown = (g) => {
            const days = Math.max(0, Math.ceil((new Date(g.date) - Date.now()) / 86400000))
            const when = g.timeValid ? `${fmtWhen(g.date)}${g.tv ? ` · ${g.tv}` : ''}` : `${fmtDate(g.date)}, kickoff TBD`
            return days === 0 ? <>is <strong>tonight</strong> ({when})</>
              : days === 1 ? <>is <strong>tomorrow</strong> ({when})</>
              : <>is <strong>{days} days out</strong> ({when})</>
          }
          if (preNext) {
            const preLeft = games.filter((g) => g.seasonType === 1 && g.state === 'pre').length
            const what = !preFinals.length ? 'the preseason opener' : preLeft === 1 ? 'the preseason finale' : `preseason week ${preNext.week}`
            const where = `${preNext.home ? 'against' : 'at'} the ${TEAM_NAMES[preNext.oppId] || preNext.oppName}`
            const lastPre = preFinals[preFinals.length - 1]
            const campDay = campDayToday()
            if (lastPre) {
              const score = lastPre.won ? `${lastPre.meScore}–${lastPre.oppScore}` : `${lastPre.oppScore}–${lastPre.meScore}`
              out.push(<>The Packers {lastPre.won ? 'took' : 'dropped'} their last exhibition, {score} {lastPre.won ? 'over' : 'to'} the {lastPre.oppName} — {what} {where} {countdown(preNext)}.</>)
            } else {
              out.push(<>{campDay ? <>Day <strong>{campDay}</strong> of training camp in Green Bay</> : <>Training camp rolls on in Green Bay</>} — {what} {where} {countdown(preNext)}.</>)
            }
          } else if (regNext && preFinals.length) {
            const lastPre = preFinals[preFinals.length - 1]
            const score = lastPre.won ? `${lastPre.meScore}–${lastPre.oppScore}` : `${lastPre.oppScore}–${lastPre.meScore}`
            out.push(<>The exhibition slate closed with a {score} {lastPre.won ? 'win over' : 'loss to'} the {lastPre.oppName} — now the games count: kickoff {countdown(regNext)}.</>)
          }
        }

        // ---- Offseason: wrap last season, point at the new one. ----
        const [reg, post] = await Promise.all([
          fetchTeamSchedule(TEAM_ID, bundle.season, 2),
          fetchTeamSchedule(TEAM_ID, bundle.season, 3).catch(() => ({ games: [] })),
        ])
        const finals = [...reg.games, ...post.games].filter((g) => g.state === 'post')
        const last = finals[finals.length - 1]
        if (me && last) {
          const score = `${Math.max(last.meScore, last.oppScore)}–${Math.min(last.meScore, last.oppScore)}`
          const ending = last.seasonType === 3
            ? `the run ended in the ${last.note || 'playoffs'}, a ${score} ${last.won ? 'win over' : 'loss to'} the ${last.oppName}${last.home ? ' at Lambeau' : ''}`
            : `the year closed with a ${score} ${last.won ? 'win over' : 'loss to'} the ${last.oppName}`
          out.push(<>Last season the Packers went <strong>{rec(me)}</strong> — {ord(rank)} in the {DIVISION_NAME} — and {ending}.</>)
        }
        // While the opener itself is being played (Week 1 live, no finals yet, so the stats
        // season hasn't flipped) the "road back opens…" line would point at Week 2 — the hero
        // above is already showing the real thing, so the sentence sits out.
        const opener = live ? null : games.find((g) => g.seasonType === 2 && g.state === 'pre')
        const homeOpener = games.find((g) => g.seasonType === 2 && g.state === 'pre' && g.home)
        if (opener) {
          out.push(<>The road back opens <strong>{fmtDate(opener.date)}</strong> {opener.home ? 'against' : 'at'} the {TEAM_NAMES[opener.oppId] || opener.oppName}{homeOpener && homeOpener.id !== opener.id ? <> — Lambeau's first game is {fmtDate(homeOpener.date)} against the {TEAM_NAMES[homeOpener.oppId] || homeOpener.oppName}</> : null}.</>)
        }
        const champ = bundle.standings[0]
        if (champ && champ.id !== TEAM_ID) {
          out.push(<>Around the North: the {DIVISION[champ.id] || champ.name} took the {bundle.season} division at {rec(champ)}.</>)
        } else if (champ) {
          out.push(<>The Packers enter as defending {DIVISION_NAME} champions.</>)
        }
      } else {
        // ---- In season: last game, the race, the next one. ----
        const regGames = games.filter((g) => g.seasonType === 2)
        // The recap covers playoffs too — in January the last game IS the playoff game.
        const finals = games.filter((g) => g.seasonType !== 1 && g.state === 'post')
        const last = finals[finals.length - 1]
        if (last) {
          let star = null
          try { star = teamGameLeaders(await fetchGameSummary(last.id))[0] || null } catch { /* sentence drops its clause */ }
          const score = last.won ? `${last.meScore}–${last.oppScore}` : `${last.oppScore}–${last.meScore}`
          const round = last.seasonType === 3 ? ` in the ${last.note || 'playoffs'}` : ''
          out.push(<>The Packers {last.tied ? `played the ${last.oppName} to a ${last.meScore}–${last.oppScore} tie` : `${last.won ? 'beat' : 'fell to'} the ${last.oppName} ${score}`} {last.home ? 'at Lambeau' : 'on the road'}{round}{star ? <> behind <strong>{star.name}</strong>'s {star.line}</> : null}.</>)
        }
        if (me) {
          const leader = bundle.standings[0]
          const gb = rank === 1
            ? (bundle.standings[1] ? gamesBack({ w: me.wins, l: me.losses, t: me.ties }, { w: bundle.standings[1].wins, l: bundle.standings[1].losses, t: bundle.standings[1].ties }) : 0)
            : gamesBack({ w: leader.wins, l: leader.losses, t: leader.ties }, { w: me.wins, l: me.losses, t: me.ties })
          const note = scheduleNotes(regGames)[0]
          out.push(<>That leaves them <strong>{rec(me)}</strong>, {rank === 1 ? `on top of the ${DIVISION_NAME}${gb > 0 ? ` by ${gb}` : ''}` : `${ord(rank)} in the ${DIVISION_NAME}, ${gb} back`}{note ? ` — ${note.charAt(0).toLowerCase()}${note.slice(1)}` : ''}.</>)
        }
        const next = regGames.find((g) => g.state === 'pre') || games.find((g) => g.seasonType === 3 && g.state === 'pre')
        if (next) {
          let fpi = null
          try { fpi = await fetchPredictor(next.id, next.home) } catch { /* line renders without it */ }
          out.push(<>Next: {next.home ? 'the' : 'at the'} <strong>{TEAM_NAMES[next.oppId] || next.oppName}</strong>{next.home ? ' at Lambeau' : ''}, {next.timeValid ? fmtWhen(next.date) : `${fmtDate(next.date)}, kickoff TBD`}{fpi != null ? <> — ESPN's FPI makes it a {fpi}% Packers game</> : null}.</>)
        }
      }

      if (alive && out.length) { setLines(out); setOffseason(off) }
    })().catch(() => {})
    return () => { alive = false }
  }, [])

  if (!lines) return null

  return (
    <Section kicker="The storylines" title={offseason ? 'Where the story picks up' : 'This week in Packerland'}>
      <div style={{ border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 8, background: theme.wash, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: theme.gold, flexShrink: 0, position: 'relative', top: -2 }} />
            <span style={{ fontFamily: theme.serif, fontSize: 15.5, color: theme.ink, lineHeight: 1.55 }}>{l}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}
