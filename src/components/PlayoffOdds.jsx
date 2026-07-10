import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SEASON, CONFERENCE, DIVISION_NAME, GAMES_IN_SEASON } from '../config.js'
import { fetchStandings } from '../api.js'
import Section from './Section.jsx'

const SIMS = 4000

// Monte Carlo the rest of the NFC season, in the browser (no backend, per the architecture).
// Model, honestly simple: each team's true talent is its win% (ties count half) regressed
// toward .500 with 4 games of ballast; remaining wins are drawn from a normal approximation of
// the binomial (fast — 4,000 seasons in well under a second). Four division winners + three
// wild cards make the seven-team field. Ties break by a per-sim random jitter. This is a HOUSE
// MODEL for editorial flavor, not Vegas — the label under the dials says so.
function simulate(teams) {
  let post = 0, division = 0
  const myFinals = new Array(SIMS) // per-sim win totals → a real median, not a mean in disguise
  const n = teams.length
  const talent = teams.map((t) => (t.wins + t.ties / 2 + 2) / (t.wins + t.losses + t.ties + 4))
  const remaining = teams.map((t) => Math.max(0, GAMES_IN_SEASON - t.wins - t.losses - t.ties))
  const meIdx = teams.findIndex((t) => t.id === TEAM_ID)
  const divisions = [...new Set(teams.map((t) => t.divName))]
  const normal = () => {
    let u = 0, v = 0
    while (u === 0) u = Math.random()
    while (v === 0) v = Math.random()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  for (let s = 0; s < SIMS; s++) {
    const finals = new Array(n)
    for (let i = 0; i < n; i++) {
      const r = remaining[i], p = talent[i]
      const mu = r * p, sd = Math.sqrt(Math.max(0.0001, r * p * (1 - p)))
      const add = Math.min(r, Math.max(0, Math.round(mu + sd * normal())))
      finals[i] = teams[i].wins + teams[i].ties / 2 + add + Math.random() * 0.5 // jitter breaks ties randomly
    }
    myFinals[s] = finals[meIdx]
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
    fetchStandings(SEASON).then((rows) => {
      if (!alive) return
      const conf = rows.filter((t) => t.conf === CONFERENCE)
      if (conf.length < 12) return // sanity: a short table means a bad response — skip quietly
      if (!conf.some((t) => t.wins + t.losses + t.ties > 0)) return // season hasn't kicked off
      setOdds(simulate(conf))
    }).catch(() => {})
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
