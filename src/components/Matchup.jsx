import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, TEAM_NAMES, SEASON } from '../config.js'
import { fetchFeaturedGame, fetchTeamStats } from '../api.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Section from './Section.jsx'
import TeamLogo from './TeamLogo.jsx'

// "Sizing up the opponent" — ahead of the next game, the two offenses side by side: points,
// passing, rushing, third downs, giveaways, each with its NFL rank. Renders only pre-game;
// fail-soft everywhere — any miss and the section simply doesn't exist. Before Week 1 the
// comparison uses last season's numbers (the note says so).
const ROWS = [
  { label: 'Points per game', cat: 'scoring', name: 'totalPointsPerGame' },
  { label: 'Passing yards per game', cat: 'passing', name: 'netPassingYardsPerGame' },
  { label: 'Rushing yards per game', cat: 'rushing', name: 'rushingYardsPerGame' },
  { label: 'Third-down conversions', cat: 'miscellaneous', name: 'thirdDownConvPct' },
  { label: 'Giveaways', cat: 'miscellaneous', name: 'totalGiveaways', lowerBetter: true },
]

const pick = (stats, cat, name) => stats?.cats?.[cat]?.[name] || null

export default function Matchup() {
  const [game, setGame] = useState(null)
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)
  const narrow = useIsNarrow()

  useEffect(() => {
    fetchFeaturedGame().then(setGame).catch(() => {})
  }, [])

  const upcoming = game?.state === 'pre'
  const oppId = upcoming ? game.oppId : null

  useEffect(() => {
    setMine(null)
    setTheirs(null)
    if (!oppId) return
    let alive = true
    Promise.all([fetchTeamStats(TEAM_ID), fetchTeamStats(oppId)]).then(([a, b]) => {
      if (!alive) return
      setMine(a)
      setTheirs(b)
    }).catch(() => {})
    return () => { alive = false }
  }, [oppId])

  if (!upcoming || !mine || !theirs) return null

  // Each side gets its own strict edge test so a statistical tie bolds NEITHER side (with a
  // single flag the "not better" side would inherit the highlight).
  const rows = ROWS.map((r) => {
    const a = pick(mine, r.cat, r.name)
    const b = pick(theirs, r.cat, r.name)
    if (!a || !b) return null
    return {
      ...r, a, b,
      edgeA: r.lowerBetter ? a.value < b.value : a.value > b.value,
      edgeB: r.lowerBetter ? b.value < a.value : b.value > a.value,
    }
  }).filter(Boolean)
  if (rows.length < 3) return null

  const oppName = TEAM_NAMES[game.oppId] || game.oppName
  const stale = mine.season < SEASON
  const rank = (s) => (s.rank ? `#${s.rank}` : null)

  const side = (s, edge, align) => (
    <div style={{ width: narrow ? 92 : 130, textAlign: align, flexShrink: 0 }}>
      <span style={{ fontFamily: theme.serif, fontSize: 17, fontWeight: edge ? 700 : 400, color: edge ? theme.green : theme.ink }}>
        {s.display}
      </span>
      {rank(s) && (
        <span style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, color: edge ? theme.goldText : theme.muted, marginLeft: 6 }}>{rank(s)}</span>
      )}
    </div>
  )

  return (
    <Section kicker="The matchup" title={`Sizing up the ${oppName}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 560, margin: '0 auto 6px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: theme.serif, fontSize: 16, fontWeight: 700, color: theme.green }}>
          <TeamLogo id={TEAM_ID} size={24} /> Packers
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: theme.serif, fontSize: 16, color: theme.ink }}>
          {oppName} <TeamLogo id={game.oppId} size={24} />
        </span>
      </div>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {rows.map((r, i) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none' }}>
            {side(r.a, r.edgeA, 'left')}
            <span style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.muted, textAlign: 'center', flex: 1 }}>{r.label}</span>
            {side(r.b, r.edgeB, 'right')}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 12, textAlign: 'center' }}>
        {stale ? `Final ${mine.season} numbers · #-ranks are NFL-wide` : 'Season to date · #-ranks are NFL-wide'}
      </div>
    </Section>
  )
}
