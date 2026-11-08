import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { SEASON, DIVISION_NAME, DIVISION, TEAM_ID } from '../config.js'
import { fetchStandings, fetchStatsSeason } from '../api.js'
import { conferenceTeams, simulate, oddsText, SIMS } from '../playoffSim.js'
import Section from './Section.jsx'
import SuperBowlRoad from './SuperBowlRoad.jsx'

// SVG donut dial: value% filled, big number centered (oddsText caps at >99% / <1% — the model
// never claims a lock). `settled` ('in' | 'out') is ESPN's clinch math overruling the sim: once a
// spot is clinched or gone, the dial says so instead of a simulated 97%.
function Dial({ value, label, color, settled }) {
  const R = 44, C = 2 * Math.PI * R
  if (settled) value = settled === 'in' ? 100 : 0
  const text = settled === 'in' ? 'In' : settled === 'out' ? 'Out' : oddsText(value)
  return (
    // 140px apiece so the two dials sit side by side even in the ~310px WPR embed — at 170 they
    // stacked on every phone and took ~550px of the Season tab.
    <div style={{ textAlign: 'center', flex: '0 1 140px' }}>
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

// "The January picture" — playoff + division odds from the in-browser simulation (playoffSim.js).
// What this week's games are worth lives in the rooting guide below it (the Packers' own game
// first), so this section no longer repeats a "This week" line. Owns its Section; renders
// nothing until the CURRENT season has results (a coin-flip preseason sim would be noise, so
// the section simply waits for Week 1), and never on failure.
export default function PlayoffOdds() {
  const [odds, setOdds] = useState(null)
  const [settled, setSettled] = useState({}) // { postseason, division }: 'in' | 'out' per ESPN

  useEffect(() => {
    let alive = true
    ;(async () => {
      // Gate on the phase source, not the standings: ESPN's preseason standings aren't
      // empty (the Hall of Fame game shows up as a 1–0 in August), so "any recorded
      // result" opens the gate a month early. fetchStatsSeason flips to SEASON only once
      // a regular-season game is final — exactly when the sim stops being a coin flip.
      if (await fetchStatsSeason() !== SEASON) return
      const rows = await fetchStandings(SEASON)
      const teams = conferenceTeams(rows)
      if (!alive || !teams) return
      setOdds(simulate(teams))
      const mark = rows.find((r) => r.id === TEAM_ID)?.clincher || ''
      const rivalWon = rows.some((r) => DIVISION[r.id] && r.id !== TEAM_ID && (r.clincher === 'z' || r.clincher === '*'))
      setSettled({
        postseason: mark === 'e' ? 'out' : mark ? 'in' : null,
        division: mark === 'z' || mark === '*' ? 'in' : mark === 'e' || rivalWon ? 'out' : null,
      })
    })().catch(() => {})
    return () => { alive = false }
  }, [])

  if (!odds) return null

  return (
    <Section kicker="The January picture" title="Playoff odds">
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px 16px', flexWrap: 'wrap' }}>
        <Dial value={odds.postseason} label={settled.postseason === 'in' ? 'Playoff spot clinched' : settled.postseason === 'out' ? 'Eliminated' : 'Make the playoffs'} color={theme.green} settled={settled.postseason} />
        <Dial value={odds.division} label={settled.division === 'in' ? `${DIVISION_NAME} champions` : `Win the ${DIVISION_NAME}`} color={theme.goldText} settled={settled.division} />
      </div>
      <div style={{ textAlign: 'center', fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 14 }}>
        Median simulated finish: <span style={{ color: theme.green, fontWeight: 700 }}>{odds.medianWins} wins</span>
      </div>
      <div style={{ textAlign: 'center', fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 8 }}>
        Our house model — {SIMS.toLocaleString()} rest-of-season simulations run in your browser, refreshed with the standings.
      </div>
      {/* ESPN's round-by-round odds — a second, separately labeled model, never blended. */}
      <SuperBowlRoad housePlayoffs={settled.postseason ? null : odds.postseason} />
    </Section>
  )
}
