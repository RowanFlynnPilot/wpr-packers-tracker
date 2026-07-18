import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { SEASON } from '../config.js'
import { fetchSeasonSummaries } from '../api.js'
import { driveDNA } from '../games.js'
import Section from './Section.jsx'

// "Drive DNA" — the season, possession by possession: points per drive, three-and-out rate,
// average starting field position, and a how-drives-end bar, for the offense AND the defense
// (opponents' drives against Green Bay). Zero new network: it reads the same cached summaries
// the film room and chunk board already pulled. Owns its Section; fail-soft.
const END_COLORS = { TD: theme.green, FG: theme.gold, Punt: '#d8d0bf', Turnover: theme.red, Other: '#b3aa97' }
const fmtStart = (v) => (v == null ? '—' : v <= 50 ? `Own ${v}` : `Opp ${100 - v}`)

function SideBlock({ label, sub, s }) {
  if (!s) return null
  const tiles = [
    [s.pointsPerDrive.toFixed(2), 'Points per drive'],
    [`${Math.round(s.threeOutPct)}%`, 'Three-and-outs'],
    [fmtStart(s.avgStart), 'Avg starting spot'],
  ]
  const total = Object.values(s.ends).reduce((x, y) => x + y, 0) || 1
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>{label}</span>
        <span style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>{sub} · {s.drives} drives</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        {tiles.map(([v, l]) => (
          <div key={l} style={{ flex: '1 1 110px', minWidth: 104, border: `1px solid ${theme.rule}`, borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontFamily: theme.serif, fontSize: 24, color: theme.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
            <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.muted, marginTop: 6 }}>{l}</div>
          </div>
        ))}
      </div>
      {/* How the drives end — one bar, share by outcome. */}
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden' }} aria-hidden="true">
        {Object.entries(s.ends).map(([k, n]) => n > 0 && (
          <div key={k} style={{ width: `${(n / total) * 100}%`, background: END_COLORS[k] }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
        {Object.entries(s.ends).map(([k, n]) => n > 0 && (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: END_COLORS[k], flexShrink: 0 }} />
            {k} {Math.round((n / total) * 100)}%
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
      <SideBlock label="The offense" sub="Packers drives" s={data.offense} />
      <SideBlock label="The defense" sub="Opponents' drives vs Green Bay" s={data.defense} />
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 14 }}>
        {data.season < SEASON ? `Final ${data.season}` : 'Season to date'} · {data.games} games ·
        clock-kill possessions excluded · computed from the play-by-play.
      </div>
    </Section>
  )
}
