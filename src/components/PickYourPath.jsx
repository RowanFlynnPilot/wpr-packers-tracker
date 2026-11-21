import { useEffect, useMemo, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SEASON, DIVISION_NAME, GAMES_IN_SEASON, TEAM_NAMES, TEAM_ABBRS, WPR_EMBED_URL } from '../config.js'
import { fetchStandings, fetchStatsSeason, fetchSeasonGames } from '../api.js'
import { conferenceTeams, simulate, simulatePath, openRace, oddsText, SIMS } from '../playoffSim.js'
import { track } from '../analytics.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Section from './Section.jsx'
import TeamLogo from './TeamLogo.jsx'

// "Pick your path": the reader calls any of the Packers' remaining games a win or a loss and the
// house model answers with the odds on that path (playoffSim.js simulatePath — same seed as the
// dials, so an empty path IS the dials' number and each tap moves the odds by the result alone).
// Under it, "what record gets them in": how often each final record made the field across the
// simulations. A path travels as `?path=12w13l14w` (week + result), read once on load; games
// already played simply drop out of it. Measures the playoff spot until it's clinched, then the
// division (openRace); sits out before Week 1, once both are settled, and when no regular-season
// games remain. Owns its Section; fail-soft.
// A game the league hasn't timed yet (Week 18) has a placeholder date too — say so, don't print it.
const fmtDay = (g) => (g.timeValid ? new Date(g.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'date TBD')
const MIN_SHARE = 0.01 // a final record seen in under 1% of simulations is too thin to quote

// `?path=12w13l` → { 12: 'W', 13: 'L' }
function readPath() {
  const out = {}
  const raw = new URLSearchParams(window.location.search).get('path') || ''
  for (const m of raw.matchAll(/(\d{1,2})([wl])/gi)) out[Number(m[1])] = m[2].toUpperCase()
  return out
}

export default function PickYourPath() {
  const [data, setData] = useState(null) // { teams, me, metric, games }
  const [picks, setPicks] = useState(readPath) // by week: 'W' | 'L'
  const [copied, setCopied] = useState(false)
  const narrow = useIsNarrow()
  const ref = useRef(null)
  const arrived = useRef(Object.keys(readPath()).length > 0) // opened from a shared path
  const tracked = useRef(false)

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (await fetchStatsSeason() !== SEASON) return
      const [rows, { games }] = await Promise.all([fetchStandings(SEASON), fetchSeasonGames()])
      const teams = conferenceTeams(rows)
      const me = rows.find((r) => r.id === TEAM_ID)
      const metric = openRace(me?.clincher)
      const left = games.filter((g) => g.seasonType === 2 && g.state === 'pre')
      if (!alive) return
      setData(teams && me && metric && left.length ? { teams, me, metric, games: left, rows } : null)
    }
    run().catch(() => {})
    const id = setInterval(() => { if (!document.hidden) run().catch(() => {}) }, 300000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  // A shared path opens on its section (standalone only — the embed has no inner scroll).
  useEffect(() => {
    if (data && arrived.current && window.self === window.top) {
      arrived.current = false
      // Twice: the sections above are still filling in when this one is ready, and push it down.
      const go = () => ref.current?.scrollIntoView({ block: 'start' })
      go()
      const t = setTimeout(go, 1500)
      return () => clearTimeout(t)
    }
  }, [data])

  const base = useMemo(() => (data ? simulate(data.teams) : null), [data])
  const chosen = data ? data.games.filter((g) => picks[g.week]) : []
  const key = chosen.map((g) => `${g.week}${picks[g.week]}`).join('')
  const path = useMemo(
    () => (data && chosen.length ? simulatePath(data.teams, chosen.map((g) => ({ oppId: g.oppId, won: picks[g.week] === 'W' }))) : base),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the picks that matter
    [data, base, key],
  )

  if (!data || !base || !path) return null
  const { me, metric, games } = data
  const race = metric === 'division' ? `${DIVISION_NAME} title odds` : 'Playoff odds'
  const now = base[metric], then = path[metric]
  const delta = then - now
  const color = delta > 0 ? theme.green : delta < 0 ? theme.red : theme.ink
  const w = me.wins + chosen.filter((g) => picks[g.week] === 'W').length
  const l = me.losses + chosen.filter((g) => picks[g.week] === 'L').length
  const open = games.length - chosen.length
  const rec = (wins, losses) => `${wins}–${losses}${me.ties ? `–${me.ties}` : ''}`
  const pos = (v) => `${Math.min(99.5, Math.max(0.5, v))}%`

  const set = (next) => {
    if (!tracked.current) { tracked.current = true; track('Path Pick') }
    setPicks(next)
  }
  const pick = (g, r) => set({ ...picks, [g.week]: picks[g.week] === r ? undefined : r })
  const all = (r) => set(Object.fromEntries(games.map((g) => [g.week, r])))

  const share = () => {
    const calls = chosen.map((g) => `${picks[g.week]} ${g.home ? 'vs' : 'at'} ${TEAM_ABBRS[g.oppId] || g.oppAbbr}`).join(', ')
    const text = `My Packers path: ${calls} — ${oddsText(then)} ${metric === 'division' ? `to win the ${DIVISION_NAME}` : 'to make the playoffs'} (today: ${oddsText(now)}).`
    const url = new URL(window.self === window.top ? window.location.href : WPR_EMBED_URL)
    url.searchParams.set('tab', 'race')
    url.searchParams.set('path', key.toLowerCase())
    track('Path Share', { games: chosen.length })
    if (navigator.share) navigator.share({ title: 'Packers tracker — Wausau Pilot & Review', text, url: url.href }).catch(() => {})
    else if (navigator.clipboard) navigator.clipboard.writeText(`${text} ${url.href}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  }

  const choice = (g, r) => {
    const on = picks[g.week] === r
    const tone = r === 'W' ? theme.green : theme.red
    return (
      <button type="button" aria-pressed={on} onClick={() => pick(g, r)}
        aria-label={`${r === 'W' ? 'Win' : 'Loss'} ${g.home ? 'against' : 'at'} the ${TEAM_NAMES[g.oppId] || g.oppName}`}
        style={{ cursor: 'pointer', width: 44, height: 36, borderRadius: 6, fontFamily: theme.sans, fontSize: 14, fontWeight: 700, border: `1.5px solid ${on ? tone : theme.rule}`, background: on ? tone : '#fff', color: on ? '#fff' : theme.muted }}>
        {r}
      </button>
    )
  }
  const textBtn = (label, onClick, disabled) => (
    <button type="button" onClick={onClick} disabled={disabled} className="link-hover"
      style={{ cursor: disabled ? 'default' : 'pointer', background: 'transparent', border: 'none', padding: '8px 2px', fontFamily: theme.sans, fontSize: 12.5, fontWeight: 700, color: disabled ? theme.rule : theme.green }}>
      {label}
    </button>
  )

  // What record gets them in — only the records the simulations actually produced often enough.
  const ladder = metric === 'postseason' ? base.byWins.filter((r) => r.share >= MIN_SHARE) : []
  const finalWins = open === 0 ? w + me.ties / 2 : null

  return (
    <div ref={ref}>
      <Section kicker="Pick your path" title="Call the rest of the season">
        <p style={{ fontFamily: theme.serif, fontSize: narrow ? 15.5 : 17, color: theme.ink, lineHeight: 1.45, margin: '-6px 0 16px', maxWidth: 620, textWrap: 'pretty' }}>
          Tap a win or a loss on any game the Packers have left and their odds answer. Games you leave alone stay up to the dice.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 1fr) minmax(0, 300px)', gap: narrow ? 14 : 24, alignItems: 'start', maxWidth: 760 }}>
          {/* The answer first on a phone: it's what changes when a reader taps. */}
          <div aria-live="polite" style={{ order: narrow ? 0 : 1, background: theme.wash, border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`, borderRadius: 8, padding: '14px 16px 14px' }}>
            <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>
              {race} {chosen.length ? 'on this path' : 'as things stand'}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
              <span style={{ fontFamily: theme.serif, fontSize: narrow ? 44 : 52, lineHeight: 1.05, color }}>{oddsText(then)}</span>
              {chosen.length > 0 && (
                <span style={{ fontFamily: theme.sans, fontSize: 12.5, fontWeight: 700, color }}>
                  {delta === 0 ? 'no change' : `${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}`} <span style={{ color: theme.muted, fontWeight: 400 }}>from {oddsText(now)}</span>
                </span>
              )}
            </div>
            <div aria-hidden="true" style={{ position: 'relative', height: 6, borderRadius: 3, background: theme.rule, margin: '10px 0 10px' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: pos(Math.min(now, then)), width: `calc(${pos(Math.max(now, then))} - ${pos(Math.min(now, then))})`, background: color, opacity: 0.7, borderRadius: 3 }} />
              <div style={{ position: 'absolute', top: -4, bottom: -4, left: pos(now), width: 2, marginLeft: -1, background: theme.ink }} />
              <div style={{ position: 'absolute', top: -3, width: 12, height: 12, marginLeft: -6, left: pos(then), borderRadius: '50%', background: color, boxShadow: `0 0 0 2px ${theme.wash}`, transition: 'left 300ms ease' }} />
            </div>
            <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.ink, lineHeight: 1.5 }}>
              {chosen.length === 0
                ? <>They’re <strong>{rec(me.wins, me.losses)}</strong> with {games.length} to play.</>
                : open === 0
                  ? <>That’s a <strong>{rec(w, l)}</strong> finish.</>
                  : <><strong>{rec(w, l)}</strong> on this path, with {open} {open === 1 ? 'game' : 'games'} left to chance.</>}
              {metric === 'postseason' && <> {DIVISION_NAME} title: <strong>{oddsText(path.division)}</strong>.</>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 16px', marginTop: 6 }}>
              {textBtn('Win out', () => all('W'))}
              {textBtn('Lose out', () => all('L'))}
              {textBtn('Clear', () => set({}), chosen.length === 0)}
              {textBtn(copied ? 'Link copied' : 'Share this path', share, chosen.length === 0)}
            </div>
          </div>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, order: narrow ? 1 : 0 }}>
            {games.map((g, i) => {
              const opp = data.rows.find((r) => r.id === g.oppId)
              return (
                <li key={g.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', columnGap: 12, padding: '9px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: theme.sans, fontSize: 14, color: theme.ink }}>
                      <span style={{ color: theme.muted }}>{g.home ? 'vs' : 'at'}</span>
                      <TeamLogo id={g.oppId} size={20} />
                      <strong>{TEAM_NAMES[g.oppId] || g.oppName}</strong>
                      {opp && <span style={{ color: theme.muted, fontSize: 12.5 }}>{opp.wins}–{opp.losses}{opp.ties ? `–${opp.ties}` : ''}</span>}
                    </div>
                    <div style={{ fontFamily: theme.sans, fontSize: 11.5, color: theme.muted, marginTop: 1 }}>
                      Wk {g.week} · {fmtDay(g)}{g.home ? ' · Lambeau' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>{choice(g, 'W')}{choice(g, 'L')}</div>
                </li>
              )
            })}
          </ul>
        </div>

        {ladder.length > 1 && (
          <div style={{ maxWidth: 560, marginTop: 22, paddingTop: 16, borderTop: `1px solid ${theme.rule}` }}>
            <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>What record gets them in</div>
            <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, margin: '3px 0 10px' }}>
              How often each finish made the playoffs across the simulations, as things stand today.
            </div>
            {ladder.map((r) => {
              const wins = r.wins - me.ties / 2
              const mine = finalWins === r.wins
              const p = Math.round(r.post * 100)
              return (
                <div key={r.wins} style={{ display: 'grid', gridTemplateColumns: '54px 1fr 46px', alignItems: 'center', gap: 10, padding: '4px 6px', margin: '0 -6px', borderRadius: 4, background: mine ? theme.wash : 'transparent' }}>
                  <span style={{ fontFamily: theme.serif, fontSize: 15.5, color: mine ? theme.green : theme.ink, fontWeight: mine ? 700 : 400 }}>{rec(wins, GAMES_IN_SEASON - me.ties - wins)}</span>
                  <div aria-hidden="true" style={{ height: 10, borderRadius: 2, background: theme.rule }}>
                    <div style={{ width: `${p}%`, height: '100%', borderRadius: 2, background: theme.green }} />
                  </div>
                  <span style={{ fontFamily: theme.sans, fontSize: 13, fontWeight: 700, color: theme.ink, textAlign: 'right' }}>{oddsText(p)}</span>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 12, lineHeight: 1.5, maxWidth: 620 }}>
          Our house model — {SIMS.toLocaleString()} simulations of everything you didn’t pick, run in your browser. It works from the standings alone and gives odds, not seeds.
        </div>
      </Section>
    </div>
  )
}
