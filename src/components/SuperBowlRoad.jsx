import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { CONFERENCE, GAMES_IN_SEASON } from '../config.js'
import { fetchPowerIndex } from '../api.js'
import { useIsNarrow } from '../useIsNarrow.js'

const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
// Odds as a reader says them: whole numbers from 10% up, one decimal below, and never a flat 0.
const pct = (v) => (v < 0.1 ? '<0.1%' : v < 10 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`)

const STAGES = [
  ['playoffs', 'Make the playoffs'],
  ['divisionalRound', 'Divisional round'],
  ['conferenceGame', `${CONFERENCE} title game`],
  ['superBowl', 'Super Bowl'],
  ['title', 'Win it all'],
]

// "Road to the Super Bowl" — ESPN's Football Power Index, round by round, drawn as a funnel: each
// bar its odds on one 0–100 scale, centered, so the narrowing IS the picture. It sits inside the
// Playoff odds section, under the house model, and says plainly that it's ESPN's model —
// different method, different answer — with one line comparing the two playoff numbers.
// Fail-soft: no data, no block.
export default function SuperBowlRoad({ housePlayoffs }) {
  const [fpi, setFpi] = useState(null)
  const narrow = useIsNarrow()

  useEffect(() => {
    let alive = true
    fetchPowerIndex().then((d) => { if (alive) setFpi(d) }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!fpi) return null

  const espnPlayoffs = Math.round(fpi.playoffs)
  const gap = housePlayoffs == null ? null : espnPlayoffs - housePlayoffs
  const projW = fpi.projectedWins != null ? Math.round(fpi.projectedWins) : null

  return (
    <div style={{ maxWidth: 560, margin: '26px auto 0', paddingTop: 18, borderTop: `1px solid ${theme.rule}` }}>
      <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>
        Road to the Super Bowl
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 3 }}>
        ESPN's Football Power Index, round by round
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14 }}>
        {STAGES.map(([key, label], i) => {
          const v = fpi[key]
          const last = i === STAGES.length - 1
          return (
            <div key={key} style={{ display: 'grid', gridTemplateColumns: narrow ? '104px 1fr 46px' : '150px 1fr 56px', alignItems: 'center', gap: narrow ? 8 : 12 }}>
              <span style={{ fontFamily: theme.sans, fontSize: narrow ? 12 : 13, color: last ? theme.green : theme.ink, fontWeight: last ? 700 : 400 }}>{label}</span>
              {/* One 0–100 track per round; the bar is centered in it, so the column of bars
                  narrows like a funnel at true scale. */}
              <div aria-hidden="true" style={{ position: 'relative', height: narrow ? 16 : 20, borderRadius: 3, background: theme.wash }}>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: `${(100 - v) / 2}%`, width: `${Math.max(v, 0.8)}%`,
                  borderRadius: 3, background: last ? theme.green : theme.gold,
                }} />
              </div>
              <span style={{ fontFamily: theme.serif, fontSize: narrow ? 15 : 17, color: last ? theme.green : theme.ink, textAlign: 'right' }}>{pct(v)}</span>
            </div>
          )
        })}
      </div>

      <div style={{ fontFamily: theme.serif, fontSize: 15, color: theme.ink, lineHeight: 1.5, marginTop: 14 }}>
        {fpi.rank && <>ESPN ranks the Packers <strong>{ord(fpi.rank)}</strong> of 32{projW != null ? <> and projects about a <strong>{projW}–{GAMES_IN_SEASON - projW}</strong> finish</> : null}. </>}
        {gap != null && (Math.abs(gap) < 3
          ? <>Its playoff number matches our simulation's, about {espnPlayoffs}%.</>
          : <>Its playoff odds, {espnPlayoffs}%, run {gap < 0 ? 'below' : 'above'} our simulation's {housePlayoffs}%.</>)}
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 6, lineHeight: 1.5 }}>
        ESPN's model, not ours: it rates every team from its play and simulates the playoffs too. Our
        house model above works from the standings alone. Updated daily by ESPN.
      </div>
    </div>
  )
}
