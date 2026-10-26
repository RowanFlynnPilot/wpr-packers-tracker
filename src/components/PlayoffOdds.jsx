import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { SEASON, DIVISION_NAME, TEAM_NAMES } from '../config.js'
import { fetchStandings, fetchStatsSeason, fetchSeasonGames } from '../api.js'
import { conferenceTeams, simulate, gameStakes, oddsText, SIMS } from '../playoffSim.js'
import Section from './Section.jsx'
import SuperBowlRoad from './SuperBowlRoad.jsx'

// SVG donut dial: value% filled, big number centered (oddsText caps at >99% / <1% — the model
// never claims a lock).
function Dial({ value, label, color }) {
  const R = 44, C = 2 * Math.PI * R
  const text = oddsText(value)
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

// "The January picture" — playoff + division odds from the in-browser simulation (playoffSim.js),
// plus what the NEXT game is worth (the same stakes the pregame hero shows, from the same seed,
// so the two surfaces agree to the point). Owns its Section; renders nothing until the CURRENT
// season has results (a coin-flip preseason sim would be noise, so the section simply waits
// for Week 1), and never on failure.
export default function PlayoffOdds() {
  const [odds, setOdds] = useState(null)
  const [next, setNext] = useState(null) // { game, stakes }

  useEffect(() => {
    let alive = true
    ;(async () => {
      // Gate on the phase source, not the standings: ESPN's preseason standings aren't
      // empty (the Hall of Fame game shows up as a 1–0 in August), so "any recorded
      // result" opens the gate a month early. fetchStatsSeason flips to SEASON only once
      // a regular-season game is final — exactly when the sim stops being a coin flip.
      if (await fetchStatsSeason() !== SEASON) return
      const teams = conferenceTeams(await fetchStandings(SEASON))
      if (!alive || !teams) return
      setOdds(simulate(teams))
      const { games } = await fetchSeasonGames()
      const game = games.find((g) => g.seasonType === 2 && g.state === 'pre')
      if (alive && game) setNext({ game, stakes: gameStakes(teams, game.oppId) })
    })().catch(() => {})
    return () => { alive = false }
  }, [])

  if (!odds) return null
  const swing = next ? next.stakes.win.postseason - next.stakes.loss.postseason : 0

  return (
    <Section kicker="The January picture" title="Playoff odds">
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px 16px', flexWrap: 'wrap' }}>
        <Dial value={odds.postseason} label="Make the playoffs" color={theme.green} />
        <Dial value={odds.division} label={`Win the ${DIVISION_NAME}`} color={theme.goldText} />
      </div>
      <div style={{ textAlign: 'center', fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 14 }}>
        Median simulated finish: <span style={{ color: theme.green, fontWeight: 700 }}>{odds.medianWins} wins</span>
      </div>
      {next && swing >= 2 && (
        <div style={{ maxWidth: 520, margin: '14px auto 0', textAlign: 'center', fontFamily: theme.serif, fontSize: 16, color: theme.ink, lineHeight: 1.45, borderTop: `1px solid ${theme.rule}`, paddingTop: 12 }}>
          <span style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700, marginRight: 8 }}>This week</span>
          {next.game.home ? 'vs' : 'at'} the {TEAM_NAMES[next.game.oppId] || next.game.oppName}: a win puts the odds at{' '}
          <strong style={{ color: theme.green }}>{oddsText(next.stakes.win.postseason)}</strong>, a loss at{' '}
          <strong style={{ color: theme.red }}>{oddsText(next.stakes.loss.postseason)}</strong>.
        </div>
      )}
      <div style={{ textAlign: 'center', fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 8 }}>
        Our house model — {SIMS.toLocaleString()} rest-of-season simulations run in your browser, refreshed with the standings.
      </div>
      {/* ESPN's round-by-round odds — a second, separately labeled model, never blended. */}
      <SuperBowlRoad housePlayoffs={odds.postseason} />
    </Section>
  )
}
