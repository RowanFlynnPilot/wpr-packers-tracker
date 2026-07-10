import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SEASON } from '../config.js'
import { fetchTeamStats, fetchStandingsBundle } from '../api.js'
import Section from './Section.jsx'

// "The team, in profile" — how the Packers' offense and defense stack up league-wide: a row of
// stat tiles, each with its NFL rank chip (ranks ride along on ESPN's statistics feed; the
// points-allowed rank comes from the shared standings). Owns its Section; fail-soft.
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }

const TILES = [
  { label: 'Points / game', cat: 'scoring', name: 'totalPointsPerGame' },
  { label: 'Pass yards / game', cat: 'passing', name: 'netPassingYardsPerGame' },
  { label: 'Rush yards / game', cat: 'rushing', name: 'rushingYardsPerGame' },
  { label: 'Third downs', cat: 'miscellaneous', name: 'thirdDownConvPct' },
  { label: 'Sacks', cat: 'defensive', name: 'sacks' },
  { label: 'Interceptions', cat: 'defensiveInterceptions', name: 'interceptions' },
]

export default function TeamProfile() {
  const [stats, setStats] = useState(null)
  const [bundle, setBundle] = useState(null)

  useEffect(() => {
    fetchTeamStats(TEAM_ID).then(setStats).catch(() => {})
    fetchStandingsBundle().then(setBundle).catch(() => {})
  }, [])

  if (!stats) return null

  const tiles = TILES.map((t) => {
    const s = stats.cats?.[t.cat]?.[t.name]
    return s ? { ...t, display: s.display, rank: s.rank } : null
  }).filter(Boolean)

  // Points allowed per game, ranked from the standings (the statistics feed only ranks a
  // team's own production).
  if (bundle) {
    const me = bundle.league.find((r) => r.id === TEAM_ID)
    const played = me ? me.wins + me.losses + me.ties : 0
    if (me && played > 0) {
      tiles.splice(1, 0, {
        label: 'Points allowed / game',
        display: (me.pointsAgainst / played).toFixed(1),
        rank: bundle.ranks.pointsAgainst.rank,
      })
    }
  }

  if (tiles.length < 4) return null

  return (
    <Section kicker="League context" title="The team, in profile">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ flex: '1 1 130px', minWidth: 118, border: `1px solid ${theme.rule}`, borderRadius: 8, padding: '13px 14px' }}>
            <div style={{ fontFamily: theme.serif, fontSize: 26, color: theme.ink, lineHeight: 1 }}>{t.display}</div>
            <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.muted, marginTop: 7 }}>{t.label}</div>
            {t.rank && (
              <div style={{ display: 'inline-block', marginTop: 7, fontFamily: theme.sans, fontSize: 10, fontWeight: 700, color: t.rank <= 10 ? theme.green : t.rank >= 23 ? theme.red : theme.muted, background: theme.wash, borderRadius: 4, padding: '2px 7px' }}>
                {ord(t.rank)} in the NFL
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 12 }}>
        {stats.season < SEASON ? `Final ${stats.season} numbers` : 'Season to date'} · ranks are NFL-wide
      </div>
    </Section>
  )
}
