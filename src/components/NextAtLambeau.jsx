import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { fetchSeasonGames } from '../api.js'
import { fetchKickoffForecast } from '../weather.js'
import Section from './Section.jsx'
import TeamLogo from './TeamLogo.jsx'

// "Next at Lambeau" — the next home date: opponent, kickoff, TV, and (inside Open-Meteo's
// 16-day window) the Lambeau forecast, which is half the story of a Green Bay home game.
// Owns its Section chrome and is fully fail-soft: no upcoming home game renders nothing.
export default function NextAtLambeau() {
  const [game, setGame] = useState(null)
  const [forecast, setForecast] = useState(null)

  useEffect(() => {
    let alive = true
    fetchSeasonGames().then(({ games }) => {
      if (!alive) return
      const next = games.find((g) => g.state === 'pre' && g.home && g.seasonType !== 1)
      setGame(next || null)
      if (next) fetchKickoffForecast(next.date).then((f) => { if (alive) setForecast(f) }).catch(() => {})
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!game) return null

  const when = game.timeValid
    ? new Date(game.date).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : `${new Date(game.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · kickoff TBD`
  const days = Math.ceil((new Date(game.date) - Date.now()) / 86400000)

  return (
    <Section kicker="Circle the date" title="Next at Lambeau">
      <div style={{ border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 8, background: theme.wash, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <TeamLogo id={game.oppId} size={46} />
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <div style={{ fontFamily: theme.serif, fontSize: 20, color: theme.ink }}>
            {game.oppName} at Lambeau Field{game.week ? ` · Week ${game.week}` : ''}
          </div>
          <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 3 }}>
            {when}{game.tv ? ` · ${game.tv}` : ''}{days > 1 ? ` · in ${days} days` : ''}
          </div>
          {forecast && (
            <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 5 }}>
              Forecast: {forecast.tempF}°F, {forecast.label} · {forecast.precipPct}% precip · {forecast.windMph} mph wind
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}
