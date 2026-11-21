// The rooting guide's arithmetic, apart from its section so the bar TV board and the newsletter
// card can show the same rows: every game of the week that touches the NFC table, run both ways
// through the house sim (playoffSim.js gameOutcomes) on the table's ONE seed.
import { TEAM_ID, SEASON } from './config.js'
import { fetchStandings, fetchStatsSeason, fetchPickemWeek, fetchScoreboardWeek } from './api.js'
import { conferenceTeams, gameOutcomes, seedFrom, openRace } from './playoffSim.js'

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

export async function buildWeek() {
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

// The swing a row PRINTS (rounded odds apart), and the week's other games in the order every
// surface lists them: by that printed number, the unrounded gap only breaking ties — sorted on
// the unrounded gap alone, a row reading "3 pts" sat above one reading "4 pts" (Nov 2026). Under
// a point, a game isn't a rooting interest.
export const swing = (g) => Math.abs(g.ifHome - g.ifAway)
export const rootingRows = (week) => week.games
  .filter((g) => !g.mine && swing(g) >= 1)
  .sort((a, b) => swing(b) - swing(a) || b.exact - a.exact)
