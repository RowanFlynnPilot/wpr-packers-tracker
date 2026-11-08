import { useEffect, useState, useCallback, useRef } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, TEAM_ABBRS, TEAM_ACCENT, DIVISION, SPONSORS, SITE_URL, WPR_EMBED_URL, SEASON, headshot } from '../config.js'
import { fetchFeaturedGame, fetchGameSummary, fetchLiveSummary, liveExtras, fetchStandingsBundle, fetchStandings, fetchStatsSeason, fetchTeamSchedule, fetchPredictor, fetchRecentMeetings, fetchSeasonGames } from '../api.js'
import { finals, teamGameLeaders, periodLabel, scoringText, gameFlow } from '../games.js'
import { CLINCH } from '../playoffSim.js'
import { shareFinalCard } from '../share-card.js'
import { fetchKickoffForecast } from '../weather.js'
import { track } from '../analytics.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Sponsor from './Sponsor.jsx'
import TeamLogo from './TeamLogo.jsx'
import LiveField from './LiveField.jsx'
import GameStakes from './GameStakes.jsx'

const REFRESH_MS = 30000 // live football moves fast; ESPN caches a few seconds.
const IDLE_REFRESH_MS = 120000 // pre-game/final cadence — keeps the hero able to flip to Live on its own.

const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }

// Quarter-by-quarter scoreboard for live/final games, from the summary's header linescores.
function LinescoreStrip({ summary, packersHome, oppName }) {
  const comps = summary?.header?.competitions?.[0]?.competitors || []
  const homeC = comps.find((c) => c.homeAway === 'home')
  const awayC = comps.find((c) => c.homeAway === 'away')
  if (!homeC?.linescores?.length || !awayC?.linescores?.length) return null
  const periods = Math.max(homeC.linescores.length, awayC.linescores.length)
  const head = { padding: '3px 8px', fontFamily: theme.sans, fontSize: 10, color: theme.muted, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }
  const cell = { padding: '3px 8px', fontFamily: theme.sans, fontSize: 12, color: theme.ink, textAlign: 'center' }
  const rows = [
    { c: awayC, name: packersHome ? oppName : 'Packers', isMe: !packersHome },
    { c: homeC, name: packersHome ? 'Packers' : oppName, isMe: packersHome },
  ]
  return (
    <div style={{ overflowX: 'auto', margin: '0 0 18px' }}>
      <table style={{ borderCollapse: 'collapse', margin: '0 auto', width: 'auto' }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: 'left' }} />
            {Array.from({ length: periods }).map((_, i) => <th key={i} style={head}>{i < 4 ? i + 1 : `OT${i > 4 ? i - 3 : ''}`}</th>)}
            <th style={{ ...head, borderLeft: `1px solid ${theme.rule}` }}>T</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ ...cell, textAlign: 'left', fontFamily: theme.serif, fontSize: 13, fontWeight: r.isMe ? 700 : 400, color: r.isMe ? theme.green : theme.ink }}>{r.name}</td>
              {Array.from({ length: periods }).map((_, i) => <td key={i} style={cell}>{r.c.linescores[i]?.displayValue ?? ''}</td>)}
              <td style={{ ...cell, fontWeight: 700, borderLeft: `1px solid ${theme.rule}` }}>{r.c.score ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Sponsored "featured game" hero — the centerpiece. Self-contained: fetches its own feed and,
// while a game is live, auto-refreshes the score + situation (pausing when the tab is hidden).
// Hidden entirely if it can't load, so a failure here never breaks the page below it.
export default function GameHero() {
  const [game, setGame] = useState(null)
  const [error, setError] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [extras, setExtras] = useState(null)      // live: win prob, situation, latest plays
  const [summary, setSummary] = useState(null)    // final: linescore + top performers
  const [forecast, setForecast] = useState(null)
  const [oppForm, setOppForm] = useState(null)    // opponent standing line (upcoming games)
  const [lastMeeting, setLastMeeting] = useState(null)
  const [meetings, setMeetings] = useState(null)  // recent head-to-heads (division rivals only)
  const [fpi, setFpi] = useState(null)            // ESPN's pregame win projection (their model, labeled)
  const [copied, setCopied] = useState(false)
  const [cardShared, setCardShared] = useState(false)
  const [pop, setPop] = useState(false)
  const prevScore = useRef(null)
  const [celebrate, setCelebrate] = useState(null) // the Packers score that just happened
  const lastScoreId = useRef(undefined)
  const narrow = useIsNarrow()

  // Opt-in game alert. Notifications only work on the standalone page (cross-origin iframes block
  // them), and — without a push backend — only fire while this tab/app is open. Honest + feature-gated.
  const canAlert = typeof window !== 'undefined' && 'Notification' in window && window.self === window.top
  const [alertsOn, setAlertsOn] = useState(() => {
    try { return localStorage.getItem('packersAlerts') === '1' } catch { return false }
  })
  const wasLive = useRef(null)
  const toggleAlerts = () => {
    const persist = (v) => { try { localStorage.setItem('packersAlerts', v ? '1' : '0') } catch {} }
    if (alertsOn) { setAlertsOn(false); persist(false); return }
    if (Notification.permission === 'granted') { setAlertsOn(true); persist(true); return }
    Notification.requestPermission().then((p) => { if (p === 'granted') { setAlertsOn(true); persist(true) } })
  }

  // ESPN's clinch mark for Green Bay ('' until there is one) rides the same poll: the badge, and
  // the one-time takeover below, appear within a couple of minutes of the math settling.
  const [clinch, setClinch] = useState('')
  const [clinchMoment, setClinchMoment] = useState(null)

  const load = useCallback(() => {
    fetchFeaturedGame().then((g) => { setGame(g); setError(false) }).catch(() => setError(true))
    fetchStatsSeason()
      .then((s) => (s === SEASON ? fetchStandings(SEASON) : null))
      .then((rows) => { if (rows) setClinch(rows.find((r) => r.id === TEAM_ID)?.clincher || '') })
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  // Minute tick drives the pre-game countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  const live = game?.state === 'in'
  const final = game?.state === 'post'
  const gameId = game?.id
  const home = game?.home ?? true

  // Poll the feed always — fast while live (with win-probability/last-play extras), gently
  // otherwise. Without the idle cadence the hero would never notice a game going live, and the
  // opt-in alert (which watches for that flip) could never fire.
  useEffect(() => {
    if (!live) setExtras(null)
    const refresh = () => {
      if (document.hidden) return
      load()
      if (live && gameId) fetchLiveSummary(gameId).then((s) => setExtras(liveExtras(s, home))).catch(() => {})
    }
    if (live) refresh()
    const id = setInterval(refresh, live ? REFRESH_MS : IDLE_REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [live, gameId, home, load])

  // Final: one cached summary read for the quarter linescore + top performers.
  useEffect(() => {
    setSummary(null)
    if (!final || !gameId) return
    let alive = true
    fetchGameSummary(gameId).then((s) => { if (alive) setSummary(s) }).catch(() => {})
    return () => { alive = false }
  }, [final, gameId])

  // Final (regular season): the Packers' record AFTER this game, for the result line under the
  // score — "Packers fall to 4–3" says more than the "Final" the kicker already said.
  const [finalRecord, setFinalRecord] = useState(null)
  useEffect(() => {
    setFinalRecord(null)
    if (!final || !game || game.seasonType !== 2) return
    let alive = true
    fetchSeasonGames().then(({ games }) => {
      const upTo = games.filter((g) => g.seasonType === 2 && g.state === 'post' && new Date(g.date) <= new Date(game.date))
      const w = upTo.filter((g) => g.won).length
      const t = upTo.filter((g) => g.tied).length
      if (alive) setFinalRecord(`${w}–${upTo.length - w - t}${t ? `–${t}` : ''}`)
    }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id + final pin the read
  }, [final, gameId])

  // While live, the summary's score is fresher than the schedule feed's (see liveExtras).
  const meScore = live && extras?.meScore != null ? extras.meScore : game?.meScore
  const oppScore = live && extras?.oppScore != null ? extras.oppScore : game?.oppScore

  // Pop the score once whenever it changes during play (never on first paint) — same
  // micro-interaction as the minis, shared .score-pop keyframes.
  useEffect(() => {
    if (!game || game.state === 'pre') { prevScore.current = null; return }
    const key = `${meScore}-${oppScore}`
    if (prevScore.current != null && prevScore.current !== key) {
      setPop(true)
      const t = setTimeout(() => setPop(false), 600)
      prevScore.current = key
      return () => clearTimeout(t)
    }
    prevScore.current = key
  }, [game, meScore, oppScore])

  // The touchdown moment: when a NEW scoring play shows up and it's Green Bay's, the card takes
  // a gold sweep for five seconds — once per score. The first summary after the page opens only
  // sets the baseline (opening the page mid-game replays nothing), and opponent scores pass
  // quietly; the score pop already marks them.
  useEffect(() => {
    if (!live) { lastScoreId.current = undefined; return }
    if (!extras) return
    const ls = extras.lastScore
    const id = ls?.id ?? null
    if (lastScoreId.current === undefined) { lastScoreId.current = id; return }
    if (id && id !== lastScoreId.current) {
      lastScoreId.current = id
      if (ls.teamId === TEAM_ID) setCelebrate(ls)
    }
  }, [live, extras])
  useEffect(() => {
    if (!celebrate) return
    const t = setTimeout(() => setCelebrate(null), 5200)
    return () => clearTimeout(t)
  }, [celebrate])

  // The CLINCHED moment: the first time this device sees a new clinch level (a playoff spot, then
  // the division, then the No. 1 seed), the card takes the same gold sweep as a touchdown, once.
  // Remembered per season in localStorage; without storage there's no takeover at all — it would
  // otherwise replay on every visit. The badge under the kicker carries the news after that.
  useEffect(() => {
    const level = CLINCH[clinch]
    if (!level) return
    const key = `packersClinch:${SEASON}`
    let seen
    try { seen = Number(localStorage.getItem(key)) || 0 } catch { return }
    if (level.rank <= seen) return
    try { localStorage.setItem(key, String(level.rank)) } catch { return }
    setClinchMoment(level)
  }, [clinch])
  useEffect(() => {
    if (!clinchMoment) return
    const t = setTimeout(() => setClinchMoment(null), 6500)
    return () => clearTimeout(t)
  }, [clinchMoment])

  // Fire an alert once when the featured game flips to live (only if opted in + permitted).
  // wasLive starts null so a page opened mid-game sets the baseline silently — only an
  // observed not-live → live transition notifies.
  useEffect(() => {
    if (!game) return
    if (wasLive.current === false && live && alertsOn && canAlert && Notification.permission === 'granted') {
      try { new Notification('Packers game is underway', { body: `${game.home ? 'vs' : '@'} ${game.oppName}`, icon: `${import.meta.env.BASE_URL}icon.svg` }) } catch {}
    }
    wasLive.current = live
  }, [live, alertsOn, canAlert, game])

  // Kickoff forecast for upcoming HOME games (Open-Meteo covers Lambeau; road cities are out of
  // scope). Only when the kickoff time is real — a flexed game's placeholder hour would get a
  // confident forecast while the dateline says "TBD". Fail-soft — the line simply doesn't render.
  const state = game?.state
  useEffect(() => {
    setForecast(null)
    if (!game || state !== 'pre' || !game.home || !game.timeValid) return
    let alive = true
    fetchKickoffForecast(game.date).then((f) => { if (alive) setForecast(f) }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- game object churns every poll; id+state pin the fetch
  }, [gameId, state])

  // Matchup context for upcoming games: the opponent's standing line and the last meeting.
  // Both fail-soft. In the offseason the standing line reads "went 11–6 last season".
  useEffect(() => {
    setOppForm(null)
    setLastMeeting(null)
    setMeetings(null)
    setFpi(null)
    if (!game || state !== 'pre') return
    let alive = true
    fetchStandingsBundle().then((b) => {
      if (!alive) return
      const row = b.league.find((r) => r.id === game.oppId)
      if (row) setOppForm({ ...row, season: b.season })
    }).catch(() => {})
    // ESPN's model doesn't publish projections for exhibitions; regular/postseason only.
    if (game.seasonType !== 1) fetchPredictor(gameId, home).then((v) => { if (alive) setFpi(v) }).catch(() => {})
    // Division rivals get the full recent ledger; everyone else gets the last meeting.
    if (DIVISION[game.oppId] && game.oppId !== TEAM_ID) {
      fetchRecentMeetings(game.oppId).then((m) => { if (alive && m.length >= 2) setMeetings(m) }).catch(() => {})
    }
    fetchStatsSeason().then(async (season) => {
      const { games } = await fetchTeamSchedule(TEAM_ID, season, 2)
      if (!alive) return
      const met = finals(games).filter((g) => g.oppId === game.oppId)
      if (met.length) setLastMeeting(met[met.length - 1])
    }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id+state pin the fetch
  }, [gameId, state])

  if (error || !game) return null

  const oppName = game.oppName
  const isToday = new Date(game.date).toDateString() === new Date().toDateString()
  const showScore = live || final
  const won = final && game.won

  const kicker = live ? 'Live' : final ? 'Final' : isToday ? "Today's game" : game.seasonType === 1 ? 'Preseason' : game.seasonType === 3 ? 'Playoffs' : 'Next game'
  const weekLabel = game.note || (game.week ? `${game.seasonType === 1 ? 'Preseason week' : 'Week'} ${game.week}` : null)
  const when = !live && !final
    ? game.timeValid
      ? new Date(game.date).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : `${new Date(game.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · kickoff TBD`
    : null
  const venueLine = !live && !final ? [game.venue, game.tv && `${game.tv}`].filter(Boolean).join(' · ') : null

  // Pre-game countdown: hours+minutes inside 12 hours, days beyond that (football is weekly).
  // A flexed game's placeholder time supports a day count but never an hours countdown — that
  // would contradict the "kickoff TBD" line beside it.
  const msToStart = state === 'pre' ? new Date(game.date).getTime() - now : null
  let countdown = null
  if (msToStart != null && msToStart > 0 && (game.timeValid || msToStart >= 12 * 3600 * 1000)) {
    if (msToStart < 12 * 3600 * 1000) {
      const h = Math.floor(msToStart / 3600000)
      const m = Math.floor((msToStart % 3600000) / 60000)
      countdown = h > 0 ? `Kickoff in ${h}h ${m}m` : `Kickoff in ${m}m`
    } else {
      const d = Math.round(msToStart / 86400000)
      countdown = `Kickoff in ${d} day${d === 1 ? '' : 's'}`
    }
  }

  // Share the game (native sheet on mobile, clipboard elsewhere). When embedded, share the
  // tracker's WPR page rather than the bare iframe URL (document.referrer is origin-only
  // under the default referrer policy, so it can't be the primary source).
  const share = () => {
    const url = window.self === window.top ? window.location.href : (WPR_EMBED_URL || document.referrer || SITE_URL)
    const text = live
      ? `Packers ${meScore}–${oppScore} ${game.home ? 'vs' : 'at'} the ${oppName} — live now`
      : final
      ? `Final: Packers ${won ? 'beat' : 'fall to'} the ${oppName}, ${won ? `${game.meScore}–${game.oppScore}` : `${game.oppScore}–${game.meScore}`}`
      : `Packers ${game.home ? 'vs' : 'at'} the ${oppName} — ${when}`
    track('Share', { context: kicker })
    if (navigator.share) {
      navigator.share({ title: 'Packers tracker — Wausau Pilot & Review', text, url }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${text} — ${url}`).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {})
    }
  }

  // Responsive sizing for phones / narrow iframes.
  const logoSize = narrow ? 54 : 72
  const nameSize = narrow ? 20 : 24
  const scoreSize = narrow ? 40 : 52
  const matchupGap = narrow ? 12 : 22

  // Called as a function, not rendered as <TeamBlock/>: declared in render as a component, each
  // live poll minted a new type and remounted both team logos on the page's busiest element.
  // On a phone with a score between them, the teams go by abbreviation — the TV score bug's
  // convention: "Buccaneers" plus a two-digit score is wider than the embed's ~280px.
  const teamBlock = (id, name) => (
    <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <TeamLogo id={id} size={logoSize} loading="eager" />
      <div style={{ fontFamily: theme.serif, fontSize: nameSize, color: theme.ink, lineHeight: 1.05 }}>
        {narrow && showScore ? <abbr title={name} style={{ textDecoration: 'none' }}>{TEAM_ABBRS[id] || name}</abbr> : name}
      </div>
    </div>
  )

  // The game so far under the win-probability bar: the Packers' chances play by play, kickoff
  // at the left edge, now at the right, the 50% line dashed. Thinned to ~120 points.
  // The swing plays (below) are marked on it: a dot where each landed, green when it swung Green
  // Bay's way, red when it didn't. HTML dots over the SVG — it stretches to the card's width
  // (preserveAspectRatio none), which would squash SVG circles into ovals.
  const renderSpark = (series, swings = []) => {
    if (!series || series.length < 4) return null
    const step = Math.max(1, Math.ceil(series.length / 120))
    const pts = series.filter((_, i) => i % step === 0 || i === series.length - 1)
    const W = 360, H = 34
    const line = pts.map((v, i) => `${((i / (pts.length - 1)) * W).toFixed(1)},${(H - (v / 100) * H).toFixed(1)}`).join(' ')
    return (
      <div aria-hidden="true" style={{ marginTop: 8 }}>
        <div style={{ position: 'relative' }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: 'block' }}>
            <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke={theme.muted} strokeOpacity="0.45" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <polyline points={`0,${H} ${line} ${W},${H}`} fill={theme.green} fillOpacity="0.08" stroke="none" />
            <polyline points={line} fill="none" stroke={theme.green} strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {swings.filter((s) => s.i < series.length).map((s) => (
            <span key={s.i} style={{ position: 'absolute', left: `${(s.i / (series.length - 1)) * 100}%`, top: H - (series[s.i] / 100) * H, width: 8, height: 8, margin: '-4px 0 0 -4px', borderRadius: '50%', background: s.delta > 0 ? theme.green : theme.red, boxShadow: `0 0 0 2px ${theme.wash}` }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 2 }}>
          <span>Kickoff</span><span>Now</span>
        </div>
      </div>
    )
  }

  const leaders = final && summary ? teamGameLeaders(summary) : []

  // What a final MEANS, not a second "Final": the record it leaves (regular season), what it
  // means for the season (playoffs), or — before the record loads, or preseason — the result.
  // Printed under the score and on the shareable card.
  const ot = final && /OT/i.test(game.detail)
  const resultLine = !final ? null
    : game.seasonType === 3
      ? won ? `Packers advance${ot ? ' in overtime' : ''}` : game.tied ? 'A tie' : `The Packers' season ends${ot ? ' in overtime' : ''}`
      : finalRecord
        ? won ? `Packers ${ot ? 'win in overtime and ' : ''}improve to ${finalRecord}`
          : game.tied ? `A tie — the Packers are ${finalRecord}`
            : `Packers ${ot ? 'lose in overtime and ' : ''}fall to ${finalRecord}`
        : won ? `Packers win${ot ? ' in overtime' : ''}` : null

  // The final-score card (share-card.js): the scoreboard, the result line, the game's
  // win-probability line and the top performers — all from the summary this card already holds.
  const shareFinal = async () => {
    const tie = game.tied
    const ok = await shareFinalCard({
      kicker: [`Final${ot ? '/OT' : ''}`, weekLabel, game.home ? 'at Lambeau' : `at ${game.city || game.venue}`].filter(Boolean).join(' · '),
      rows: [
        { name: 'Packers', score: game.meScore, color: theme.gold, won: tie ? null : !!game.won },
        { name: oppName, score: game.oppScore, color: TEAM_ACCENT[game.oppId] || '#888', won: tie ? null : !game.won },
      ],
      resultLine,
      wp: summary ? gameFlow(summary, game.home).points.map((p) => p.wp) : null,
      leaders,
      url: WPR_EMBED_URL || SITE_URL,
    })
    if (ok) { setCardShared(true); setTimeout(() => setCardShared(false), 2500) }
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', marginTop: 22, border: `1px solid ${theme.rule}`, borderTop: `4px solid ${theme.gold}`, borderRadius: 10, background: theme.wash, padding: narrow ? '24px 14px 22px' : '30px 24px 26px', textAlign: 'center' }}>
      {/* What the gold moments say, for screen readers: one status region that is ALWAYS mounted
          and changes its text — a role=status element inserted already filled is often never
          announced (Nov 2026 critique). The visual overlays themselves are aria-hidden. */}
      <div role="status" className="sr-only">
        {celebrate ? `Packers ${celebrate.kind}. Packers ${meScore}, ${oppName} ${oppScore}.`
          : clinchMoment ? `Clinched. ${clinchMoment.line}.` : ''}
      </div>
      {/* The touchdown moment (see the effect above). A tap dismisses it early. */}
      {celebrate && (
        <div aria-hidden="true" className="td-moment" onClick={() => setCelebrate(null)}
          style={{ position: 'absolute', inset: 0, zIndex: 2, background: theme.gold, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: narrow ? 8 : 10, padding: '20px 18px', cursor: 'pointer' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: theme.sans, fontSize: 12, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: theme.green }}>
            <TeamLogo id={TEAM_ID} size={22} /> Packers
          </div>
          <div className="td-word" style={{ fontFamily: theme.serif, fontWeight: 700, fontSize: narrow ? 42 : 68, lineHeight: 0.95, letterSpacing: '0.01em', textTransform: 'uppercase', color: theme.green }}>
            {celebrate.kind}
          </div>
          {celebrate.text && <div style={{ fontFamily: theme.sans, fontSize: narrow ? 13 : 14.5, color: theme.green, maxWidth: 440, lineHeight: 1.4 }}>{scoringText(celebrate.text)}</div>}
          <div style={{ fontFamily: theme.serif, fontSize: narrow ? 20 : 24, color: theme.green, marginTop: 2 }}>
            Packers {meScore}, {oppName} {oppScore}
          </div>
        </div>
      )}
      {/* The clinch moment — same sweep, once per level per device (effect above). A touchdown
          in progress keeps the stage; the clinch waits its turn. */}
      {clinchMoment && !celebrate && (
        <div aria-hidden="true" className="td-moment" onClick={() => setClinchMoment(null)}
          style={{ position: 'absolute', inset: 0, zIndex: 2, background: theme.gold, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: narrow ? 8 : 10, padding: '20px 18px', cursor: 'pointer' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: theme.sans, fontSize: 12, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: theme.green }}>
            <TeamLogo id={TEAM_ID} size={22} /> Packers · {SEASON}
          </div>
          <div className="td-word" style={{ fontFamily: theme.serif, fontWeight: 700, fontSize: narrow ? 46 : 72, lineHeight: 0.95, letterSpacing: '0.01em', textTransform: 'uppercase', color: theme.green }}>
            Clinched
          </div>
          <div style={{ fontFamily: theme.serif, fontSize: narrow ? 19 : 23, color: theme.green, maxWidth: 460, lineHeight: 1.25, textWrap: 'balance' }}>
            {clinchMoment.line}
          </div>
        </div>
      )}
      {/* Header */}
      <div style={{ fontFamily: theme.sans, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: live ? theme.goldText : theme.muted, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {live && <span className="live-dot" style={{ width: 9, height: 9, borderRadius: '50%', background: theme.gold }} />}
        {/* ESPN's "1:47 - 1st" → "1:47 · 1st", the separator the rest of the card uses. */}
        {kicker}{live && game.detail ? ` · ${game.detail.replace(/ - /g, ' · ')}` : ''}
      </div>
      {/* Once the math settles it, the card says so on every visit — a quiet gold chip. */}
      {CLINCH[clinch] && (
        <div style={{ marginTop: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: theme.gold, color: theme.green, fontFamily: theme.sans, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 12 }}>
            <span aria-hidden="true">✓</span> {CLINCH[clinch].badge}
          </span>
        </div>
      )}
      {(when || weekLabel || countdown) && (
        <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 6 }}>
          {[weekLabel, when].filter(Boolean).join(' · ')}
          {/* The countdown is the one fact here that changes while you look at it — it carries
              the weight instead of trailing a gray run-on line. */}
          {countdown && (
            <>
              {(weekLabel || when) && ' · '}
              <strong style={{ color: theme.ink, fontWeight: 700 }}>{countdown}</strong>
            </>
          )}
        </div>
      )}
      {venueLine && (
        <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 4 }}>{venueLine}</div>
      )}
      {!live && !final && forecast && (
        <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 5 }}>
          Kickoff forecast at Lambeau: {forecast.tempF}°F, {forecast.label} · {forecast.precipPct}% precip · {forecast.windMph} mph wind
          {SPONSORS.forecast && <> · <Sponsor sponsor={SPONSORS.forecast} compact slot="forecast" /></>}
        </div>
      )}

      {/* Matchup — a three-column grid, never a wrapping row: as a wrapping flex row, a phone put
          the opponent on a line of its own under "Packers 0–0" all game (found live, Oct 2026). */}
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr auto 1fr' : 'minmax(0, 190px) auto minmax(0, 190px)', justifyContent: 'center', alignItems: 'center', columnGap: matchupGap, margin: '22px 0 18px' }}>
        {teamBlock(TEAM_ID, 'Packers')}
        {showScore ? (
          <div aria-live="polite" className={pop ? 'score-pop' : undefined} style={{ display: 'flex', alignItems: 'center', gap: narrow ? 10 : 14, fontFamily: theme.serif, fontSize: scoreSize, lineHeight: 1, whiteSpace: 'nowrap' }}>
            {/* The visible score is bare digits; the hidden names make the live announcement
                "Packers 7, Lions 7" instead of "7 – 7". */}
            <span className="sr-only">Packers </span>
            <span style={{ color: won ? theme.green : theme.ink, fontWeight: won ? 700 : 400 }}>{meScore}</span>
            <span aria-hidden="true" style={{ fontSize: scoreSize * 0.5, color: theme.muted }}>–</span>
            <span className="sr-only">, {oppName} </span>
            <span style={{ color: theme.ink }}>{oppScore}</span>
          </div>
        ) : (
          <div style={{ fontFamily: theme.sans, fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted }}>{game.home ? 'vs' : 'at'}</div>
        )}
        {teamBlock(game.oppId, oppName)}
      </div>

      {/* Matchup context: opponent form + last meeting (upcoming). Live hero stays lean. */}
      {state === 'pre' && (() => {
        const stale = oppForm && oppForm.season != null && oppForm.season < new Date(game.date).getFullYear() - (new Date(game.date).getMonth() < 2 ? 1 : 0)
        const rec = oppForm ? `${oppForm.wins}–${oppForm.losses}${oppForm.ties ? `–${oppForm.ties}` : ''}` : null
        const oppText = oppForm
          ? stale
            ? `The ${oppName} went ${rec} last season${oppForm.seed && oppForm.seed <= 7 ? ` · ${ord(oppForm.seed)} ${oppForm.conf} seed` : ''}`
            : `The ${oppName} come in ${rec}${oppForm.streak ? ` · ${oppForm.streak}` : ''}${oppForm.seed && oppForm.seed <= 7 ? ` · ${ord(oppForm.seed)} ${oppForm.conf} seed` : ''}`
          : null
        const meetText = lastMeeting
          ? lastMeeting.tied
            ? `Last meeting: a ${lastMeeting.meScore}–${lastMeeting.oppScore} tie`
            : `Last meeting: ${lastMeeting.won ? 'Packers won' : `the ${oppName} won`} ${lastMeeting.won ? `${lastMeeting.meScore}–${lastMeeting.oppScore}` : `${lastMeeting.oppScore}–${lastMeeting.meScore}`}${lastMeeting.home ? ' at Lambeau' : ''}`
          : null
        // Division rivalry ledger: the last few meetings as W/L chips (oldest → newest) with
        // the series read. Non-division opponents keep the single last-meeting line.
        let ledger = null
        if (meetings) {
          const w = meetings.filter((m) => m.won).length
          const l = meetings.filter((m) => m.won === false && !m.tied).length
          const t = meetings.filter((m) => m.tied).length
          const readout = w > l ? `Packers lead ${w}–${l}` : l > w ? `${oppName} lead ${l}–${w}` : `Even at ${w}–${l}`
          ledger = (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', color: theme.green, fontWeight: 700 }}>
              <span>Last {meetings.length} meetings:</span>
              {[...meetings].reverse().map((m) => (
                <span key={m.id}
                  title={`${m.season} · ${m.tied ? `${m.meScore}–${m.oppScore} tie` : m.won ? `Packers ${m.meScore}–${m.oppScore}` : `${oppName} ${m.oppScore}–${m.meScore}`}${m.home ? ' at Lambeau' : ''}`}
                  style={{ width: 19, height: 19, borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, color: '#fff', background: m.tied ? theme.muted : m.won ? theme.green : theme.red }}>
                  {m.tied ? 'T' : m.won ? 'W' : 'L'}
                </span>
              ))}
              <span>· {readout}{t ? ` (${t} tie${t > 1 ? 's' : ''})` : ''}</span>
            </div>
          )
        }
        if (!oppText && !meetText && !ledger && fpi == null) return null
        return (
          <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, margin: '-6px 0 18px', lineHeight: 1.7 }}>
            {oppText && <div>{oppText}</div>}
            {ledger || (meetText && <div style={{ color: theme.green, fontWeight: 700 }}>{meetText}</div>)}
            {fpi != null && (
              <div>
                ESPN's Football Power Index gives the Packers a{' '}
                <span style={{ color: fpi >= 50 ? theme.green : theme.ink, fontWeight: 700 }}>{fpi}%</span> shot
              </div>
            )}
          </div>
        )
      })()}

      {/* Pregame: what this game is worth to the playoff odds (house model, fail-soft). */}
      {state === 'pre' && <GameStakes game={game} narrow={narrow} />}

      {/* Live situation: down & distance + win probability + latest plays */}
      {live && extras && (
        <div style={{ margin: '0 0 18px' }}>
          {extras.field ? (
            <div style={{ maxWidth: 640, margin: '0 auto' }}><LiveField field={extras.field} oppId={game.oppId} narrow={narrow} /></div>
          ) : extras.situation && (
            <div style={{ fontFamily: theme.sans, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: theme.green, marginBottom: 12 }}>
              {extras.situation}
            </div>
          )}
          {extras.mePct != null && (
            <div style={{ maxWidth: 360, margin: '0 auto' }}>
              <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted, marginBottom: 5 }}>Win probability</div>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: theme.rule }}>
                <div style={{ width: `${extras.mePct}%`, background: theme.green, transition: 'width 600ms ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: 12, marginTop: 4 }}>
                <span style={{ color: theme.green, fontWeight: 700 }}>Packers {extras.mePct}%</span>
                <span style={{ color: theme.muted }}>{oppName} {100 - extras.mePct}%</span>
              </div>
              {renderSpark(extras.wpSeries, extras.swings)}
            </div>
          )}
          {/* The plays that have moved the needle most so far — the turning-point list a fan
              arriving at halftime wants. Two on a phone, three on wider screens. */}
          {extras.swings?.length > 0 && (
            <div style={{ maxWidth: 460, margin: '14px auto 0', textAlign: 'left' }}>
              <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted, marginBottom: 4 }}>Biggest win-probability swings so far</div>
              {extras.swings.slice(0, narrow ? 2 : 3).map((s, i) => (
                <div key={s.i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', columnGap: 8, alignItems: 'baseline', fontFamily: theme.sans, fontSize: 12.5, color: theme.ink, lineHeight: 1.4, padding: '5px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none' }}>
                  <span style={{ fontFamily: theme.serif, fontSize: 15, fontWeight: 700, color: s.delta > 0 ? theme.green : theme.red, textAlign: 'right' }}>
                    <span className="sr-only">{`Packers win probability ${s.delta > 0 ? 'up' : 'down'} ${Math.abs(s.delta)} points:`}</span>
                    <span aria-hidden="true">{s.delta > 0 ? '+' : '−'}{Math.abs(s.delta)}</span>
                  </span>
                  <span>
                    <span style={{ color: theme.goldText, fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase' }}>{periodLabel(s.period)} {s.clock}</span>{' '}
                    {s.text.length > 100 ? s.text.slice(0, 99).replace(/\s+\S*$/, '') + '…' : s.text}
                  </span>
                </div>
              ))}
            </div>
          )}
          {extras.plays?.length > 0 && (
            <div style={{ maxWidth: 460, margin: '14px auto 0', textAlign: 'left' }}>
              <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted, marginBottom: 4 }}>Latest plays</div>
              {extras.plays.map((p, i) => (
                // A scoring play wears a gold band — the one play in the list that changed the score.
                <div key={i} style={{ fontFamily: theme.sans, fontSize: 12.5, color: p.scoring ? theme.ink : theme.muted, fontWeight: p.scoring ? 600 : 400, lineHeight: 1.4, padding: p.scoring ? '6px 8px' : '5px 0', margin: p.scoring ? '2px 0' : 0, borderRadius: p.scoring ? 5 : 0, background: p.scoring ? 'rgba(255, 182, 18, 0.2)' : 'transparent', borderTop: i && !p.scoring && !extras.plays[i - 1]?.scoring ? `1px solid ${theme.rule}` : 'none' }}>
                  <span style={{ color: theme.goldText, fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase' }}>{periodLabel(p.period)} {p.clock}</span>{' '}
                  {p.text.length > 110 ? p.text.slice(0, 109).replace(/\s+\S*$/, '') + '…' : p.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {final && resultLine && (
        <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 16, color: won ? theme.green : theme.ink, margin: '0 0 18px' }}>{resultLine}</div>
      )}

      {/* Quarter-by-quarter scoreboard */}
      {final && summary && <LinescoreStrip summary={summary} packersHome={game.home} oppName={oppName} />}

      {/* Top performers after a final */}
      {/* On a phone the three performers stack as one left-aligned list (centered as a block):
          wrapped and each centered on its own line, they stepped down the card at three
          different indents. */}
      {final && leaders.length > 0 && (
        <div style={narrow
          ? { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, width: 'fit-content', maxWidth: '100%', margin: '0 auto 18px' }
          : { display: 'flex', justifyContent: 'center', gap: 26, flexWrap: 'wrap', margin: '0 0 18px' }}>
          {leaders.map((l) => (
            <div key={l.cat} style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
              <img src={headshot(l.id, 34)} alt="" width={34} height={34} loading="lazy" decoding="async" style={{ borderRadius: '50%', objectFit: 'cover', background: theme.paper, flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
              <div>
                <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>{l.cat}</div>
                <div style={{ fontFamily: theme.sans, fontSize: 11.5, color: theme.ink }}>
                  <strong>{l.name}</strong> <span style={{ color: theme.muted }}>· {l.line}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* The final as a picture for the feed — the one share a fan actually wants after a game. */}
      {final && (
        <div style={{ margin: '0 0 14px' }}>
          <button type="button" onClick={shareFinal} className="link-hover"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: theme.green, color: '#fff', border: 'none', borderRadius: 20, padding: '10px 18px', fontFamily: theme.sans, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1v9M4.5 4.5 8 1l3.5 3.5M3 8.5V14h10V8.5" fill="none" stroke={theme.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {cardShared ? 'Card ready to post' : 'Share the final score'}
          </button>
        </div>
      )}

      {/* Sponsor */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Sponsor sponsor={SPONSORS.header} variant="light" compact slot="hero" />
      </div>

      {/* Share + opt-in game alert (alerts: standalone app only) */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <button onClick={share} className="link-hover" style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: '8px 4px', fontFamily: theme.sans, fontSize: 12, letterSpacing: '0.04em', color: copied ? theme.green : theme.muted, fontWeight: copied ? 700 : 400 }}>
          {copied ? 'Link copied' : 'Share this game'}
        </button>
        {canAlert && (
          <button onClick={toggleAlerts} className="link-hover" style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: '8px 4px', fontFamily: theme.sans, fontSize: 12, letterSpacing: '0.04em', color: alertsOn ? theme.green : theme.muted, fontWeight: alertsOn ? 700 : 400 }}>
            {alertsOn ? 'Game alerts on (while this tab is open)' : final || live ? 'Alert me at the next kickoff' : 'Alert me at kickoff'}
          </button>
        )}
      </div>
    </div>
  )
}
