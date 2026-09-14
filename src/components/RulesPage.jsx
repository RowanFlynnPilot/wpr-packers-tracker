import { theme } from '../theme.js'
import { CONTEST, SPONSORS, SEASON, WPR_EMBED_URL, WPR_URL } from '../config.js'
import Masthead from './Masthead.jsx'

// The contest's official rules, generated from CONTEST (config.js) so the prize, eligibility
// and contact live in one place. A DRAFT until WPR and counsel sign off (`rulesApproved`) —
// the ribbon says so out loud rather than letting a placeholder pass for policy.

const h = { fontFamily: theme.serif, fontSize: 20, color: theme.ink, margin: '28px 0 8px', lineHeight: 1.2 }
const p = { fontFamily: theme.sans, fontSize: 14.5, color: theme.ink, lineHeight: 1.65, margin: '0 0 10px' }

export default function RulesPage() {
  const sponsor = SPONSORS.pickem
  return (
    <div style={{ background: theme.paper, color: theme.ink, minHeight: '100vh' }}>
      {!CONTEST.rulesApproved && (
        <div style={{ background: theme.gold, color: theme.green, fontFamily: theme.sans, fontSize: 11.5, fontWeight: 700, textAlign: 'center', padding: '7px 14px' }}>
          Draft — these rules are pending review by Wausau Pilot &amp; Review before the contest opens.
        </div>
      )}
      <Masthead />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>The Packers pick’em · {SEASON}</div>
        <h1 style={{ fontFamily: theme.serif, fontSize: 34, lineHeight: 1.1, margin: '6px 0 0', color: theme.ink, fontWeight: 600 }}>Official rules</h1>
        <p style={{ ...p, color: theme.muted, marginTop: 10 }}>
          No purchase necessary. A purchase will not increase your chances of winning. Void where prohibited.
        </p>

        <h2 style={h}>1. The contest</h2>
        <p style={p}>
          The Packers pick’em (the “Contest”) is run by Wausau Pilot &amp; Review (the “Sponsor”){sponsor ? <>, presented by {sponsor.name}</> : null}.
          Each week of the {SEASON} NFL regular season, entrants pick the winner of every scheduled game and call the total points in the
          Green Bay Packers game (or, on a Packers bye, the week’s final game) as a tiebreaker. Picks are made on the Packers tracker at{' '}
          <a href={WPR_EMBED_URL} style={{ color: theme.green }}>{WPR_EMBED_URL.replace(/^https?:\/\//, '')}</a>.
        </p>

        <h2 style={h}>2. Eligibility</h2>
        <p style={p}>
          {CONTEST.eligibility} Employees of the Sponsor{sponsor ? ` and ${sponsor.name}` : ''}, and members of their immediate households, are not eligible.
          One entry per person; entries are tied to an email address, and duplicate entries for the same person may be disqualified.
        </p>

        <h2 style={h}>3. How to enter</h2>
        <p style={p}>
          Entry is free. Provide your first and last name, an email address and a four-digit PIN on the tracker’s Pick’em tab (ZIP code
          optional). Your PIN, with your email, lets you pick up your entry on another device — keep it to yourself. The Contest opens with
          the {SEASON} regular-season schedule and closes after the final regular-season game.
        </p>

        <h2 style={h}>4. Making picks</h2>
        <p style={p}>
          Each game locks at its scheduled kickoff; picks and tiebreakers can be changed any number of times before then and never after.
          A game with no pick scores nothing. A tie game counts as an incorrect pick. If a game is postponed beyond its week, it is not
          scored. Game times, results and scores are as reported by the official NFL scoreboard data the tracker uses (via ESPN); in any
          dispute, the Sponsor’s records control.
        </p>

        <h2 style={h}>5. Prizes</h2>
        <p style={p}>
          <strong>Weekly:</strong> {CONTEST.prizes.weekly} to the entrant with the most correct picks that week.{' '}
          <strong>Season:</strong> {CONTEST.prizes.season} to the entrant with the most correct picks across the regular season.
          Prizes are not transferable or redeemable for cash except at the Sponsor’s discretion; the Sponsor may substitute a prize of
          equal or greater value. Winners are responsible for any taxes.
        </p>

        <h2 style={h}>6. How winners are determined</h2>
        <p style={p}>
          Weekly: most correct picks; ties are broken by the tiebreaker closest to the actual total points in the tiebreaker game, then
          the earlier entry, then a random drawing among those still tied. Season: most correct picks across all weeks; ties are broken by
          the fewest total points off across the season’s tiebreakers, then the earlier entry, then a random drawing. The Sponsor verifies
          each potential winner’s entry and eligibility before awarding a prize.
        </p>

        <h2 style={h}>7. Notification</h2>
        <p style={p}>
          Potential winners are notified at the email address on their entry within three days of the week’s (or season’s) final game and
          have seven days to respond and confirm eligibility. An unclaimed prize, a bounced email or an ineligible entrant passes the prize
          to the next-ranked entrant.
        </p>

        <h2 style={h}>8. Privacy</h2>
        <p style={p}>
          The Sponsor collects your name, email address and, if you provide it, ZIP code to run the Contest and contact winners. Your name
          appears on the public leaderboard as first name and last initial. The Sponsor will not sell your information.
          {sponsor ? ` Entrant information may be shared with ${sponsor.name} only as needed to award prizes.` : ''}
        </p>

        <h2 style={h}>9. General</h2>
        <p style={p}>
          By entering you agree to these rules and to the Sponsor’s decisions, which are final. The Sponsor may disqualify an entrant who
          tampers with the Contest, and may suspend, modify or cancel the Contest if it cannot run as planned. This Contest is not
          sponsored, endorsed or administered by, or associated with, the National Football League, the Green Bay Packers or ESPN.
        </p>

        <h2 style={h}>10. Contact</h2>
        <p style={p}>
          Questions about the Contest: <a href={`mailto:${CONTEST.contact}`} style={{ color: theme.green }}>{CONTEST.contact}</a> ·{' '}
          <a href={WPR_URL} style={{ color: theme.green }}>Wausau Pilot &amp; Review</a>.
        </p>
      </div>
    </div>
  )
}
