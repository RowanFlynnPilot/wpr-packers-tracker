import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SEASON, CONFERENCE, DIVISION_NAME, GAMES_IN_SEASON } from '../config.js'
import { fetchStandings, fetchStatsSeason } from '../api.js'
import Section from './Section.jsx'

const SIMS = 4000

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

// Monte Carlo the rest of the NFC season, in the browser (no backend, per the architecture).
// Model, honestly simple: each team's true talent is its win% (ties count half) regressed
// toward .500 by BALLAST games; remaining wins are drawn from a normal approximation of the
// binomial (fast — 4,000 seasons in well under a second). Four division winners + three wild
// cards make the seven-team field. Ties break by a per-sim jitter. Known simplification: each
// team's remaining games are drawn independently, so head-to-head games aren't coupled. This is
// a HOUSE MODEL for editorial flavor, not Vegas — the label under the dials says so.
function simulate(teams) {
  let post = 0, division = 0
  const myFinals = new Array(SIMS) // per-sim win totals → a real median, not a mean in disguise
  const n = teams.length
  const random = seededRandom(seedFrom(teams))
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

// SVG donut dial: value% filled, big number centered. Until a spot is mathematically decided,
// nothing is truly 0 or 100 — the display caps at >99% / <1% so the model never claims a lock.
function Dial({ value, label, color }) {
  const R = 44, C = 2 * Math.PI * R
  const text = value >= 100 ? '>99%' : value <= 0 ? '<1%' : `${value}%`
  return (
    <div style={{ textAlign: 'center', flex: '0 1 170px' }}>
      <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`${label}: ${text}`}>
        <circle cx="60" cy="60" r={R} fill="none" stroke={theme.rule} strokeWidth="10" />
        <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(Math.min(99.5, Math.max(0.5, value)) / 100) * C} ${C}`} transform="rotate(-90 60 60)" />
        <text x="60" y="66" textAnchor="middle" fontFamily={theme.serif} fontSize="26" fill={theme.ink}>{text}</text>
      </svg>
      <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, marginTop: 4 }}>{label}</div>
    </div>
  )
}

// "The January picture" — playoff + division odds from the in-browser simulation. Owns its
// Section; renders nothing until the CURRENT season has results (a coin-flip preseason sim
// would be noise, so the section simply waits for Week 1), and never on failure.
export default function PlayoffOdds() {
  const [odds, setOdds] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      // Gate on the phase source, not the standings: ESPN's preseason standings aren't
      // empty (the Hall of Fame game shows up as a 1–0 in August), so "any recorded
      // result" opens the gate a month early. fetchStatsSeason flips to SEASON only once
      // a regular-season game is final — exactly when the sim stops being a coin flip.
      if (await fetchStatsSeason() !== SEASON) return
      const rows = await fetchStandings(SEASON)
      if (!alive) return
      const conf = rows.filter((t) => t.conf === CONFERENCE)
      if (conf.length < 12) return // sanity: a short table means a bad response — skip quietly
      setOdds(simulate(conf))
    })().catch(() => {})
    return () => { alive = false }
  }, [])

  if (!odds) return null

  return (
    <Section kicker="The January picture" title="Playoff odds">
      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, flexWrap: 'wrap' }}>
        <Dial value={odds.postseason} label="Make the playoffs" color={theme.green} />
        <Dial value={odds.division} label={`Win the ${DIVISION_NAME}`} color={theme.goldText} />
      </div>
      <div style={{ textAlign: 'center', fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 14 }}>
        Median simulated finish: <span style={{ color: theme.green, fontWeight: 700 }}>{odds.medianWins} wins</span>
      </div>
      <div style={{ textAlign: 'center', fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 5 }}>
        Our house model — {SIMS.toLocaleString()} rest-of-season simulations run in your browser, refreshed with the standings.
      </div>
    </Section>
  )
}
