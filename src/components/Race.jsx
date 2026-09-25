import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { DIVISION, DIVISION_NAME, TEAM_COLORS, TEAM_ID, teamLogo, SEASON } from '../config.js'
import { raceByWeek } from '../games.js'
import { Loading, ErrorState } from './Status.jsx'

// The NFC North race, week by week — games back of the division lead, derived client-side from
// the four teams' schedules. Before Week 1 it replays last season's race, clearly labeled.
//
// Drawn in plain SVG. It used to be a recharts LineChart, and recharts is 105 KB gzipped — half
// the JavaScript the default Season tab shipped, for one four-line chart. The film room's
// win-probability chart still uses recharts; this tab no longer loads it at all.

const H = 300
const PAD = { top: 10, right: 62, bottom: 26, left: 28 }
const IDS = Object.keys(DIVISION)
const r1 = (v) => Math.round(v * 10) / 10

// Monotone cubic interpolation — Steffen's method, the same curve as d3's curveMonotoneX (which
// is what the recharts version drew): smooth through every point, never overshooting one, so a
// team can't appear to dip below first place between two weeks it led.
function monotonePath(pts) {
  const n = pts.length
  if (n < 2) return ''
  if (n === 2) return `M${r1(pts[0].x)},${r1(pts[0].y)}L${r1(pts[1].x)},${r1(pts[1].y)}`
  const sign = (v) => (v < 0 ? -1 : 1)
  const s = []
  for (let i = 0; i < n - 1; i++) s.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x))
  const t = new Array(n)
  for (let i = 1; i < n - 1; i++) {
    const h0 = pts[i].x - pts[i - 1].x
    const h1 = pts[i + 1].x - pts[i].x
    const p = (s[i - 1] * h1 + s[i] * h0) / (h0 + h1)
    t[i] = (sign(s[i - 1]) + sign(s[i])) * Math.min(Math.abs(s[i - 1]), Math.abs(s[i]), 0.5 * Math.abs(p)) || 0
  }
  t[0] = (3 * s[0] - t[1]) / 2
  t[n - 1] = (3 * s[n - 2] - t[n - 2]) / 2
  let d = `M${r1(pts[0].x)},${r1(pts[0].y)}`
  for (let i = 0; i < n - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3
    d += `C${r1(pts[i].x + dx)},${r1(pts[i].y + dx * t[i])} ${r1(pts[i + 1].x - dx)},${r1(pts[i + 1].y - dx * t[i + 1])} ${r1(pts[i + 1].x)},${r1(pts[i + 1].y)}`
  }
  return d
}

const gbText = (gb) => (gb === 0 ? 'leads' : `${gb} back`)

// Week labels that fit the width: first and last always (the last is "where the race stands
// now"), the rest spaced so no two labels touch — nine across a phone overlapped.
function weekTicks(n, plotW) {
  if (n === 1) return [0]
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 46))))
  const ticks = []
  for (let i = 0; i < n; i += step) ticks.push(i)
  const last = n - 1
  if (ticks[ticks.length - 1] !== last) {
    if (last - ticks[ticks.length - 1] < step * 0.6) ticks.pop()
    ticks.push(last)
  }
  return ticks
}

function RaceChart({ data }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState(null)

  // Draw at the container's real pixel width (text stays 10–11px on a phone; a scaled viewBox
  // would shrink it).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = data.length
  const last = data[n - 1]
  const maxGB = Math.max(1, ...data.flatMap((r) => IDS.map((id) => r[id] ?? 0)))
  const yTop = Math.max(2, Math.ceil(maxGB)) // one game back shouldn't draw a 0–4 axis
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = H - PAD.top - PAD.bottom
  const x = (i) => (n === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (n - 1)) * plotW)
  const y = (gb) => PAD.top + (gb / yTop) * plotH
  const yStep = yTop > 8 ? 2 : 1
  const yTicks = []
  for (let v = 0; v <= yTop; v += yStep) yTicks.push(v)

  // Direct labels at each line's right edge (logo + GB) instead of a legend — nudged apart so
  // teams bunched together don't overlap: greedy top-down pass, 17px apart.
  const labelY = {}
  let prevY = -Infinity
  IDS.map((id) => ({ id, gb: last[id] ?? 0 }))
    .sort((a, b) => a.gb - b.gb)
    .forEach(({ id, gb }) => {
      const ly = Math.max(y(gb), prevY + 17)
      labelY[id] = ly
      prevY = ly
    })

  // Rivals first (muted), then the Packers on top (bold green).
  const order = [...IDS].sort((a, b) => (Number(a) === TEAM_ID ? 1 : 0) - (Number(b) === TEAM_ID ? 1 : 0))

  // Screen readers get the standings the picture shows, in words.
  const summary = `Games back of the ${DIVISION_NAME} lead, week by week, through ${last.week}. Now: ` +
    IDS.map((id) => ({ id, gb: last[id] ?? 0 })).sort((a, b) => a.gb - b.gb)
      .map(({ id, gb }) => `${DIVISION[id]} ${gb === 0 ? 'lead' : `${gb} back`}`).join(', ') + '.'

  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - box.left
    let best = 0
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
    setHover(best)
  }
  const hv = hover != null && hover < n ? hover : null
  const flip = hv != null && x(hv) > width - 170

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: H }}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={summary}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)}
          style={{ display: 'block', touchAction: 'pan-y', overflow: 'visible' }}>
          {/* hit area, so the empty plot answers the pointer too */}
          <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="transparent" />

          {yTicks.map((v) => (
            <g key={v}>
              {v > 0 && <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke={theme.rule} strokeDasharray="2 4" />}
              <text x={PAD.left - 8} y={y(v) + 3.5} textAnchor="end" fontFamily={theme.sans} fontSize={10} fill={theme.muted}>{v}</text>
            </g>
          ))}
          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} stroke={theme.rule} />
          <line x1={PAD.left} x2={PAD.left + plotW} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke={theme.rule} />
          {/* first place */}
          <line x1={PAD.left} x2={PAD.left + plotW} y1={y(0)} y2={y(0)} stroke={theme.ink} strokeWidth={1} />

          {weekTicks(n, plotW).map((i) => (
            <text key={i} x={x(i)} y={PAD.top + plotH + 16} textAnchor="middle" fontFamily={theme.sans} fontSize={10} fill={theme.muted}>{data[i].week}</text>
          ))}

          {hv != null && <line x1={x(hv)} x2={x(hv)} y1={PAD.top} y2={PAD.top + plotH} stroke="#c9c1af" />}

          {order.map((id) => {
            const isMe = Number(id) === TEAM_ID
            const pts = data.map((row, i) => ({ x: x(i), y: y(row[id] ?? 0) }))
            return n > 1
              ? <path key={id} d={monotonePath(pts)} fill="none" stroke={TEAM_COLORS[id]} strokeWidth={isMe ? 3 : 1.5} strokeOpacity={isMe ? 1 : 0.55} strokeLinejoin="round" strokeLinecap="round" />
              // A line needs two points — with only Week 1 in the books, dots instead.
              : <circle key={id} cx={pts[0].x} cy={pts[0].y} r={4} fill={TEAM_COLORS[id]} />
          })}

          {hv != null && order.map((id) => (
            <circle key={`hv-${id}`} cx={x(hv)} cy={y(data[hv][id] ?? 0)} r={Number(id) === TEAM_ID ? 4.5 : 3.5} fill={TEAM_COLORS[id]} stroke="#fff" strokeWidth={1.5} />
          ))}

          {order.map((id) => {
            const isMe = Number(id) === TEAM_ID
            const gb = last[id] ?? 0
            const cx = x(n - 1)
            return (
              <g key={`end-${id}`}>
                {n > 1 && <circle cx={cx} cy={y(gb)} r={isMe ? 4 : 2.5} fill={TEAM_COLORS[id]} />}
                <image href={teamLogo(Number(id))} x={cx + 7} y={labelY[id] - 8} width={16} height={16} />
                <text x={cx + 27} y={labelY[id] + 4} fontFamily={theme.sans} fontSize={11} fontWeight={isMe ? 700 : 400} fill={isMe ? theme.green : theme.muted}>
                  {gb === 0 ? 'leads' : gb}
                </text>
              </g>
            )
          })}
        </svg>
      )}

      {hv != null && (
        <div aria-hidden="true" style={{
          position: 'absolute', top: 6, left: x(hv), transform: flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
          pointerEvents: 'none', background: theme.paper, border: `1px solid ${theme.rule}`, borderRadius: 6,
          padding: '7px 10px', boxShadow: '0 4px 12px rgba(32, 55, 49, 0.10)', fontFamily: theme.sans, fontSize: 12, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 700, color: theme.ink, marginBottom: 4 }}>{data[hv].week}</div>
          {IDS.map((id) => ({ id, gb: data[hv][id] ?? 0 })).sort((a, b) => a.gb - b.gb).map(({ id, gb }) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 7, lineHeight: 1.6, color: Number(id) === TEAM_ID ? theme.green : theme.ink, fontWeight: Number(id) === TEAM_ID ? 700 : 400 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: TEAM_COLORS[id], flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{DIVISION[id]}</span>
              <span style={{ color: theme.muted, fontWeight: 400, marginLeft: 10 }}>{gbText(gb)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Race({ schedules, season, error }) {
  if (!schedules) return error ? <ErrorState /> : <Loading block />
  const data = raceByWeek(schedules)
  if (!data.length) return <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>The race begins with Week 1.</div>

  return (
    <>
      <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 16px', maxWidth: 600, lineHeight: 1.5 }}>
        {season < SEASON ? `How the ${season} race unfolded — games` : 'Games'} back of the division lead, week by week.
        The line riding the top holds first place; a line dropping is a team losing ground.
      </p>
      <RaceChart data={data} />
    </>
  )
}
