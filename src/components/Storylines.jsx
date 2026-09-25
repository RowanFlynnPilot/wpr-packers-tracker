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
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// The game's top Packers performer, written as prose rather than pasted as ESPN's stat line
// ("16/29, 145 YDS, 2 TD" read like a box score dropped into a sentence). A win credits him —
// "behind Jordan Love's 145 passing yards and two touchdowns" — but a loss can't: "fell to the
// Falcons behind Jordan Love's 312 yards" made him the reason they lost. Losses and ties get a
// neutral sentence of their own instead. AP style: counts under ten spelled out, bare
// apostrophe after a name ending in s. A line that won't parse drops the clause, never prints raw.
const WORDS = ['no', 'a', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const count = (n, noun, plural = `${noun}s`, article = 'a') =>
  n === 1 ? `${article} ${noun}` : `${n < 10 ? WORDS[n] : n} ${plural}`
const possessive = (name) => (name.endsWith('s') ? `${name}’` : `${name}’s`)
const andList = (parts) => (parts.length < 2 ? parts[0] || '' : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`)

export function starProse(star, result) {
  const line = star?.line || ''
  const num = (re) => { const m = re.exec(line); return m ? Number(m[1].replace(/,/g, '')) : 0 }
  const yds = num(/(-?[\d,]+) YDS/), td = num(/(\d+) TD/), int = num(/(\d+) INT/), rec = num(/(\d+) REC/)
  if (!star?.name || !/YDS/.test(line)) return null
  const kind = /\d+\/\d+/.test(line) ? 'pass' : /REC/.test(line) ? 'rec' : /CAR/.test(line) ? 'rush' : null
  if (!kind) return null
  const tds = td ? count(td, 'touchdown') : null
  if (result === 'win') {
    // After a possessive a single is "one", not "a" ("Doubs’ one catch", never "Doubs’ a catch").
    const what = kind === 'rec'
      ? `${count(rec, 'catch', 'catches', 'one')} for ${yds} yards`
      : `${yds} ${kind === 'pass' ? 'passing' : 'rushing'} yards`
    return { tail: <> behind <strong>{possessive(star.name)}</strong> {andList([what, tds].filter(Boolean))}</> }
  }
  const verb = kind === 'pass' ? 'threw for' : kind === 'rush' ? 'ran for' : `caught ${count(rec, 'pass', 'passes')} for`
  const extras = [tds, kind === 'pass' && int ? count(int, 'interception', 'interceptions', 'an') : null].filter(Boolean)
  return { after: <> <strong>{star.name}</strong> {verb} {andList([`${yds} yards`, ...extras])} in the {result}.</> }
}

// Calendar days from today to a date, in the reader's time zone: 0 today, 1 tomorrow. Counted
// by midnights, not by elapsed milliseconds — Math.ceil over milliseconds called a kickoff
// fifty minutes away "tomorrow". (Math.round absorbs the 23/25-hour DST days.)
function daysUntil(iso) {
  const a = new Date(); a.setHours(0, 0, 0, 0)
  const b = new Date(iso); b.setHours(0, 0, 0, 0)
  return Math.round((b - a) / 86400000)
}
// "tonight at 7:15 PM" / "today at noon" / "tomorrow at 3:25 PM", else the weekday — and the
// date too once it's more than six days out, when a bare "Sunday" could mean either one.
function kickoffPhrase(g) {
  if (!g.timeValid) return `${fmtDate(g.date)}, kickoff TBD`
  const d = daysUntil(g.date)
  if (d === 0) return <><strong>{new Date(g.date).getHours() >= 17 ? 'tonight' : 'today'}</strong> at {fmtTime(g.date)}</>
  if (d === 1) return <><strong>tomorrow</strong> at {fmtTime(g.date)}</>
  return d > 6
    ? `${new Date(g.date).toLocaleDateString('en-US', { weekday: 'long' })}, ${fmtDate(g.date)}, ${fmtTime(g.date)}`
    : fmtWhen(g.date)
}

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

  // Re-written every two minutes while the page is visible, like the rest of the live page — a
  // reader who opens the tab before kickoff and keeps it open through the final should see the
  // lede move with the game. The reads underneath are the API layer's cached ones.
  useEffect(() => {
    let alive = true
    const run = async () => {
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
            const days = Math.max(0, daysUntil(g.date))
            const when = g.timeValid ? `${fmtWhen(g.date)}${g.tv ? ` · ${g.tv}` : ''}` : `${fmtDate(g.date)}, kickoff TBD`
            return days === 0 ? <>is <strong>{new Date(g.date).getHours() >= 17 ? 'tonight' : 'today'}</strong> ({when})</>
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
          const ot = last.ot ? ' in overtime' : ''
          const prose = starProse(star, last.tied ? 'tie' : last.won ? 'win' : 'loss')
          out.push(<>The Packers {last.tied ? `played the ${last.oppName} to a ${last.meScore}–${last.oppScore} tie${ot}` : `${last.won ? 'beat' : 'fell to'} the ${last.oppName} ${score}${ot}`} {last.home ? 'at Lambeau' : 'on the road'}{round}{prose?.tail}.{prose?.after}</>)
        }
        if (me) {
          const leader = bundle.standings[0]
          const gb = rank === 1
            ? (bundle.standings[1] ? gamesBack({ w: me.wins, l: me.losses, t: me.ties }, { w: bundle.standings[1].wins, l: bundle.standings[1].losses, t: bundle.standings[1].ties }) : 0)
            : gamesBack({ w: leader.wins, l: leader.losses, t: leader.ties }, { w: me.wins, l: me.losses, t: me.ties })
          const note = scheduleNotes(regGames)[0]
          out.push(<>That leaves them <strong>{rec(me)}</strong>, {rank === 1 ? `on top of the ${DIVISION_NAME}${gb > 0 ? ` by ${gb}` : ''}` : `${ord(rank)} in the ${DIVISION_NAME}, ${gb} back`}{note ? ` — ${note.charAt(0).toLowerCase()}${note.slice(1)}` : ''}.</>)
        }
        // While a game is being played, "Next:" would point PAST it at the following week —
        // the hero above is the story then, so the line sits out (same rule as the offseason
        // beat) and returns with the recap once the final lands.
        const live = games.some((g) => g.state === 'in')
        const next = live ? null : regGames.find((g) => g.state === 'pre') || games.find((g) => g.seasonType === 3 && g.state === 'pre')
        if (next) {
          let fpi = null
          try { fpi = await fetchPredictor(next.id, next.home) } catch { /* line renders without it */ }
          out.push(<>Next: {next.home ? 'the' : 'at the'} <strong>{TEAM_NAMES[next.oppId] || next.oppName}</strong>{next.home ? ' at Lambeau' : ''}, {kickoffPhrase(next)}{fpi != null ? <> — ESPN's FPI makes it a {fpi}% Packers game</> : null}.</>)
        }
      }

      if (alive && out.length) { setLines(out); setOffseason(off) }
    }
    const refresh = () => { run().catch(() => {}) }
    refresh()
    const id = setInterval(() => { if (!document.hidden) refresh() }, 120000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  if (!lines) return null

  return (
    <Section kicker="The storylines" title={offseason ? 'Where the story picks up' : 'This week in Packerland'}>
      <div style={{ border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`, borderRadius: 8, background: theme.wash, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
