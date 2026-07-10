import { theme } from '../theme.js'

// "The chunk plays" — the Packers' 20+ yard gains in a game, biggest first. Pure presentation
// over games.js bigPlays().
export default function BigPlays({ plays }) {
  if (!plays?.length) return null
  const max = plays[0].yards

  return (
    <div>
      {plays.slice(0, 8).map((p, i) => (
        <div key={p.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none' }}>
          <span style={{ fontFamily: theme.serif, fontSize: 20, color: p.scoring ? theme.green : theme.ink, width: 46, flexShrink: 0, textAlign: 'right', fontWeight: p.scoring ? 700 : 400 }}>
            {p.yards}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: 6, borderRadius: 3, background: theme.wash, overflow: 'hidden', marginBottom: 4, maxWidth: 220 }}>
              <div style={{ width: `${(p.yards / max) * 100}%`, height: '100%', borderRadius: 3, background: p.scoring ? theme.gold : theme.green }} />
            </div>
            <span style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
              <span style={{ color: theme.goldText, fontWeight: 700, fontSize: 10 }}>Q{p.period} {p.clock}</span>{' '}
              {p.text}{p.scoring ? ' · TD' : ''}
            </span>
          </div>
        </div>
      ))}
      <div style={{ fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 8 }}>
        Packers gains of 20+ yards · gold bars scored.
      </div>
    </div>
  )
}
