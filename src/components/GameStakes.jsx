import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { SEASON, DIVISION, DIVISION_NAME } from '../config.js'
import { fetchStandings, fetchStatsSeason } from '../api.js'
import { conferenceTeams, gameStakes, oddsText, SIMS } from '../playoffSim.js'

// "What's at stake" on the pregame hero: the house playoff model run with the coming game as a
// win and as a loss — "This game is worth 27 points of playoff odds" — the NYT/538 stakes line.
// Regular season only (a playoff game's stakes are simply "win or go home"), and only once the
// season has results, the same gate as the playoff dials (a preseason sim is a coin flip). A
// game that barely moves the odds (clinched, eliminated, or a 1-point nudge) shows nothing.
// Fail-soft: any error and the block isn't there.
const MIN_SWING = 2

export default function GameStakes({ game, narrow }) {
  const [stakes, setStakes] = useState(null)

  useEffect(() => {
    setStakes(null)
    if (!game || game.state !== 'pre' || game.seasonType !== 2) return
    let alive = true
    ;(async () => {
      if (await fetchStatsSeason() !== SEASON) return
      const teams = conferenceTeams(await fetchStandings(SEASON))
      if (alive && teams) setStakes(gameStakes(teams, game.oppId))
    })().catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id + state pin the run
  }, [game?.id, game?.state])

  if (!stakes) return null
  const { now, win, loss } = stakes
  const swing = win.postseason - loss.postseason
  if (swing < MIN_SWING) return null
  const rival = !!DIVISION[game.oppId]
  const divSwing = win.division - loss.division

  const figure = (label, value, delta, color) => (
    <div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700 }}>{label}</div>
      <div style={{ fontFamily: theme.serif, fontSize: narrow ? 32 : 38, lineHeight: 1.05, color, marginTop: 2 }}>{oddsText(value)}</div>
      <div style={{ fontFamily: theme.sans, fontSize: 12, color, fontWeight: 700 }}>
        {delta === 0 ? 'no change' : `${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}`}
      </div>
    </div>
  )
  const pos = (v) => `${Math.min(99.5, Math.max(0.5, v))}%`

  return (
    <div style={{ maxWidth: 440, margin: '4px auto 20px', paddingTop: 16, borderTop: `1px solid ${theme.rule}` }}>
      <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>What's at stake</div>
      <div style={{ fontFamily: theme.serif, fontSize: narrow ? 17 : 19, color: theme.ink, lineHeight: 1.3, margin: '5px 0 12px', textWrap: 'balance' }}>
        This game is worth <strong style={{ color: theme.green }}>{swing} points</strong> of playoff odds.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {figure('With a win', win.postseason, win.postseason - now.postseason, theme.green)}
        {figure('With a loss', loss.postseason, loss.postseason - now.postseason, theme.red)}
      </div>
      {/* The swing on a 0–100 track: loss end in red, win end in green, today's odds ticked. */}
      <div aria-hidden="true" style={{ position: 'relative', height: 8, borderRadius: 4, background: theme.rule, margin: '14px 0 4px' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: pos(loss.postseason), width: `calc(${pos(now.postseason)} - ${pos(loss.postseason)})`, background: theme.red, opacity: 0.55, borderRadius: '4px 0 0 4px' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: pos(now.postseason), width: `calc(${pos(win.postseason)} - ${pos(now.postseason)})`, background: theme.green, borderRadius: '0 4px 4px 0' }} />
        <div style={{ position: 'absolute', top: -4, bottom: -4, left: pos(now.postseason), width: 2, marginLeft: -1, background: theme.ink }} />
      </div>
      <div style={{ position: 'relative', height: 16, fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>
        <span style={{ position: 'absolute', left: pos(now.postseason), transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>Today {oddsText(now.postseason)}</span>
      </div>
      {rival && divSwing >= MIN_SWING && (
        <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.ink, marginTop: 8 }}>
          {DIVISION_NAME} title odds: <strong style={{ color: theme.green }}>{oddsText(win.division)}</strong> with a win,{' '}
          <strong style={{ color: theme.red }}>{oddsText(loss.division)}</strong> with a loss.
        </div>
      )}
      <div style={{ fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 8 }}>
        Our house model — {SIMS.toLocaleString()} simulations of the rest of the season, run in your browser.
      </div>
    </div>
  )
}
