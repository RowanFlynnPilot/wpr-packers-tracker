// The pick'em's memory and season math. Picks live in THIS browser by design — no accounts,
// no backend — under one localStorage key per season, one entry per week:
//   { [week]: { picks: { [gameId]: teamId }, tiebreak?: number, result?: {…} } }
// A past week's `result` is written once it settles, so the season tally never refetches it:
//   { correct, total,                      // the reader's decided calls
//     model?: { correct, total, mine },    // ESPN FPI on the same calls, and the reader's correct count on them
//     tiebreak?: { guess, actual },        // total points in the tiebreaker game
//     pack?: { backed, correct } }         // the Packers game: did they back the Pack, and did it land
import { SEASON, TEAM_ID } from './config.js'
import { fetchScoreboardWeek, fetchWeekProjections } from './api.js'
import { gradePicks, gradeModel, tiebreakGame, winnerOf } from './games.js'

const KEY = `packersPickem:${SEASON}`
export const readStore = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}
export const writeStore = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }

// A week's result from its games + the reader's entry — the same shape whether the week is
// being settled into storage or graded live for the ledger (`pending` rides along for the
// live case; settling drops it).
export function weekResult(games, entry, proj = {}) {
  const picks = entry.picks || {}
  const grade = gradePicks(games, picks)
  const result = { correct: grade.correct, total: grade.decided, pending: grade.pending }
  const model = gradeModel(games, picks, proj)
  if (model.decided) result.model = { correct: model.correct, total: model.decided, mine: model.mine }
  const tb = tiebreakGame(games)
  if (tb && entry.tiebreak != null && tb.completed) result.tiebreak = { guess: entry.tiebreak, actual: tb.home.score + tb.away.score }
  const pg = games.find((g) => g.home.id === TEAM_ID || g.away.id === TEAM_ID)
  const pick = pg && picks[pg.id]
  if (pg && pick && pg.completed) result.pack = { backed: pick === TEAM_ID, correct: winnerOf(pg) === pick }
  return result
}

// Settle every past week that has picks but no stored result. One scoreboard read (plus the
// slate's projections, for the model's line) per unsettled week — normally one. A week settles
// when every picked game is final, or, once it sits two behind the league clock, on whatever
// HAS decided: a postponed game must never hold a week's correct calls out of the tally
// forever. Returns the updated store when anything changed, else null.
export async function settlePastWeeks(currentWeek) {
  const s = readStore()
  let changed = false
  for (const wk of Object.keys(s)) {
    const entry = s[wk]
    const n = Number(wk)
    if (!entry?.picks || entry.result || n >= currentWeek) continue
    try {
      const games = await fetchScoreboardWeek(n)
      const grade = gradePicks(games, entry.picks)
      const stale = n < currentWeek - 1
      if (!grade.decided || (grade.pending && !stale)) continue
      const proj = await fetchWeekProjections(games).catch(() => ({}))
      const { pending, ...result } = weekResult(games, entry, proj)
      entry.result = result
      changed = true
    } catch { /* settles on a later visit */ }
  }
  if (changed) writeStore(s)
  return changed ? s : null
}

// Season totals: settled weeks' stored results plus the league week's live result (`live` is
// null until its slate loads). `weeks` is the per-week ledger the rail draws its records from;
// `best` only considers weeks with nothing pending.
export function seasonTally(store, liveWeek, live) {
  const t = { correct: 0, total: 0, model: { correct: 0, total: 0, mine: 0 }, best: null, backed: 0, packGames: 0, weeks: {} }
  const add = (wk, r) => {
    if (!r?.total) return
    t.correct += r.correct
    t.total += r.total
    if (r.model) { t.model.correct += r.model.correct; t.model.total += r.model.total; t.model.mine += r.model.mine || 0 }
    if (r.pack) { t.packGames++; if (r.pack.backed) t.backed++ }
    const net = r.correct - (r.total - r.correct)
    if (!r.pending && (!t.best || net > t.best.net)) t.best = { week: wk, correct: r.correct, total: r.total, net }
    t.weeks[wk] = r
  }
  Object.entries(store).forEach(([wk, e]) => { if (e?.result && Number(wk) !== liveWeek) add(Number(wk), e.result) })
  if (live && liveWeek != null) add(liveWeek, live)
  return t
}
