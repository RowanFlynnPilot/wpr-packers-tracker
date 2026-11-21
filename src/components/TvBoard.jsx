import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, TEAM_ABBRS, TEAM_NAMES, DIVISION_NAME, CONFERENCE, SEASON, SPONSORS, WATCH_VENUES } from '../config.js'
import { fetchFeaturedGame, fetchLiveSummary, liveExtras, fetchStandingsBundle, fetchSeasonGames } from '../api.js'
import { gamesBack, scoringText } from '../games.js'
import { conferenceTeams, simulate, openRace, oddsText } from '../playoffSim.js'
import { howToWatch } from '../calendar.js'
import { track } from '../analytics.js'
import { useGameStakes, MIN_SWING } from './GameStakes.jsx'
import { buildWeek } from './RootingGuide.jsx'
import TeamLogo from './TeamLogo.jsx'

// The bar TV board (tv.html): a full-screen scoreboard for a game-day venue's own screens — the
// Packers' game big enough to read across a room, the scores that matter around the NFC on a
// rotating rail, and the venue, the title sponsor and a QR code to the tracker along the bottom.
// Nothing to tap: it polls, rotates and (on a new Packers score) celebrates on its own, holds a
// screen wake lock, and reloads itself overnight so a screen left on all week runs the current
// build. `?venue=2` picks which sold venue it's dressed for (default: the first); a click
// anywhere toggles full screen. Sized in `--u` (1% of the screen's height, capped to 16:9), so
// one layout fills a 720p bar TV and a 4K one alike.
const U = (n) => `calc(var(--u) * ${n})`
const LIVE_MS = 20000
const IDLE_MS = 60000
const ROTATE_MS = 15000
const WHITE = '#ffffff'
const DIM = '#b9c7bf'
const PANEL = 'rgba(255,255,255,0.07)'
const LINE = 'rgba(255,255,255,0.16)'
const rec = (t) => `${t.wins}–${t.losses}${t.ties ? `–${t.ties}` : ''}`
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }

function countdown(game, now) {
  const ms = new Date(game.date) - now
  if (ms <= 0 || !game.timeValid) return null
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return ms >= 48 * 3600000 ? `${Math.round(ms / 86400000)} days` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function TvBoard() {
  const [game, setGame] = useState(null)
  const [extras, setExtras] = useState(null)
  const [bundle, setBundle] = useState(null)
  const [week, setWeek] = useState(null)    // the rooting guide's data
  const [nextUp, setNextUp] = useState(null) // the game after a final
  const [now, setNow] = useState(Date.now())
  const [panel, setPanel] = useState(0)
  const [celebrate, setCelebrate] = useState(null)
  const [hint, setHint] = useState(true)
  const lastScore = useRef(undefined)
  const born = useRef(Date.now())

  const params = new URLSearchParams(window.location.search)
  const venue = WATCH_VENUES[Math.max(0, (Number(params.get('venue')) || 1) - 1)] || WATCH_VENUES[0] || null
  const live = game?.state === 'in'
  const final = game?.state === 'post'
  const stakes = useGameStakes(game, !!game && !final)

  useEffect(() => { track('TV Board', { venue: venue?.name || 'none' }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The game, on the live or idle cadence; the live summary rides the same tick.
  useEffect(() => {
    let alive = true
    const tick = () => {
      setNow(Date.now())
      fetchFeaturedGame().then((g) => { if (alive) setGame(g) }).catch(() => {})
      if (live && game?.id) fetchLiveSummary(game.id).then((s) => { if (alive) setExtras(liveExtras(s, game.home)) }).catch(() => {})
      // Overnight, between games: reload so a screen left on all week picks up new builds.
      const hour = new Date().getHours()
      if (!live && Date.now() - born.current > 6 * 3600000 && hour >= 4 && hour < 5) window.location.reload()
    }
    tick()
    const id = setInterval(tick, live ? LIVE_MS : IDLE_MS)
    return () => { alive = false; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id + live pin the cadence
  }, [live, game?.id])
  useEffect(() => { if (!live) setExtras(null) }, [live])

  // Standings, the rooting rows and the next game: slow feeds, one shared two-minute tick.
  useEffect(() => {
    let alive = true
    const tick = () => {
      fetchStandingsBundle().then((b) => { if (alive) setBundle(b) }).catch(() => {})
      buildWeek().then((w) => { if (alive) setWeek(w) }).catch(() => {})
      fetchSeasonGames().then(({ games }) => { if (alive) setNextUp(games.find((g) => g.state === 'pre') || null) }).catch(() => {})
    }
    tick()
    const id = setInterval(tick, live ? 60000 : 120000)
    return () => { alive = false; clearInterval(id) }
  }, [live])

  // The rail turns over on its own; a new Packers score takes the whole screen for six seconds
  // (the first summary after load only sets the baseline, so nothing replays).
  useEffect(() => { const id = setInterval(() => setPanel((p) => p + 1), ROTATE_MS); return () => clearInterval(id) }, [])
  useEffect(() => {
    if (!live) { lastScore.current = undefined; return }
    if (!extras) return
    const id = extras.lastScore?.id ?? null
    if (lastScore.current === undefined) { lastScore.current = id; return }
    if (id && id !== lastScore.current) {
      lastScore.current = id
      if (extras.lastScore.teamId === TEAM_ID) setCelebrate(extras.lastScore)
    }
  }, [live, extras])
  useEffect(() => { if (!celebrate) return; const t = setTimeout(() => setCelebrate(null), 6000); return () => clearTimeout(t) }, [celebrate])

  // Keep the screen awake while the board is showing (re-asked when the tab comes back).
  useEffect(() => {
    let lock = null
    const ask = () => { if (!document.hidden) navigator.wakeLock?.request('screen').then((l) => { lock = l }).catch(() => {}) }
    ask()
    document.addEventListener('visibilitychange', ask)
    const t = setTimeout(() => setHint(false), 8000)
    return () => { document.removeEventListener('visibilitychange', ask); lock?.release?.().catch(() => {}); clearTimeout(t) }
  }, [])

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const inSeason = bundle?.season === SEASON
  const me = bundle?.league.find((r) => r.id === TEAM_ID)
  const teams = inSeason ? conferenceTeams(bundle.league) : null
  const race = inSeason && me ? openRace(me.clincher) : null
  const odds = teams ? simulate(teams) : null
  const meScore = live && extras?.meScore != null ? extras.meScore : game?.meScore
  const oppScore = live && extras?.oppScore != null ? extras.oppScore : game?.oppScore
  const oppName = game ? TEAM_NAMES[game.oppId] || game.oppName : ''

  // ── The rail's panels ────────────────────────────────────────────────────────────────────
  const head = (text) => (
    <div style={{ fontFamily: theme.sans, fontSize: U(2.1), fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.gold, marginBottom: U(1.4) }}>{text}</div>
  )
  const panels = []
  if (week) {
    const swing = (g) => Math.abs(g.ifHome - g.ifAway)
    const rows = week.games.filter((g) => !g.mine && swing(g) >= 1).sort((a, b) => swing(b) - swing(a) || b.exact - a.exact).slice(0, 6)
    if (rows.length) {
      panels.push(
        <div key="root">
          {head(`Root for · Week ${week.week}`)}
          {rows.map((g) => {
            const [r, o] = g.root === 'home' ? [g.home, g.away] : [g.away, g.home]
            const lead = r.score > o.score ? '#8fe3a8' : r.score < o.score ? '#ff9c94' : DIM
            return (
              <div key={g.id} style={{ display: 'grid', gridTemplateColumns: `${U(4)} minmax(0, 1fr) auto`, alignItems: 'center', columnGap: U(1.2), padding: `${U(1.05)} 0`, borderTop: `1px solid ${LINE}` }}>
                <TeamLogo id={r.id} size={36} loading="eager" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: theme.sans, fontSize: U(2.7), fontWeight: 700, color: WHITE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.name} <span style={{ color: DIM, fontWeight: 400 }}>over {o.name}</span>
                  </div>
                  <div style={{ fontFamily: theme.sans, fontSize: U(2.05), color: DIM }}>
                    {g.state === 'pre'
                      ? `${new Date(g.date).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}${g.tv ? ` · ${g.tv}` : ''}`
                      : <><span style={{ color: g.state === 'in' ? lead : WHITE, fontWeight: 700 }}>{g.away.abbr} {g.away.score}, {g.home.abbr} {g.home.score}</span>{' · '}
                          {g.state === 'in' ? g.detail.replace(/ - /g, ' · ') : g.winner === g.root ? 'Final ✓' : 'Final ✗'}</>}
                  </div>
                </div>
                <div style={{ fontFamily: theme.serif, fontSize: U(3.4), color: theme.gold, whiteSpace: 'nowrap' }}>{swing(g)}<span style={{ fontFamily: theme.sans, fontSize: U(1.7), color: DIM, marginLeft: U(0.4) }}>{swing(g) === 1 ? 'pt' : 'pts'}</span></div>
              </div>
            )
          })}
          <div style={{ fontFamily: theme.sans, fontSize: U(1.6), color: DIM, marginTop: U(1) }}>Points of Packers {week.metric === 'division' ? 'division' : 'playoff'} odds riding on each game · house model</div>
        </div>,
      )
    }
  }
  if (inSeason) {
    const seeds = bundle.league.filter((r) => r.conf === CONFERENCE && r.seed).sort((a, b) => a.seed - b.seed)
    if (seeds.length >= 12) {
      panels.push(
        <div key="picture">
          {head(`${CONFERENCE} playoff picture`)}
          {seeds.slice(0, 9).map((r) => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: `${U(2.6)} ${U(3.6)} minmax(0, 1fr) auto`, alignItems: 'center', columnGap: U(1.1), padding: `${U(0.62)} ${U(0.8)}`, margin: `0 ${U(-0.8)}`, borderTop: r.seed === 8 ? `2px dashed ${theme.gold}` : `1px solid ${LINE}`, background: r.id === TEAM_ID ? 'rgba(255,182,18,0.18)' : 'transparent', borderRadius: U(0.5) }}>
              <span style={{ fontFamily: theme.sans, fontSize: U(2.1), fontWeight: 800, color: DIM, textAlign: 'right' }}>{r.seed}</span>
              <TeamLogo id={r.id} size={32} loading="eager" />
              <span style={{ fontFamily: theme.sans, fontSize: U(2.6), fontWeight: r.id === TEAM_ID ? 800 : 400, color: WHITE }}>{r.name}</span>
              <span style={{ fontFamily: theme.sans, fontSize: U(2.4), color: DIM }}>{rec(r)}</span>
            </div>
          ))}
          <div style={{ fontFamily: theme.sans, fontSize: U(1.6), color: DIM, marginTop: U(1) }}>If the season ended today · seven teams get in</div>
        </div>,
      )
    }
  }
  if (bundle) {
    const leader = bundle.standings[0]
    panels.push(
      <div key="north">
        {head(inSeason ? DIVISION_NAME : `${DIVISION_NAME} · final ${bundle.season}`)}
        {bundle.standings.map((t) => {
          const gb = gamesBack({ w: leader.wins, l: leader.losses, t: leader.ties }, { w: t.wins, l: t.losses, t: t.ties })
          return (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: `${U(5.4)} minmax(0, 1fr) auto ${U(7)}`, alignItems: 'center', columnGap: U(1.4), padding: `${U(1.5)} ${U(0.8)}`, margin: `0 ${U(-0.8)}`, borderTop: `1px solid ${LINE}`, background: t.id === TEAM_ID ? 'rgba(255,182,18,0.18)' : 'transparent', borderRadius: U(0.5) }}>
              <TeamLogo id={t.id} size={50} loading="eager" />
              <span style={{ fontFamily: theme.serif, fontSize: U(3.6), fontWeight: t.id === TEAM_ID ? 700 : 400, color: WHITE }}>{t.name}</span>
              <span style={{ fontFamily: theme.sans, fontSize: U(3.3), fontWeight: 700, color: WHITE }}>{rec(t)}</span>
              <span style={{ fontFamily: theme.sans, fontSize: U(2.3), color: DIM, textAlign: 'right' }}>{gb ? `${gb} back` : 'leads'}</span>
            </div>
          )
        })}
      </div>,
    )
  }
  const shown = panels.length ? panels[panel % panels.length] : null

  // ── The game ─────────────────────────────────────────────────────────────────────────────
  const team = (id, label) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: U(1.2), minWidth: 0 }}>
      <img src={`https://a.espncdn.com/i/teamlogos/nfl/500/${(TEAM_ABBRS[id] || '').toLowerCase()}.png`} alt="" style={{ width: U(19), height: U(19), objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
      <div style={{ fontFamily: theme.serif, fontSize: U(5.2), color: WHITE, lineHeight: 1 }}>{label}</div>
    </div>
  )
  const kicker = !game ? '' : live ? `Live · ${game.detail.replace(/ - /g, ' · ')}` : final ? `Final${game.ot ? ' · overtime' : ''}` : game.seasonType === 3 ? 'Playoffs' : 'Next game'
  const left = !game ? null : countdown(game, now)
  const k = stakes?.metric
  const liveOdds = live && stakes && extras?.mePct != null && stakes.win[k] - stakes.loss[k] >= MIN_SWING
    ? Math.round((extras.mePct / 100) * stakes.win[k] + (1 - extras.mePct / 100) * stakes.loss[k]) : null
  const oddsLabel = (race || k) === 'division' ? `${DIVISION_NAME} title odds` : 'Playoff odds'

  return (
    <div onClick={toggleFull} style={{ '--u': 'min(1vh, 0.5625vw)', position: 'fixed', inset: 0, background: theme.green, color: WHITE, overflow: 'hidden', cursor: 'none', display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', borderTop: `${U(0.9)} solid ${theme.gold}` }}>
      {celebrate && (
        <div className="td-moment" style={{ position: 'absolute', inset: 0, zIndex: 5, background: theme.gold, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: U(2), textAlign: 'center', padding: U(6) }}>
          <div style={{ fontFamily: theme.sans, fontSize: U(3.2), fontWeight: 800, letterSpacing: '0.24em', textTransform: 'uppercase', color: theme.green }}>Packers</div>
          <div className="td-word" style={{ fontFamily: theme.serif, fontWeight: 700, fontSize: U(21), lineHeight: 0.95, textTransform: 'uppercase', color: theme.green }}>{celebrate.kind}</div>
          {celebrate.text && <div style={{ fontFamily: theme.sans, fontSize: U(3.2), color: theme.green, maxWidth: '80%' }}>{scoringText(celebrate.text)}</div>}
          <div style={{ fontFamily: theme.serif, fontSize: U(6), color: theme.green }}>Packers {meScore}, {oppName} {oppScore}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 61fr) minmax(0, 39fr)', gap: U(3), padding: `${U(3)} ${U(4)} ${U(2.4)}`, minHeight: 0 }}>
        {/* The Packers' game */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', minWidth: 0 }}>
          {game && (
            <>
              <div style={{ fontFamily: theme.sans, fontSize: U(2.8), fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: live ? theme.gold : DIM, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: U(1.2) }}>
                {live && <span className="live-dot" style={{ width: U(1.8), height: U(1.8), borderRadius: '50%', background: theme.gold }} />}
                {kicker}{!live && !final && game.week && game.seasonType === 2 ? ` · Week ${game.week}` : ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', columnGap: U(3), margin: `${U(2.6)} 0 ${U(2)}` }}>
                {team(TEAM_ID, 'Packers')}
                {live || final ? (
                  <div style={{ fontFamily: theme.serif, fontSize: U(21), lineHeight: 1, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: U(2.4) }}>
                    <span style={{ color: final && !game.won ? DIM : WHITE }}>{meScore}</span>
                    <span style={{ fontSize: U(8), color: DIM }}>–</span>
                    <span style={{ color: final && game.won ? DIM : WHITE }}>{oppScore}</span>
                  </div>
                ) : (
                  <div style={{ fontFamily: theme.sans, fontSize: U(3.4), letterSpacing: '0.16em', textTransform: 'uppercase', color: DIM }}>{game.home ? 'vs' : 'at'}</div>
                )}
                {team(game.oppId, oppName)}
              </div>

              {!live && !final && (
                <>
                  <div style={{ fontFamily: theme.serif, fontSize: U(4.6), color: WHITE }}>
                    {game.timeValid
                      ? new Date(game.date).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : `${new Date(game.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · time TBD`}
                  </div>
                  <div style={{ fontFamily: theme.sans, fontSize: U(2.7), color: DIM, marginTop: U(0.8) }}>
                    {[howToWatch(game.tv), left && `Kickoff in ${left}`].filter(Boolean).join(' · ')}
                  </div>
                </>
              )}
              {live && extras?.situation && (
                <div style={{ fontFamily: theme.sans, fontSize: U(3.4), fontWeight: 700, color: theme.gold }}>{extras.situation}</div>
              )}
              {live && extras?.mePct != null && (
                <div style={{ width: '78%', margin: `${U(2.2)} auto 0` }}>
                  <div style={{ display: 'flex', height: U(1.8), borderRadius: U(0.9), overflow: 'hidden', background: 'rgba(255,255,255,0.22)' }}>
                    <div style={{ width: `${extras.mePct}%`, background: theme.gold, transition: 'width 800ms ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: U(2.3), marginTop: U(0.8) }}>
                    <span style={{ color: theme.gold, fontWeight: 700 }}>Packers win probability {extras.mePct}%</span>
                    <span style={{ color: DIM }}>{oppName} {100 - extras.mePct}%</span>
                  </div>
                </div>
              )}
              {final && nextUp && (
                <div style={{ fontFamily: theme.sans, fontSize: U(2.8), color: DIM }}>
                  Next: {nextUp.home ? 'vs' : 'at'} the {TEAM_NAMES[nextUp.oppId] || nextUp.oppName}{nextUp.timeValid ? `, ${new Date(nextUp.date).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
                </div>
              )}

              {/* The season in one strip: the record, the seed, and the odds this game moves. */}
              {inSeason && me && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: U(1.6), marginTop: U(3.2) }}>
                  {[
                    ['Record', rec(me)],
                    me.seed ? [`${CONFERENCE} seed`, me.seed <= 7 ? `No. ${me.seed}` : `${ord(me.seed)}`] : null,
                    liveOdds != null ? [`${oddsLabel} right now`, oddsText(liveOdds)]
                      : odds && race ? [oddsLabel, oddsText(odds[race])] : null,
                    !final && stakes && stakes.win[k] - stakes.loss[k] >= MIN_SWING ? ['Win / loss', `${oddsText(stakes.win[k])} / ${oddsText(stakes.loss[k])}`] : null,
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label} style={{ background: PANEL, borderRadius: U(1), padding: `${U(1.3)} ${U(2.2)}`, minWidth: U(15) }}>
                      <div style={{ fontFamily: theme.serif, fontSize: U(4.6), color: WHITE, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{value}</div>
                      <div style={{ fontFamily: theme.sans, fontSize: U(1.65), fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: DIM, marginTop: U(0.5), whiteSpace: 'nowrap' }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* The rail */}
        <div style={{ background: PANEL, borderRadius: U(1.4), padding: `${U(2.4)} ${U(2.6)}`, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: U(2) }}>
          <div style={{ minHeight: 0 }}>{shown}</div>
          {/* The venue's own specials, pinned under whatever the rail is showing — it's their screen. */}
          {venue?.specials?.length > 0 && (
            <div style={{ borderTop: `2px solid ${theme.gold}`, paddingTop: U(1.4), flexShrink: 0 }}>
              <div style={{ fontFamily: theme.sans, fontSize: U(1.7), fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.gold, marginBottom: U(0.6) }}>At {venue.name}</div>
              {venue.specials.slice(0, 3).map((sp) => (
                <div key={sp} style={{ fontFamily: theme.sans, fontSize: U(2.15), color: WHITE, lineHeight: 1.35, marginTop: U(0.3) }}>{sp}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The venue, the title sponsor, and the way onto a phone */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'center', columnGap: U(3.4), background: WHITE, color: theme.ink, padding: `${U(1.5)} ${U(4)}`, borderTop: `${U(0.5)} solid ${theme.gold}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: U(2), minWidth: 0 }}>
          {venue?.logo && <img src={venue.logo} alt="" style={{ height: U(9), width: U(9), objectFit: 'cover', borderRadius: U(0.8), flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = 'none' }} />}
          <div style={{ minWidth: 0 }}>
            {venue ? (
              <>
                <div style={{ fontFamily: theme.sans, fontSize: U(1.6), fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.goldText }}>Game-day partner</div>
                <div style={{ fontFamily: theme.serif, fontSize: U(4), fontWeight: 600, color: theme.green, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{venue.name}</div>
                {(venue.features?.length || venue.tagline) && <div style={{ fontFamily: theme.sans, fontSize: U(1.9), color: theme.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{venue.features?.length ? venue.features.join(' · ') : venue.tagline}</div>}
              </>
            ) : (
              <div style={{ fontFamily: theme.serif, fontSize: U(3.6), fontWeight: 600, color: theme.green }}>Wausau Pilot &amp; Review · The Packers, by the numbers</div>
            )}
          </div>
        </div>
        {SPONSORS.header && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: theme.sans, fontSize: U(1.6), fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.muted }}>Packers tracker presented by</div>
            {SPONSORS.header.logo
              ? <img src={SPONSORS.header.logo} alt={SPONSORS.header.name} style={{ height: U(5.6), maxWidth: U(34), objectFit: 'contain', display: 'block', margin: `${U(0.5)} auto 0` }} />
              : <div style={{ fontFamily: theme.serif, fontSize: U(3.2), color: theme.ink }}>{SPONSORS.header.name}</div>}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: U(1.6) }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: theme.sans, fontSize: U(2), fontWeight: 800, color: theme.green }}>Follow on your phone</div>
            <div style={{ fontFamily: theme.sans, fontSize: U(1.6), color: theme.muted }}>Wausau Pilot &amp; Review<br />Packers tracker</div>
          </div>
          <img src={`${import.meta.env.BASE_URL}qr-tracker.svg`} alt="QR code to the Packers tracker" style={{ height: U(9.4), width: U(9.4), display: 'block' }} />
        </div>
      </div>

      {hint && (
        <div style={{ position: 'absolute', top: U(2.2), left: U(3), fontFamily: theme.sans, fontSize: U(1.8), color: DIM, background: 'rgba(0,0,0,0.35)', borderRadius: U(0.8), padding: `${U(0.6)} ${U(1.4)}` }}>
          Click anywhere for full screen
        </div>
      )}
    </div>
  )
}
