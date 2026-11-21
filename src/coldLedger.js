// The cold ledger's data: every Packers home game at Lambeau since 2000 with its estimated
// kickoff temperature. Finished seasons come baked (lambeauHistory.js — generated once a year by
// scripts/lambeau-history.mjs; history doesn't change, so this is not the forbidden data cache);
// the season in progress is read live — the schedule the page already holds plus ONE read of
// Open-Meteo's archive. A just-played game joins once the archive has its hour (a day or so).
import { SEASON } from './config.js'
import { fetchSeasonGames } from './api.js'
import { fetchKickoffTemps } from './weather.js'
import { LAMBEAU_GAMES, HISTORY_FROM, HISTORY_THROUGH } from './lambeauHistory.js'

export const LEDGER_FROM = HISTORY_FROM
const LAMBEAU = 'Lambeau Field'

const entry = (date, oppId, gb, opp, temp, post, current = false) =>
  ({ date, oppId, gb, opp, temp, post: !!post, won: gb > opp, tied: gb === opp, current })

let memo = null // { t, p }
export function loadLedger() {
  if (memo && Date.now() - memo.t < 600000) return memo.p
  const p = (async () => {
    const baked = LAMBEAU_GAMES.map((g) => entry(...g))
    if (SEASON <= HISTORY_THROUGH) return baked
    // A whole season missing between the baked file and this one would make "since 2000" a lie.
    if (SEASON - HISTORY_THROUGH > 1) throw new Error('lambeauHistory.js is a season behind — rerun scripts/lambeau-history.mjs')
    const { games } = await fetchSeasonGames()
    const played = games.filter((g) => g.seasonType !== 1 && g.state === 'post' && g.home && g.venue === LAMBEAU && g.meScore != null && g.oppScore != null)
    const temps = await fetchKickoffTemps(played.map((g) => g.date))
    return [
      ...baked,
      ...played.filter((g) => temps[g.date] != null).map((g) => entry(g.date, g.oppId, g.meScore, g.oppScore, temps[g.date], g.seasonType === 3, true)),
    ]
  })().catch((e) => { memo = null; throw e })
  memo = { t: Date.now(), p }
  return p
}

// Where a kickoff at `temp` would rank, coldest first: one more than the games strictly colder.
export const coldRank = (entries, temp) => entries.filter((e) => e.temp < temp).length + 1

export const coldest = (entries, n = 10) => [...entries].sort((a, b) => a.temp - b.temp || new Date(a.date) - new Date(b.date)).slice(0, n)

// The Packers' Lambeau record by kickoff temperature. Bands a fan would name: bitter, below
// freezing, cool, mild.
const BANDS = [
  { label: 'Under 15°F', max: 14 },
  { label: '15–31°F', max: 31 },
  { label: '32–49°F', max: 49 },
  { label: '50°F and up', max: Infinity },
]
export function bandRecords(entries) {
  return BANDS.map((b, i) => {
    const min = i ? BANDS[i - 1].max + 1 : -Infinity
    const games = entries.filter((e) => e.temp >= min && e.temp <= b.max)
    const w = games.filter((e) => e.won).length
    const t = games.filter((e) => e.tied).length
    return { label: b.label, w, l: games.length - w - t, t, n: games.length, pct: games.length ? (w + t / 2) / games.length : null }
  })
}

// Wins–losses(–ties) for any slice, e.g. every game below freezing.
export function recordOf(games) {
  const w = games.filter((e) => e.won).length
  const t = games.filter((e) => e.tied).length
  return `${w}–${games.length - w - t}${t ? `–${t}` : ''}`
}
