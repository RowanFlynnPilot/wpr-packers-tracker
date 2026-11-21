import { theme } from '../theme.js'
import { TEAM_ID, SEASON, CONFERENCE, DIVISION_NAME } from '../config.js'
import { conferenceTeams, simulate, openRace, oddsText, CLINCH } from '../playoffSim.js'

// The Season tab's door to the Playoff race tab: one slim row carrying the headline number
// (the same odds the dials print — same table, same seed) and the seed, with a button through.
// In season only; reads the standings bundle App already holds, so it costs no request.
export default function RaceDoor({ bundle, onOpen }) {
  if (!bundle || bundle.season !== SEASON) return null
  const me = bundle.league.find((r) => r.id === TEAM_ID)
  const teams = conferenceTeams(bundle.league)
  if (!me || !teams) return null
  const race = openRace(me.clincher)
  const odds = race ? simulate(teams)[race] : null
  const line = me.clincher === 'e' ? 'Eliminated from playoff contention'
    : [
        race === 'postseason' ? `${oddsText(odds)} to make the playoffs` : CLINCH[me.clincher]?.badge,
        race === 'division' ? `${oddsText(odds)} to win the ${DIVISION_NAME}` : null,
        me.seed ? (me.seed <= 7 ? `No. ${me.seed} seed in the ${CONFERENCE} today` : `No. ${me.seed} in the ${CONFERENCE} today`) : null,
      ].filter(Boolean).join(' · ')
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 14px', borderTop: `1px solid ${theme.rule}`, padding: '16px 0' }}>
      <div>
        <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>The playoff race</div>
        <div style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink, marginTop: 2 }}>{line}</div>
        <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 2 }}>The picture, the odds, who to root for, and your own path through the schedule.</div>
      </div>
      <button type="button" onClick={onOpen} className="link-hover"
        style={{ cursor: 'pointer', background: theme.green, color: '#fff', border: 'none', borderRadius: 18, padding: '9px 16px', fontFamily: theme.sans, fontSize: 13, fontWeight: 700 }}>
        Open the playoff race
      </button>
    </div>
  )
}
