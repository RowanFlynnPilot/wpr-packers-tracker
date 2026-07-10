import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { theme } from '../theme.js'

// Win-probability chart for one game: the Packers' chance of winning after every play, with the
// biggest swing called out under the chart. Pure presentation — the film room hands it the
// points derived in games.js gameFlow().
export default function GameFlow({ flow, oppName }) {
  if (!flow || flow.points.length < 10) return null
  const { points, biggest } = flow

  return (
    <div>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={theme.rule} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="i" tick={false} stroke={theme.rule} label={{ value: 'Game time →', position: 'insideBottom', fontFamily: theme.sans, fontSize: 10, fill: theme.muted }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontFamily: theme.sans, fontSize: 10, fill: theme.muted }} stroke={theme.rule} />
            <ReferenceLine y={50} stroke={theme.muted} strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ fontFamily: theme.sans, fontSize: 12, border: `1px solid ${theme.rule}`, background: theme.paper }}
              formatter={(v) => [`${v}%`, 'Packers win probability']}
              labelFormatter={() => ''}
            />
            <Line type="monotone" dataKey="wp" stroke={theme.green} strokeWidth={2.5} dot={(p) => p.payload.scoring
              ? <circle key={p.payload.i} cx={p.cx} cy={p.cy} r={3.5} fill={theme.gold} stroke={theme.green} strokeWidth={1} />
              : null} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 2 }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: theme.gold, border: `1px solid ${theme.green}`, marginRight: 5 }} />scoring plays</span>
        <span>100 = a sure Packers win</span>
      </div>
      {biggest?.text && (
        <div style={{ marginTop: 14, border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 6, background: theme.wash, padding: '11px 14px' }}>
          <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>
            The turning point{biggest.period ? ` · Q${biggest.period} ${biggest.clock || ''}` : ''}
          </div>
          <div style={{ fontFamily: theme.serif, fontSize: 15, color: theme.ink, lineHeight: 1.45, marginTop: 4 }}>
            {biggest.text} <span style={{ color: theme.muted, fontFamily: theme.sans, fontSize: 12 }}>(+{Math.round(biggest.delta)}% vs the {oppName})</span>
          </div>
        </div>
      )}
    </div>
  )
}
