import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, FRANCHISE_BEST, SEASON, DIVISION_NAME, CONFERENCE } from '../config.js'
import { paceWins } from '../games.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { Loading, ErrorState } from './Status.jsx'

const DASH = '–'

// Marquee numbers tick up on their first paint (once per session — refreshes and tab returns
// render static). Every digit group in the string animates 0 → value with an ease-out curve;
// prefers-reduced-motion renders the final value immediately.
let pulseAnimated = false
function CountUp({ text, animate }) {
  const [display, setDisplay] = useState(() => (animate ? text.replace(/\d+/g, '0') : text))
  useEffect(() => {
    if (!animate) { setDisplay(text); return }
    const t0 = performance.now()
    let raf
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 700)
      const e = 1 - Math.pow(1 - p, 3)
      setDisplay(text.replace(/\d+/g, (m) => String(Math.round(Number(m) * e))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [text, animate])
  return display
}
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
const effW = (t) => t.wins + t.ties / 2
const effL = (t) => t.losses + t.ties / 2
const gb = (leader, team) => ((effW(leader) - effW(team)) + (effL(team) - effL(leader))) / 2

// Receives the shared standings bundle from App (one fetch feeds Pulse + Standings); lastGame
// and opener are derived in App. Phase-aware: before Week 1 the tiles read last season's final
// figures (labeled), with a kickoff countdown chip; in season it's the live pulse.
export default function Pulse({ bundle, lastGame, opener, error }) {
  const narrow = useIsNarrow()
  const animate = !pulseAnimated && typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => { if (bundle) pulseAnimated = true }, [bundle])
  if (!bundle) return error ? <ErrorState /> : <Loading />

  const { standings, ranks, season } = bundle
  const offseason = season < SEASON
  const me = standings.find((t) => t.id === TEAM_ID)
  if (!me) return <ErrorState />
  const rank = standings.findIndex((t) => t.id === TEAM_ID) + 1
  const lead = rank === 1 && standings[1] ? gb(me, standings[1]) : standings[0] ? gb(standings[0], me) : null
  const rec = (t) => `${t.wins}${DASH}${t.losses}${t.ties ? `${DASH}${t.ties}` : ''}`

  // Marquee stats — boxed stat tiles. Point diff / streak / lead are color-coded (green good, red bad).
  const cell = (value, label, color = theme.ink) => (
    <div key={label} style={{ flex: '1 1 120px', minWidth: 104, border: `1px solid ${theme.rule}`, borderRadius: 8, padding: narrow ? '12px 13px' : '14px 16px' }}>
      <div style={{ fontFamily: theme.serif, fontSize: narrow ? 28 : 34, color, lineHeight: 1 }}><CountUp text={String(value)} animate={animate} /></div>
      <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, marginTop: 8 }}>{label}</div>
    </div>
  )
  const pd = me.pointDiff
  const pdColor = pd > 0 ? theme.green : pd < 0 ? theme.red : theme.ink
  const sc = me.streak || ''
  const streakColor = sc[0] === 'W' ? theme.green : sc[0] === 'L' ? theme.red : theme.ink
  const leadColor = rank === 1 ? theme.green : theme.ink

  const tiles = offseason
    ? [
        cell(rec(me), `${season} record`),
        cell(ord(rank), `In the ${DIVISION_NAME}`, rank === 1 ? theme.green : theme.ink),
        cell(`${pd > 0 ? '+' : ''}${pd}`, 'Point diff', pdColor),
        me.homeRecord ? cell(me.homeRecord, 'At Lambeau') : null,
        me.roadRecord ? cell(me.roadRecord, 'On the road') : null,
      ]
    : [
        cell(rec(me), 'Record'),
        cell(rank === 1 ? `+${lead}` : Number.isFinite(lead) ? `${lead}` : DASH, rank === 1 ? `${DIVISION_NAME} lead` : 'Games back', leadColor),
        cell(`${pd > 0 ? '+' : ''}${pd}`, 'Point diff', pdColor),
        cell(sc || DASH, 'Streak', streakColor),
        me.divRecord ? cell(me.divRecord, 'In the division') : null,
      ]

  // Secondary chips — a compact strip below the marquee numbers.
  const minis = []
  if (!offseason && me.seed && me.seed <= 7) minis.push([ord(me.seed), `${CONFERENCE} playoff seed`])
  if (ranks) minis.push([ord(ranks.pointsFor.rank), 'In NFL scoring'])
  if (ranks) minis.push([ord(ranks.pointsAgainst.rank), 'In points allowed'])
  if (!offseason && me.homeRecord) minis.push([me.homeRecord, 'At Lambeau'])
  if (!offseason && me.roadRecord) minis.push([me.roadRecord, 'Road'])
  if (offseason && me.divRecord) minis.push([me.divRecord, 'In the division'])

  // Kickoff countdown chip while we wait on the new season.
  const daysToKickoff = opener ? Math.ceil((new Date(opener.date) - Date.now()) / 86400000) : null

  // Pace vs the franchise-best season — Wisconsin-pride bait when the club is rolling.
  const pace = offseason ? null : paceWins(me)
  const best = FRANCHISE_BEST

  return (
    <div>
      {offseason && daysToKickoff > 0 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: theme.green, borderRadius: 14, padding: '4px 12px', marginBottom: 16 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: theme.gold }} />
          <span style={{ fontFamily: theme.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#fff', textTransform: 'uppercase' }}>
            {daysToKickoff === 1 ? 'The season kicks off tomorrow' : `${daysToKickoff} days to the ${SEASON} kickoff`}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{tiles.filter(Boolean)}</div>

      {minis.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 18 }}>
          {minis.map(([v, k]) => (
            <span key={k} style={{ display: 'inline-flex', borderRadius: 5, overflow: 'hidden', border: `1px solid ${theme.green}`, fontFamily: theme.sans, fontSize: 12, whiteSpace: 'nowrap' }}>
              <span style={{ background: theme.green, color: '#fff', fontWeight: 700, padding: '3px 9px' }}>{v}</span>
              <span style={{ background: '#fff', color: theme.ink, padding: '3px 9px' }}>{k}</span>
            </span>
          ))}
        </div>
      )}

      {!offseason && lastGame && (
        <div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginTop: 14 }}>
          <span style={{ fontWeight: 700, color: lastGame.tied ? theme.ink : lastGame.won ? theme.green : theme.red }}>{lastGame.tied ? 'T' : lastGame.won ? 'W' : 'L'}</span>
          {' '}Latest: {lastGame.tied ? 'tied' : lastGame.won ? 'beat' : 'lost to'} the {lastGame.oppName} {lastGame.won || lastGame.tied ? `${lastGame.meScore}${DASH}${lastGame.oppScore}` : `${lastGame.oppScore}${DASH}${lastGame.meScore}`} {lastGame.home ? 'at Lambeau' : 'on the road'}.
        </div>
      )}

      {offseason && (
        <div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginTop: 14, lineHeight: 1.55, maxWidth: 620 }}>
          Final {season} figures{opener ? ` — the tracker flips to the new season when the Packers open ${opener.home ? 'at Lambeau against' : 'at'} the ${opener.oppName}` : ''}.
        </div>
      )}

      {/* Pace vs the franchise-best season. */}
      {pace != null && (() => {
        const scaleMax = Math.max(17, pace + 1, best.wins + 1)
        const pct = (v) => `${(v / scaleMax) * 100}%`
        const chasing = pace >= best.wins
        return (
          <div style={{ marginTop: 18, maxWidth: 620 }}>
            <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, marginBottom: 7 }}>
              Win pace vs franchise best
            </div>
            <div style={{ position: 'relative', height: 10, borderRadius: 5, background: theme.rule }}>
              <div style={{ width: pct(pace), height: '100%', borderRadius: 5, background: chasing ? theme.gold : theme.green, transition: 'width 0.6s ease' }} />
              <div style={{ position: 'absolute', left: pct(best.wins), top: -4, width: 2, height: 18, background: theme.ink }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: 11.5, marginTop: 5 }}>
              <span style={{ color: theme.green, fontWeight: 700 }}>On pace for {pace} wins{chasing ? ' — franchise-record territory' : ''}</span>
              <span style={{ color: theme.muted }}>Best: {best.wins} ({best.year})</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
