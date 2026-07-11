import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SEASON } from '../config.js'
import { fetchTeamStats, fetchStandingsBundle } from '../api.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Section from './Section.jsx'

// "The team, in profile" — a league ladder instead of a KPI wall: every stat is a dot placed
// on the same 1st→32nd track (tick at the league median), grouped offense/defense, so the
// team's shape — what it does well, where it leaks — reads as geometry before anyone reads a
// number. Ranks ride along on ESPN's statistics feed (1 = best); points allowed is ranked
// from the shared standings. Owns its Section; fail-soft.
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }

const GROUPS = [
  ['Offense', [
    { label: 'Points per game', cat: 'scoring', name: 'totalPointsPerGame' },
    { label: 'Pass yards per game', cat: 'passing', name: 'netPassingYardsPerGame' },
    { label: 'Rush yards per game', cat: 'rushing', name: 'rushingYardsPerGame' },
    { label: 'Third-down rate', cat: 'miscellaneous', name: 'thirdDownConvPct', suffix: '%' },
  ]],
  ['Defense', [
    // Points allowed (from the standings) is spliced in first — see below.
    { label: 'Sacks', cat: 'defensive', name: 'sacks' },
    { label: 'Interceptions', cat: 'defensiveInterceptions', name: 'interceptions' },
  ]],
]

const rankColor = (rank) => (rank <= 10 ? theme.green : rank >= 23 ? theme.red : theme.muted)

// One stat on the ladder: label + value, the 1..32 track with the Packers' dot, the ordinal.
function LadderRow({ row, narrow, first }) {
  const pct = ((row.rank - 1) / 31) * 100
  const color = rankColor(row.rank)
  return (
    <div style={{ display: 'flex', alignItems: 'center', columnGap: 14, rowGap: 2, flexWrap: 'wrap', padding: '7px 0', borderTop: first ? 'none' : `1px solid ${theme.rule}` }}>
      <div style={{ width: narrow ? '100%' : 200, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.muted }}>{row.label}</span>
        <span style={{ fontFamily: theme.serif, fontSize: 16, color: theme.ink, fontVariantNumeric: 'tabular-nums' }}>{row.display}</span>
      </div>
      <div style={{ flex: '1 1 150px', position: 'relative', height: 16 }} aria-hidden="true">
        <div style={{ position: 'absolute', left: 0, right: 0, top: 7, height: 2, borderRadius: 1, background: theme.rule }} />
        <div style={{ position: 'absolute', left: '50%', top: 3, height: 10, width: 1, background: theme.rule }} />
        <div style={{ position: 'absolute', left: `calc(${pct}% - 5px)`, top: 3, width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 0 2px ${theme.paper}` }} />
      </div>
      <span style={{ width: 42, textAlign: 'right', fontFamily: theme.sans, fontSize: 11.5, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{ord(row.rank)}</span>
    </div>
  )
}

export default function TeamProfile() {
  const [stats, setStats] = useState(null)
  const [bundle, setBundle] = useState(null)
  const narrow = useIsNarrow()

  useEffect(() => {
    fetchTeamStats(TEAM_ID).then(setStats).catch(() => {})
    fetchStandingsBundle().then(setBundle).catch(() => {})
  }, [])

  if (!stats) return null

  const groups = GROUPS.map(([name, defs]) => [
    name,
    defs.map((t) => {
      const s = stats.cats?.[t.cat]?.[t.name]
      return s && s.rank ? { label: t.label, display: `${s.display}${t.suffix || ''}`, rank: s.rank } : null
    }).filter(Boolean),
  ])

  // Points allowed per game, ranked from the standings (the statistics feed only ranks a
  // team's own production).
  if (bundle) {
    const me = bundle.league.find((r) => r.id === TEAM_ID)
    const played = me ? me.wins + me.losses + me.ties : 0
    if (me && played > 0) {
      groups[1][1].unshift({
        label: 'Points allowed per game',
        display: (me.pointsAgainst / played).toFixed(1),
        rank: bundle.ranks.pointsAgainst.rank,
      })
    }
  }

  const rows = groups.flatMap(([, r]) => r)
  if (rows.length < 4) return null

  // The headline the ladder implies: best rank and worst rank, called out in words.
  const best = rows.reduce((a, b) => (b.rank < a.rank ? b : a))
  const worst = rows.reduce((a, b) => (b.rank > a.rank ? b : a))

  return (
    <Section kicker="League context" title="The team, in profile">
      <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 4px', maxWidth: 620, lineHeight: 1.5 }}>
        Every dot is the Packers' rank among the NFL's 32 teams — hugging the left edge leads
        the league, the tick is the median.
      </p>
      {best.rank !== worst.rank && (
        <p style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 14.5, color: theme.muted, margin: '0 0 14px', lineHeight: 1.5 }}>
          Sharpest edge: {best.label.toLowerCase()} (<span style={{ color: theme.green, fontWeight: 700, fontStyle: 'normal' }}>{ord(best.rank)}</span> in the NFL) ·
          biggest soft spot: {worst.label.toLowerCase()} (<span style={{ color: theme.red, fontWeight: 700, fontStyle: 'normal' }}>{ord(worst.rank)}</span>).
        </p>
      )}
      {groups.map(([name, groupRows]) => groupRows.length > 0 && (
        <div key={name} style={{ marginTop: 14 }}>
          <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700, marginBottom: 2 }}>{name}</div>
          {groupRows.map((row, i) => <LadderRow key={row.label} row={row} narrow={narrow} first={i === 0} />)}
        </div>
      ))}
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 14 }}>
        {stats.season < SEASON ? `Final ${stats.season} numbers` : 'Season to date'} · ranks are NFL-wide · 1st is best in every stat
      </div>
    </Section>
  )
}
