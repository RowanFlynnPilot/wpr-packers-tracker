import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { SEASON } from '../config.js'
import { fetchSeasonSummaries } from '../api.js'
import { driveDNA } from '../games.js'
import Section from './Section.jsx'
import Figures from './Figures.jsx'

// "Drive DNA" — the season, possession by possession: points per drive, three-and-out rate,
// average starting field position, and a how-drives-end bar, for the offense AND the defense
// (opponents' drives against Green Bay). Zero new network: it reads the same cached summaries
// the film room and chunk board already pulled. Owns its Section; fail-soft.
// Colors mean good or bad FOR GREEN BAY, so the two sides swap them: an offensive touchdown is
// green and a turnover red, but on defense the opponent's touchdown is the red one and the
// turnover — a Packers takeaway — the green one (the defense bar borrowed the offense's colors
// until Oct 2026 and painted opponents' TDs Packers green).
const END_COLORS = {
  offense: { TD: theme.green, FG: theme.gold, Punt: '#d8d0bf', Turnover: theme.red, Other: '#b3aa97' },
  defense: { TD: theme.red, FG: theme.gold, Punt: '#d8d0bf', Turnover: theme.green, Other: '#b3aa97' },
}
const END_LABELS = { offense: {}, defense: { Turnover: 'Takeaway', TD: 'Opp. TD', FG: 'Opp. FG' } }
const fmtStart = (v) => (v == null ? '—' : v <= 50 ? `Own ${v}` : `Opp ${100 - v}`)

function SideBlock({ label, sub, s, side }) {
  const colors = END_COLORS[side]
  if (!s) return null
  const figures = [
    { value: s.pointsPerDrive.toFixed(2), label: 'Points per drive' },
    { value: `${Math.round(s.threeOutPct)}%`, label: 'Three-and-outs' },
    { value: fmtStart(s.avgStart), label: 'Avg starting spot' },
  ]
  const total = Object.values(s.ends).reduce((x, y) => x + y, 0) || 1
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>{label}</span>
        <span style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>{sub} · {s.drives} drives</span>
      </div>
      <Figures items={figures} size="sm" />
      {/* How the drives end — one bar, share by outcome. */}
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 14 }} aria-hidden="true">
        {Object.entries(s.ends).map(([k, n]) => n > 0 && (
          <div key={k} style={{ width: `${(n / total) * 100}%`, background: colors[k] }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
        {Object.entries(s.ends).map(([k, n]) => n > 0 && (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: colors[k], flexShrink: 0 }} />
            {END_LABELS[side][k] || k} {Math.round((n / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  )
}

export default function DriveDNA() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    fetchSeasonSummaries().then(({ season, entries }) => {
      if (!alive || !entries.length) return
      const dna = driveDNA(entries)
      if (dna.offense || dna.defense) setData({ season, games: entries.length, ...dna })
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!data) return null

  return (
    <Section kicker="Possession by possession" title="Drive DNA">
      <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 2px', maxWidth: 620, lineHeight: 1.5 }}>
        Every drive of the season, reduced to its shape — how possessions start, how often they
        stall, and how they end. The defense reads the same way: opponents' drives against
        Green Bay.
      </p>
      <SideBlock label="The offense" sub="Packers drives" s={data.offense} side="offense" />
      <SideBlock label="The defense" sub="Opponents' drives vs Green Bay" s={data.defense} side="defense" />
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 14 }}>
        {data.season < SEASON ? `Final ${data.season}` : 'Season to date'} · {data.games} game{data.games === 1 ? '' : 's'} ·
        clock-kill possessions excluded · computed from the play-by-play.
      </div>
    </Section>
  )
}
