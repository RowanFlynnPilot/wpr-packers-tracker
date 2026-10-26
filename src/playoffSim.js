// The house playoff model: a Monte Carlo of the rest of the NFC season, run in the browser (no
// backend, per the architecture). Pure — hand it a conference table, get odds back. Used by the
// "Playoff odds" dials and by the stakes line ("Win → 68% · Loss → 41%") on the game hero.
import { TEAM_ID, GAMES_IN_SEASON, CONFERENCE } from './config.js'

export const SIMS = 4000

// How many games of .500 football each record is blended with before it's trusted as "true
// talent". ~12 is the NFL's regression constant: over a 17-game season, the spread in teams'
// records is roughly half real quality and half luck, and adding ~12 games of .500 is what
// cancels the luck half. At the old value of 4, a 2–0 start read as a .667 team with twelve
// wins coming — the Vikings in September 2026 — and the Packers, one game back with fifteen to
// play, were given a 7% division chance. Calibrated, the same standings say 14%.
const BALLAST = 12

// A small seeded PRNG (mulberry32). The sim draws from it instead of Math.random so the SAME
// standings always produce the SAME odds: an unseeded run re-rolled on every page load, and a
// reader refreshing saw 32% become 31% with nothing having happened.
function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
// The seed is the standings themselves — any result anywhere in the conference changes it.
const seedFrom = (teams) => teams.reduce((h, t) => Math.imul(h ^ (t.id * 1000 + t.wins * 37 + t.losses * 7 + t.ties), 16777619), 2166136261)

// The conference table the sim runs on — or null when the response looks wrong (a short table
// means a bad response; skip quietly rather than simulate nonsense).
export function conferenceTeams(rows) {
  const conf = rows.filter((t) => t.conf === CONFERENCE)
  return conf.length >= 12 ? conf : null
}

// Model, honestly simple: each team's true talent is its win% (ties count half) regressed
// toward .500 by BALLAST games; remaining wins are drawn from a normal approximation of the
// binomial (fast — 4,000 seasons in well under a second). Four division winners + three wild
// cards make the seven-team field. Ties break by a per-sim jitter. Known simplification: each
// team's remaining games are drawn independently, so head-to-head games aren't coupled. This is
// a HOUSE MODEL for editorial flavor, not Vegas — every surface that shows it says so.
// `seed` defaults to the standings' own; the stakes line passes one seed to several scenarios.
export function simulate(teams, seed = seedFrom(teams)) {
  let post = 0, division = 0
  const myFinals = new Array(SIMS) // per-sim win totals → a real median, not a mean in disguise
  const n = teams.length
  const random = seededRandom(seed)
  const talent = teams.map((t) => (t.wins + t.ties / 2 + BALLAST / 2) / (t.wins + t.losses + t.ties + BALLAST))
  const remaining = teams.map((t) => Math.max(0, GAMES_IN_SEASON - t.wins - t.losses - t.ties))
  const meIdx = teams.findIndex((t) => t.id === TEAM_ID)
  const divisions = [...new Set(teams.map((t) => t.divName))]
  const normal = () => {
    let u = 0, v = 0
    while (u === 0) u = random()
    while (v === 0) v = random()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  for (let s = 0; s < SIMS; s++) {
    const finals = new Array(n)
    for (let i = 0; i < n; i++) {
      const r = remaining[i], p = talent[i]
      const mu = r * p, sd = Math.sqrt(Math.max(0.0001, r * p * (1 - p)))
      const add = Math.min(r, Math.max(0, Math.round(mu + sd * normal())))
      finals[i] = teams[i].wins + teams[i].ties / 2 + add
    }
    // The median is of real win totals; the tie-break jitter goes only into the ranking.
    // (Mixed into the totals, it nudged the median up a quarter-win and flipped "9 wins" to
    // "8 wins" between two loads of the same standings.)
    myFinals[s] = finals[meIdx]
    for (let i = 0; i < n; i++) finals[i] += random() * 0.5
    const winners = new Set()
    divisions.forEach((div) => {
      let best = -1
      teams.forEach((t, i) => { if (t.divName === div && (best === -1 || finals[i] > finals[best])) best = i })
      if (best >= 0) winners.add(best)
    })
    const wc = teams.map((_, i) => i).filter((i) => !winners.has(i)).sort((a, b) => finals[b] - finals[a]).slice(0, 3)
    if (winners.has(meIdx)) { post++; division++ }
    else if (wc.includes(meIdx)) post++
  }
  myFinals.sort((a, b) => a - b)
  return {
    postseason: Math.round((post / SIMS) * 100),
    division: Math.round((division / SIMS) * 100),
    medianWins: Math.round(myFinals[SIMS >> 1]),
  }
}

// What one Packers game is worth: the sim three times — as things stand, with that game a
// Packers win, and with it a loss (the opponent takes the other side of the result when it's in
// the conference table). All three runs share ONE seed, so they draw the same random seasons
// and the gap between them is the result, not the dice — run on separate seeds, simulation
// noise of a point or two could make a win look worse than a loss.
export function gameStakes(teams, oppId) {
  const seed = seedFrom(teams)
  const settle = (gbWon) => teams.map((t) =>
    t.id === TEAM_ID ? { ...t, wins: t.wins + (gbWon ? 1 : 0), losses: t.losses + (gbWon ? 0 : 1) }
      : t.id === oppId ? { ...t, wins: t.wins + (gbWon ? 0 : 1), losses: t.losses + (gbWon ? 1 : 0) }
        : t)
  return { now: simulate(teams, seed), win: simulate(settle(true), seed), loss: simulate(settle(false), seed) }
}

// Until a spot is mathematically decided nothing is truly 0 or 100 — the model never claims a lock.
export const oddsText = (v) => (v >= 100 ? '>99%' : v <= 0 ? '<1%' : `${v}%`)
