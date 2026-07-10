import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { theme } from '../theme.js'
import { DIVISION, DIVISION_ABBR, TEAM_COLORS, TEAM_ID, teamLogo, SEASON } from '../config.js'
import { raceByWeek } from '../games.js'
import { Loading, ErrorState } from './Status.jsx'

// The NFC North race, week by week — games back of the division lead, derived client-side from
// the four teams' schedules. Before Week 1 it replays last season's race, clearly labeled.
export default function Race({ schedules, season, error }) {
  if (!schedules) return error ? <ErrorState /> : <Loading block />
  const data = raceByWeek(schedules)
  if (!data.length) return <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>The race begins with Week 1.</div>

  // Direct labels at each line's right edge (logo + GB) replace a bottom legend — the chart
  // reads at a glance without eye travel. Label rows are nudged apart in (estimated) pixel
  // space so teams bunched together don't overlap: greedy top-down pass, 17px apart.
  const last = data[data.length - 1] || {}
  const maxGB = Math.max(1, ...data.flatMap((r) => Object.keys(DIVISION).map((id) => r[id] ?? 0)))
  const pxPerGB = 260 / maxGB // inner plot height ≈ 300 - top margin - x-axis
  const dyById = {}
  let prevY = -Infinity
  Object.keys(DIVISION)
    .map((id) => ({ id, gb: last[id] ?? 0 }))
    .sort((a, b) => a.gb - b.gb)
    .forEach(({ id, gb }) => {
      const y = gb * pxPerGB
      const ly = Math.max(y, prevY + 17)
      dyById[id] = ly - y
      prevY = ly
    })
  const endLabel = (id, isMe) => (props) => {
    const { x, y, index, value } = props
    if (index !== data.length - 1) return null
    const dy = dyById[id] || 0
    return (
      <g key={`end-${id}`}>
        <circle cx={x} cy={y} r={isMe ? 4 : 2.5} fill={TEAM_COLORS[id]} />
        <image href={teamLogo(Number(id))} x={x + 7} y={y + dy - 8} width={16} height={16} />
        <text x={x + 27} y={y + dy + 4} fontSize={11} fontFamily={theme.sans} fontWeight={isMe ? 700 : 400} fill={isMe ? theme.green : theme.muted}>
          {value === 0 ? 'leads' : value}
        </text>
      </g>
    )
  }

  return (
    <>
      <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 16px', maxWidth: 600, lineHeight: 1.5 }}>
        {season < SEASON ? `How the ${season} race unfolded — games` : 'Games'} back of the division lead, week by week.
        The line riding the top holds first place; a line dropping is a team losing ground.
      </p>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 62, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={theme.rule} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="week" tick={{ fontFamily: theme.sans, fontSize: 10, fill: theme.muted }} interval={Math.ceil(data.length / 9)} stroke={theme.rule} />
            <YAxis reversed tick={{ fontFamily: theme.sans, fontSize: 10, fill: theme.muted }} stroke={theme.rule} allowDecimals={false} />
            <ReferenceLine y={0} stroke={theme.ink} strokeWidth={1} />
            <Tooltip contentStyle={{ fontFamily: theme.sans, fontSize: 12, border: `1px solid ${theme.rule}`, background: theme.paper }} formatter={(v, n, item) => [v === 0 ? 'leads' : `${v} GB`, DIVISION_ABBR[item?.dataKey] || n]} />
            {/* Draw rivals first (muted), then the Packers on top (bold green). */}
            {Object.keys(DIVISION)
              .sort((a, b) => (Number(a) === TEAM_ID ? 1 : 0) - (Number(b) === TEAM_ID ? 1 : 0))
              .map((id) => {
                const isMe = Number(id) === TEAM_ID
                return (
                  <Line key={id} type="monotone" dataKey={id} name={DIVISION[id]} stroke={TEAM_COLORS[id]} strokeWidth={isMe ? 3 : 1.5} strokeOpacity={isMe ? 1 : 0.55} dot={false} isAnimationActive={false} label={endLabel(id, isMe)} />
                )
              })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
