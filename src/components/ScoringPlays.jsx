import { theme } from '../theme.js'
import { TEAM_ID } from '../config.js'
import TeamLogo from './TeamLogo.jsx'

// "How the points went up" — every scoring play in order, who scored it, and the score after.
// Pure presentation over the summary's scoringPlays.
export default function ScoringPlays({ summary, packersHome }) {
  const plays = summary?.scoringPlays || []
  if (!plays.length) return null

  return (
    <div>
      {plays.map((p, i) => {
        const ours = Number(p.team?.id) === TEAM_ID
        const meScore = packersHome ? p.homeScore : p.awayScore
        const oppScore = packersHome ? p.awayScore : p.homeScore
        return (
          <div key={p.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none' }}>
            <span style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: theme.goldText, width: 62, flexShrink: 0 }}>
              Q{p.period?.number} {p.clock?.displayValue}
            </span>
            <TeamLogo id={Number(p.team?.id)} size={20} />
            <span style={{ fontFamily: theme.sans, fontSize: 12.5, color: ours ? theme.ink : theme.muted, lineHeight: 1.4, flex: 1, minWidth: 0 }}>
              {p.text}
            </span>
            <span style={{ fontFamily: theme.serif, fontSize: 14, color: meScore > oppScore ? theme.green : theme.ink, whiteSpace: 'nowrap', fontWeight: ours ? 700 : 400 }}>
              {meScore}–{oppScore}
            </span>
          </div>
        )
      })}
      <div style={{ fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 8 }}>
        Score shown Packers-first after each play.
      </div>
    </div>
  )
}
