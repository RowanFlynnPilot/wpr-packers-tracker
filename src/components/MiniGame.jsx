import { useEffect, useState, useCallback, useRef } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, TEAM_ABBR, TEAM_ACCENT, SPONSORS, headshot } from '../config.js'
import { fetchFeaturedGame, fetchLiveSummary, fetchGameSummary, liveExtras, fetchStandingsBundle } from '../api.js'
import { teamGameLeaders } from '../games.js'
import { fetchKickoffForecast } from '../weather.js'
import { trackBeacon } from '../analytics.js'
import { destination } from '../embed.js'
import TeamLogo from './TeamLogo.jsx'

const REFRESH_MS = 30000
const IDLE_REFRESH_MS = 120000

const Headshot = ({ id, size }) => (
  <img src={headshot(id)} alt="" width={size} height={size}
    style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }}
    onError={(e) => { e.currentTarget.style.display = 'none' }} />
)

// Compact featured-game scoreboard for sidebars/articles. The whole card is one link into the
// full tracker (target=_top so it navigates the page hosting the iframe, not the iframe).
// Self-contained and fail-soft: with no data it still renders a useful branded link.
export default function MiniGame() {
  const [game, setGame] = useState(null)
  const [records, setRecords] = useState(null) // { me, opp } record strings for upcoming games
  const [forecast, setForecast] = useState(null)
  const [extras, setExtras] = useState(null)   // win probability + situation while live
  const [star, setStar] = useState(null)       // top performer after a final
  const [now, setNow] = useState(Date.now())   // drives the kickoff countdown chip
  const [pop, setPop] = useState(false)        // score-change animation trigger
  const prevScore = useRef(null)

  const load = useCallback(() => {
    fetchFeaturedGame().then(setGame).catch(() => {})
  }, [])

  const state = game?.state
  const gameId = game?.id
  const home = game?.home ?? true
  const live = state === 'in'

  // Poll the feed (fast while live, gently otherwise) + win probability and the situation
  // during play.
  useEffect(() => {
    if (!live) setExtras(null)
    const refresh = () => {
      if (document.hidden) return
      load()
      if (live && gameId) fetchLiveSummary(gameId).then((s) => setExtras(liveExtras(s, home))).catch(() => {})
    }
    if (live) refresh(); else load()
    const id = setInterval(refresh, live ? REFRESH_MS : IDLE_REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [live, gameId, home, load])

  // Minute tick keeps the countdown chip honest.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // While live, the summary's score is fresher than the schedule feed's (see liveExtras).
  const meScore = live && extras?.meScore != null ? extras.meScore : game?.meScore
  const oppScore = live && extras?.oppScore != null ? extras.oppScore : game?.oppScore

  // Pop the score once whenever it changes during play (never on first paint).
  useEffect(() => {
    if (!game || state === 'pre') { prevScore.current = null; return }
    const key = `${meScore}-${oppScore}`
    if (prevScore.current != null && prevScore.current !== key) {
      setPop(true)
      const t = setTimeout(() => setPop(false), 600)
      prevScore.current = key
      return () => clearTimeout(t)
    }
    prevScore.current = key
  }, [game, state, meScore, oppScore])

  // Upcoming-game extras (records + home-game forecast) and, after a final, the Packers' top
  // performer from the summary leaders. All fail-soft.
  useEffect(() => {
    setRecords(null)
    setForecast(null)
    setStar(null)
    if (!game) return
    let alive = true
    if (state === 'pre') {
      fetchStandingsBundle().then((b) => {
        if (!alive) return
        const fmt = (r) => r && r.wins + r.losses + r.ties > 0 ? `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}` : null
        const stale = b.season < new Date(game.date).getFullYear() - (new Date(game.date).getMonth() < 2 ? 1 : 0)
        setRecords({
          me: fmt(b.league.find((r) => r.id === TEAM_ID)),
          opp: fmt(b.league.find((r) => r.id === game.oppId)),
          stale,
          season: b.season,
        })
      }).catch(() => {})
      // Forecast only when the kickoff time is real — a flexed game's placeholder hour would
      // get a confident forecast while the kicker beside it says "TBD".
      if (game.home && game.timeValid) fetchKickoffForecast(game.date).then((f) => { if (alive) setForecast(f) }).catch(() => {})
    }
    if (state === 'post') {
      fetchGameSummary(gameId).then((s) => {
        if (alive) setStar(teamGameLeaders(s)[0] || null)
      }).catch(() => {})
    }
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- game object churns every poll; id+state pin the fetch
  }, [gameId, state])

  const final = state === 'post'

  const card = {
    display: 'block', maxWidth: 420, margin: '0 auto', textDecoration: 'none', overflow: 'hidden',
    background: '#fff', border: `1px solid ${theme.rule}`, borderRadius: 8,
    textAlign: 'center', fontFamily: theme.sans,
  }
  // Split top edge: Packers green meets the opponent's color (gold until we know the opponent).
  const edge = (
    <div style={{ display: 'flex', height: 3 }}>
      <span style={{ flex: 1, background: theme.green }} />
      <span style={{ flex: 1, background: game ? (TEAM_ACCENT[game.oppId] || theme.gold) : theme.gold }} />
    </div>
  )
  const band = (text) => (
    <div style={{ background: theme.green, color: '#fff', fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      {live && <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: theme.gold, flexShrink: 0 }} />}
      {text}
    </div>
  )
  // Sponsor credit with the logo. The whole card is one link to the tracker, so the logo is an
  // impression here — the clickable sponsor lockups live on the full page it leads to.
  const footer = (
    <div style={{ borderTop: `1px solid ${theme.rule}`, marginTop: 9, paddingTop: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      {SPONSORS.header ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{ fontSize: 8, letterSpacing: '0.12em', fontWeight: 700, color: theme.goldText, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Presented by</span>
          {SPONSORS.header.logo ? (
            <img src={SPONSORS.header.logo} alt={SPONSORS.header.name} style={{ height: 22, objectFit: 'contain', display: 'block' }}
              onError={(e) => { e.currentTarget.style.display = 'none' }} />
          ) : (
            <span style={{ fontSize: 8.5, color: theme.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SPONSORS.header.name}</span>
          )}
        </span>
      ) : <span />}
      <span style={{ fontSize: 11, fontWeight: 700, color: theme.green, whiteSpace: 'nowrap' }}>Full tracker {'→'}</span>
    </div>
  )
  const linkProps = {
    href: destination(),
    target: '_top',
    onClick: () => trackBeacon('Mini Click', { widget: 'scoreboard', state: state || 'none' }),
  }

  // No data (yet, or at all): a branded doorway rather than an empty box.
  if (!game) {
    return (
      <a {...linkProps} className="mini-card" style={card}>
        {edge}
        {band('Packers tracker')}
        <div style={{ padding: '9px 14px 10px' }}>
          <div style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink, padding: '12px 0 4px' }}>The Packers, by the numbers</div>
          <div style={{ fontSize: 11.5, color: theme.muted, paddingBottom: 4 }}>Live scores, standings and the NFC North race</div>
          {footer}
        </div>
      </a>
    )
  }

  const won = final && game.won
  const isToday = new Date(game.date).toDateString() === new Date().toDateString()

  const kicker = live
    ? (game.detail || 'In progress').toUpperCase()
    : final
    ? new Date(game.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
    : `${isToday ? 'TODAY' : new Date(game.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()} · ${game.timeValid ? new Date(game.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'TBD'}${game.tv ? ` · ${game.tv}` : ''}`

  // Countdown chip: minutes/hours inside 12 hours, days beyond (football is weekly).
  const msToStart = state === 'pre' ? new Date(game.date).getTime() - now : null
  let countdown = null
  if (msToStart != null && msToStart > 0) {
    if (msToStart < 12 * 3600 * 1000) {
      const h = Math.floor(msToStart / 3600000)
      const m = Math.floor((msToStart % 3600000) / 60000)
      countdown = h > 0 ? `${h}H ${m}M` : `${m}M`
    } else {
      const d = Math.round(msToStart / 86400000)
      countdown = `${d} DAY${d === 1 ? '' : 'S'}`
    }
  }

  const TeamCol = ({ id, name, rec, bold }) => (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 92 }}>
      <TeamLogo id={id} size={30} />
      <span style={{ fontFamily: theme.serif, fontSize: 13, color: bold ? theme.green : theme.ink, fontWeight: bold ? 700 : 400, lineHeight: 1.1 }}>{name}</span>
      {rec && <span style={{ fontSize: 9.5, color: theme.muted }}>{rec}{records?.stale ? ` in ’${String(records.season).slice(-2)}` : ''}</span>}
    </span>
  )

  return (
    <a {...linkProps} className={`mini-card${live ? ' is-live' : ''}`} style={card}>
      {edge}
      {band(live ? 'Current game' : final ? 'Final score' : game.seasonType === 1 ? 'Preseason' : 'Upcoming game')}
      <div style={{ padding: '9px 14px 10px' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: live ? theme.goldText : theme.muted }}>
          {kicker}{!live && !final && game.week ? ` · WK ${game.week}` : ''}
        </div>
        {countdown && (
          <div style={{ display: 'inline-block', background: theme.gold, color: theme.green, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', borderRadius: 10, padding: '2px 9px', marginTop: 5 }}>
            KICKOFF IN {countdown}
          </div>
        )}
        {won && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: theme.green, borderRadius: 10, padding: '2px 10px 2px 4px', marginTop: 5 }}>
            <span style={{ width: 15, height: 15, borderRadius: '50%', background: theme.gold, color: theme.green, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>W</span>
            <span style={{ color: '#fff', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em' }}>PACKERS WIN</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, margin: '7px 0 2px' }}>
          <TeamCol id={TEAM_ID} name="Packers" rec={records?.me} bold={won} />
          {live || final ? (
            <span className={pop ? 'score-pop' : undefined} style={{ display: 'inline-block', fontFamily: theme.serif, fontSize: 26, color: theme.ink, whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: won ? 700 : 400, color: won ? theme.green : theme.ink }}>{meScore}</span>
              <span style={{ fontSize: 16, color: theme.muted }}> – </span>
              {oppScore}
            </span>
          ) : (
            <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted }}>{game.home ? 'vs' : 'at'}</span>
          )}
          <TeamCol id={game.oppId} name={game.oppName} rec={records?.opp} />
        </div>

        {live && extras?.situation && (
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.green, margin: '2px 0 4px' }}>{extras.situation}</div>
        )}
        {live && extras?.mePct != null && (
          <div style={{ maxWidth: 200, margin: '0 auto 2px' }}>
            <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: theme.rule }}>
              <span style={{ width: `${extras.mePct}%`, background: theme.green }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginTop: 2 }}>
              <span style={{ color: theme.green, fontWeight: 700 }}>{TEAM_ABBR} {extras.mePct}%</span>
              <span style={{ color: theme.muted }}>{game.oppAbbr} {100 - extras.mePct}%</span>
            </div>
          </div>
        )}

        {!live && !final && (
          <div style={{ fontSize: 10.5, color: theme.muted, marginTop: 3 }}>
            {game.home ? 'Lambeau Field' : game.venue}
          </div>
        )}
        {forecast && (
          <div style={{ fontSize: 10.5, color: theme.muted, marginTop: 3 }}>
            Kickoff: {forecast.tempF}°F, {forecast.label} · {forecast.precipPct}% precip
          </div>
        )}

        {final && star && (
          <div style={{ marginTop: 2 }}>
            <div style={{ fontSize: 8.5, letterSpacing: '0.14em', fontWeight: 700, color: theme.goldText, textTransform: 'uppercase' }}>
              {won ? 'Player of the game' : 'Top performer'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 3 }}>
              <Headshot id={star.id} size={26} />
              <span style={{ fontSize: 11.5 }}>
                <span style={{ fontWeight: 700, color: theme.ink }}>{star.name}</span>
                <span style={{ color: theme.muted }}> · {star.line}</span>
              </span>
            </div>
          </div>
        )}

        {footer}
      </div>
    </a>
  )
}
