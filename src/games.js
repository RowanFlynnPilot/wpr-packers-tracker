// Derivations over normalized games and summaries. Pure functions — no fetching.
import { TEAM_ID, DIVISION, GAMES_IN_SEASON } from './config.js'

// Period → display label: quarters read "Q1"–"Q4", the fifth period is overtime.
export const periodLabel = (n) => (n == null ? '' : n <= 4 ? `Q${n}` : n === 5 ? 'OT' : `${n - 4}OT`)

// NFL games-back convention: ties count half. effW/effL turn a W-L-T record into the pair the
// games-back formula expects.
const effW = (t) => t.w + t.t / 2
const effL = (t) => t.l + t.t / 2
export const gamesBack = (leader, team) =>
  ((effW(leader) - effW(team)) + (effL(team) - effL(leader))) / 2

// A team's completed regular-season results in date order, from its normalized schedule.
export function finals(games) {
  return (games || []).filter((g) => g.state === 'post' && g.meScore != null && g.oppScore != null)
}

// The Packers' most recent completed game, for the pulse recap line.
export function lastFinalGame(schedules) {
  const mine = schedules?.find((s) => s.id === TEAM_ID)
  if (!mine) return null
  const fs = finals(mine.games)
  return fs.length ? fs[fs.length - 1] : null
}

// A team's last n results, oldest → newest — feeds the standings form strip.
// 'W' | 'L' | 'T' per game.
export function recentResults(schedules, teamId, n = 5) {
  const team = schedules?.find((s) => s.id === teamId)
  if (!team) return []
  return finals(team.games).slice(-n).map((g) => (g.tied ? 'T' : g.won ? 'W' : 'L'))
}

// The division race, week by week: for every week with at least one completed game, each
// team's games back of the division leader. Bye weeks carry the record forward.
export function raceByWeek(schedules) {
  const maxWeek = Math.max(0, ...schedules.flatMap((s) => finals(s.games).map((g) => g.week || 0)))
  if (!maxWeek) return []
  const recordThrough = (games, week) => {
    let w = 0, l = 0, t = 0
    finals(games).forEach((g) => {
      if ((g.week || 0) <= week) { if (g.tied) t++; else if (g.won) w++; else l++ }
    })
    return { w, l, t }
  }
  const rows = []
  for (let wk = 1; wk <= maxWeek; wk++) {
    const recs = schedules.map((s) => ({ id: s.id, ...recordThrough(s.games, wk) }))
    if (!recs.some((r) => r.w + r.l + r.t > 0)) continue
    const leader = recs.reduce((a, b) => {
      const pa = (effW(a)) / ((a.w + a.l + a.t) || 1)
      const pb = (effW(b)) / ((b.w + b.l + b.t) || 1)
      return pb > pa ? b : a
    })
    const row = { week: `Wk ${wk}` }
    recs.forEach((r) => { row[r.id] = gamesBack(leader, r) })
    rows.push(row)
  }
  return rows
}

// Season head-to-head vs each division rival, from the Packers' own finals.
export function vsDivision(games) {
  const byOpp = {}
  finals(games).forEach((g) => {
    if (!DIVISION[g.oppId] || g.oppId === TEAM_ID) return
    const r = byOpp[g.oppId] || (byOpp[g.oppId] = { w: 0, l: 0, t: 0 })
    if (g.tied) r.t++; else if (g.won) r.w++; else r.l++
  })
  return byOpp
}

// Win-probability flow for one game, from a summary. Converts each entry to the Packers' win %
// and flags scoring plays (matched through the drives' play list); finds the single biggest
// jump in the Packers' favor and describes it with that play's text.
export function gameFlow(summary, packersHome) {
  const playText = {}
  const scoringIds = new Set((summary.scoringPlays || []).map((p) => String(p.id)))
  ;[...(summary.drives?.previous || []), ...(summary.drives?.current ? [summary.drives.current] : [])]
    .forEach((d) => (d.plays || []).forEach((p) => {
      playText[String(p.id)] = { text: p.text || '', period: p.period?.number, clock: p.clock?.displayValue }
    }))
  const points = (summary.winprobability || []).map((e, i) => {
    const home = e.homeWinPercentage * 100
    return {
      i,
      wp: Math.round((packersHome ? home : 100 - home) * 10) / 10,
      scoring: scoringIds.has(String(e.playId)),
      playId: String(e.playId),
    }
  })
  let biggest = null
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].wp - points[i - 1].wp
    if (!biggest || delta > biggest.delta) biggest = { delta, ...points[i], ...(playText[points[i].playId] || {}) }
  }
  return { points, biggest: biggest && biggest.delta >= 4 ? biggest : null }
}

// A game's offensive snaps of 20+ yards from the Packers, biggest first — the "chunk plays"
// list. Pass/rush snaps only: punts, kickoffs and field goals also carry big statYardage
// numbers, but a 55-yard missed field goal is nobody's explosive play — and turnover returns
// ("Pass Interception Return", fumble returns) carry the OPPONENT's return yardage on a
// Packers drive, which is nobody's Packers gain either.
export function bigPlays(summary, packersId = TEAM_ID) {
  const plays = []
  ;(summary.drives?.previous || []).forEach((d) => {
    if (Number(d.team?.id) !== packersId) return
    ;(d.plays || []).forEach((p) => {
      const type = p.type?.text || ''
      if (!/pass|rush|touchdown/i.test(type) || /punt|kick|field goal|intercept|fumble/i.test(type)) return
      if ((p.statYardage || 0) >= 20) {
        plays.push({
          id: p.id,
          yards: p.statYardage,
          text: p.text || '',
          period: p.period?.number,
          clock: p.clock?.displayValue || '',
          scoring: !!p.scoringPlay,
        })
      }
    })
  })
  return plays.sort((a, b) => b.yards - a.yards)
}

// Season chunk-play leaderboard: every 20+ yard offensive gain across the season's summaries,
// credited to the runner or receiver parsed from the play text (GSIS play-by-play is regular:
// rushes lead with the ball-carrier, passes name the receiver after "to"; each word of a
// surname is capitalized, so the match stops before verbs). Plays that don't parse are
// skipped rather than mis-credited.
const CHUNK_NAME = /([A-Z])\.((?:[A-Z][A-Za-z'’-]*)(?:\s[A-Z][A-Za-z'’-]*)*)/
export function chunkLeaders(entries) {
  const byName = {}
  entries.forEach(({ summary }) => {
    bigPlays(summary).forEach((p) => {
      const isPass = /pass/i.test(p.text)
      const src = isPass ? (/\sto\s(.+)$/.exec(p.text) || [])[1] : p.text.replace(/^\([^)]*\)\s*/, '')
      const m = CHUNK_NAME.exec(src || '')
      if (!m) return
      const name = `${m[1]}.${m[2]}`
      const r = byName[name] || (byName[name] = { name, initial: m[1], last: m[2], plays: 0, yards: 0, longest: 0, tds: 0 })
      r.plays++
      r.yards += p.yards
      r.longest = Math.max(r.longest, p.yards)
      if (p.scoring) r.tds++
    })
  })
  return Object.values(byName).sort((a, b) => b.plays - a.plays || b.yards - a.yards)
}

// Season drive profile from the cached summaries — how possessions start, how efficiently
// they move, and how they end — for the offense AND the defense (opponents' drives against
// Green Bay). Clock-kill possessions (END OF HALF/GAME) sit out entirely. A drive's points
// come from the scoring plays it contains, credited only when the DRIVING team scored — a
// pick-six thrown by the offense is that drive ending in a turnover, not points. ESPN's
// start.yardLine is a FIXED home-goal coordinate (verified: home "GB 17" → 17, away
// "DET 24" → 76), so own-side field position = yardLine for the home team and
// 100 - yardLine for the visitor.
export function driveDNA(entries, packersId = TEAM_ID) {
  const mk = () => ({ drives: 0, points: 0, threeOuts: 0, startSum: 0, startN: 0, ends: { TD: 0, FG: 0, Punt: 0, Turnover: 0, Other: 0 } })
  const sides = { offense: mk(), defense: mk() }
  entries.forEach(({ summary }) => {
    const homeId = Number(summary.header?.competitions?.[0]?.competitors?.find((c) => c.homeAway === 'home')?.team?.id)
    const pts = {} // scoring play id → { points, teamId }, from the running score
    let h = 0, a = 0
    ;(summary.scoringPlays || []).forEach((p) => {
      pts[String(p.id)] = { points: (p.homeScore - h) + (p.awayScore - a), teamId: Number(p.team?.id) }
      h = p.homeScore
      a = p.awayScore
    })
    ;(summary.drives?.previous || []).forEach((d) => {
      const teamId = Number(d.team?.id)
      const s = teamId === packersId ? sides.offense : sides.defense
      const result = (d.result || '').toUpperCase()
      if (!result || /END OF (HALF|GAME)/.test(result)) return
      s.drives++
      ;(d.plays || []).forEach((p) => {
        const sc = pts[String(p.id)]
        if (sc && sc.teamId === teamId) s.points += sc.points
      })
      if (result === 'PUNT' && (d.offensivePlays ?? 99) <= 3) s.threeOuts++
      if (d.start?.yardLine != null && homeId) {
        s.startSum += teamId === homeId ? d.start.yardLine : 100 - d.start.yardLine
        s.startN++
      }
      if (/INT|FUMBLE|DOWNS/.test(result)) s.ends.Turnover++
      else if (/TD|TOUCHDOWN/.test(result)) s.ends.TD++
      else if (result === 'FG') s.ends.FG++
      else if (result === 'PUNT') s.ends.Punt++
      else s.ends.Other++
    })
  })
  const rates = (s) => (s.drives ? {
    drives: s.drives,
    pointsPerDrive: s.points / s.drives,
    threeOutPct: (s.threeOuts / s.drives) * 100,
    avgStart: s.startN ? Math.round(s.startSum / s.startN) : null,
    ends: s.ends,
  } : null)
  return { offense: rates(sides.offense), defense: rates(sides.defense) }
}

// The Packers' top performer lines from a summary's per-team leaders — e.g.
// [{ cat: 'Passing', name: 'Jordan Love', line: '22/30, 268 YDS, 3 TD' }].
const CAT_LABELS = { passingYards: 'Passing', rushingYards: 'Rushing', receivingYards: 'Receiving', sacks: 'Sacks', totalTackles: 'Tackles' }
export function teamGameLeaders(summary, teamId = TEAM_ID, cats = ['passingYards', 'rushingYards', 'receivingYards']) {
  const side = (summary.leaders || []).find((t) => Number(t.team?.id) === teamId)
  if (!side) return []
  const out = []
  cats.forEach((cat) => {
    const c = (side.leaders || []).find((x) => x.name === cat)
    const l = c?.leaders?.[0]
    if (l?.athlete) {
      out.push({
        cat: CAT_LABELS[cat] || cat,
        id: Number(l.athlete.id),
        name: l.athlete.displayName,
        line: l.displayValue || '',
      })
    }
  })
  return out
}

// Current + season-to-date framing over the Packers' schedule: e.g. "Won 3 of the last 4" plus
// the next stretch's flavor ("Two straight at Lambeau coming up"). Small editorial garnish.
export function scheduleNotes(games) {
  const done = finals(games)
  const notes = []
  if (done.length >= 3) {
    const last4 = done.slice(-4)
    const w = last4.filter((g) => g.won).length
    if (w >= 3) notes.push(`Won ${w} of the last ${last4.length}`)
    else if (w <= 1) notes.push(`Dropped ${last4.length - w} of the last ${last4.length}`)
  }
  const upcoming = (games || []).filter((g) => g.state === 'pre').slice(0, 3)
  const homeRun = upcoming.length && upcoming.every((g) => g.home) ? upcoming.length : 0
  if (homeRun >= 2) notes.push(`${homeRun} straight at Lambeau coming up`)
  const roadRun = upcoming.length && upcoming.every((g) => !g.home) ? upcoming.length : 0
  if (roadRun >= 2) notes.push(`${roadRun} straight on the road coming up`)
  return notes
}

// Score + describe each "this day in history" game, best first. Surfaces the fun angle:
// playoff win > overtime > shutout > comeback-ish blowout > win > loss.
export function rankThisDay(items) {
  const scored = items.map(({ game }) => {
    const year = new Date(game.date).getFullYear() // calendar year (a Jan playoff game belongs to the prior season)
    const won = !!game.won
    const margin = Math.abs((game.meScore ?? 0) - (game.oppScore ?? 0))
    const ot = /OT/i.test(game.detail || '')
    const playoff = game.seasonType === 3
    const shutout = won && game.oppScore === 0
    const roundName = game.note || (playoff ? 'the playoffs' : '')
    let rank, text
    const score = won ? `${game.meScore}–${game.oppScore}` : `${game.oppScore}–${game.meScore}`
    if (playoff && won) { rank = 7; text = `the Packers beat the ${game.oppName} ${score}${roundName ? ` in ${roundName}` : ' in the playoffs'}` }
    else if (won && ot) { rank = 5; text = `the Packers outlasted the ${game.oppName} in overtime, ${score}` }
    else if (shutout) { rank = 4; text = `the Packers shut out the ${game.oppName}, ${score}` }
    else if (won && margin >= 17) { rank = 3; text = `the Packers routed the ${game.oppName}, ${score}` }
    else if (won) { rank = 1; text = `the Packers beat the ${game.oppName}, ${score}` }
    else if (playoff) { rank = 0.5; text = `the Packers' playoff run ended against the ${game.oppName}, ${score}${roundName ? ` in ${roundName}` : ''}` }
    else { rank = 0; text = `the Packers fell to the ${game.oppName}, ${score}` }
    return { year, id: game.id, won, rank, margin, text }
  })
  scored.sort((a, b) => b.rank - a.rank || b.margin - a.margin || b.year - a.year)
  return scored
}

// A win-percentage record projected across a full season, for the pace bar.
export function paceWins(row) {
  const played = row.wins + row.losses + row.ties
  if (!played) return null
  return Math.round(((row.wins + row.ties / 2) / played) * GAMES_IN_SEASON)
}
