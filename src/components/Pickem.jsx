import { useEffect, useRef, useState, useCallback } from 'react'
import { theme } from '../theme.js'
import { SEASON, TEAM_ID, SPONSORS, REGULAR_SEASON_WEEKS, WPR_EMBED_URL } from '../config.js'
import { fetchPickemWeek, fetchScoreboardWeek, fetchWeekProjections } from '../api.js'
import { tiebreakGame, bestCall } from '../games.js'
import { readStore, writeStore, settlePastWeeks, weekResult, seasonTally } from '../pickem.js'
import { shareStatCard } from '../share-card.js'
import { track } from '../analytics.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { Loading } from './Status.jsx'
import Section from './Section.jsx'
import PickemLedger from './PickemLedger.jsx'
import PickRow from './PickRow.jsx'

// The weekly NFL pick'em: every game on the slate, tap a side, graded as the finals land — with
// the reader's season kept alongside. No accounts and no backend by design: picks live in THIS
// browser (src/pickem.js), so the opponent is ESPN's FPI model, graded on the same calls, and
// the reader's own record — and that's said out loud on the card. Week resolution and grading
// ride the scoreboard feed; each row's percentages are FPI's pregame projection, or the live
// win probability once a game is on. Any regular-season week is one tap away on the rail —
// past weeks to review, the next one to call early. Past weeks settle into stored results the
// first time the card loads after their last game (one fetch each, once). A tiebreaker (total
// points in the Packers game) and two share cards round out a contest-grade sheet.

const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
const fmtShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtLock = (iso) => new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })

// "Sep 24–28" / "Sep 30 – Oct 5" from a kickoff-sorted slate.
function weekRange(games) {
  const a = new Date(games[0].date), b = new Date(games[games.length - 1].date)
  return a.getMonth() === b.getMonth() ? `${fmtShort(a)}–${b.getDate()}` : `${fmtShort(a)} – ${fmtShort(b)}`
}

// "2d 4h" / "3h 20m" / "12m" until a kickoff.
function until(iso) {
  const m = Math.floor((new Date(iso) - Date.now()) / 60000)
  if (m < 1) return 'moments'
  const h = Math.floor(m / 60), d = Math.floor(h / 24)
  return d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h ${m % 60}m` : `${m}m`
}

const rec = (r) => `${r.correct}–${r.total - r.correct}`
const site = WPR_EMBED_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
// Pickable until the feed flips the game live OR the clock passes kickoff, whichever is first —
// the scoreboard memo can lag a kickoff by up to a minute.
const pickable = (g) => g.state === 'pre' && (!g.timeValid || new Date(g.date) > Date.now())

export default function Pickem() {
  const [week, setWeek] = useState(undefined)   // league week: undefined resolving, null = no regular season on the clock
  const [view, setView] = useState(null)        // the week on screen; follows the league week until the reader taps the rail
  const touched = useRef(false)
  const viewRef = useRef(null)
  const [slates, setSlates] = useState({})      // { [week]: games } — the viewed week and the league week
  const [proj, setProj] = useState({})          // { [week]: FPI projections by game id }
  const [failed, setFailed] = useState(false)   // the viewed week's slate didn't load
  const [store, setStore] = useState(readStore)
  const [shared, setShared] = useState(null)    // which card just went out: 'card' | 'week'
  const [, setTick] = useState(0)               // the lock countdown re-renders on a slow tick
  viewRef.current = view
  const narrow = useIsNarrow()

  const loadSlate = useCallback((wk) => {
    if (wk == null) return
    fetchScoreboardWeek(wk).then((games) => {
      setSlates((s) => ({ ...s, [wk]: games }))
      if (wk === viewRef.current) setFailed(false)
      fetchWeekProjections(games).then((p) => setProj((m) => ({ ...m, [wk]: p }))).catch(() => {})
    }).catch(() => { if (wk === viewRef.current) setFailed(true) })
  }, [])

  // The league clock → this week; settle any past weeks; the viewed week follows the clock
  // until the reader has picked one (postseason/offseason: the last settled week, if any).
  const load = useCallback(() => {
    fetchPickemWeek().then(async (wk) => {
      setWeek(wk)
      if (wk != null) loadSlate(wk)
      const settled = await settlePastWeeks(wk ?? REGULAR_SEASON_WEEKS + 1)
      if (settled) setStore(settled)
      if (!touched.current) {
        const s = settled || readStore()
        const last = Object.keys(s).filter((k) => s[k]?.result).map(Number).sort((a, b) => b - a)[0]
        setView(wk ?? last ?? null)
      }
    }).catch(() => setWeek(null))
  }, [loadSlate])

  useEffect(() => {
    load()
    const refresh = setInterval(() => { if (!document.hidden) { load(); loadSlate(viewRef.current) } }, 120000)
    const tick = setInterval(() => setTick((t) => t + 1), 30000)
    return () => { clearInterval(refresh); clearInterval(tick) }
  }, [load, loadSlate])

  useEffect(() => { setFailed(false); loadSlate(view) }, [view, loadSlate])

  // Every write goes through the store fresh (another tab may have picked too), then re-renders.
  const update = (fn) => {
    const s = readStore()
    const e = s[view] || (s[view] = { picks: {} })
    e.picks = e.picks || {}
    fn(e)
    writeStore(s)
    setStore(s)
  }
  const pick = (g, teamId) => {
    update((e) => { if (e.picks[g.id] === teamId) delete e.picks[g.id]; else e.picks[g.id] = teamId })
    track('Pickem Pick', { week: view })
  }
  const setTiebreak = (raw) => update((e) => {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 0) e.tiebreak = Math.min(n, 200)
    else delete e.tiebreak
  })
  const openWeek = (wk) => {
    if (wk === view) return
    touched.current = true
    setView(wk)
    setShared(null)
    track('Pickem Week', { week: wk })
  }

  const games = view != null ? slates[view] : null
  const entry = store[view] || {}
  const picks = entry.picks || {}
  const viewProj = proj[view] || {}
  const result = games ? weekResult(games, entry, viewProj) : null
  // The league week's live result feeds the season tally even while another week is open.
  const liveResult = week == null ? null
    : week === view ? result
    : slates[week] ? weekResult(slates[week], store[week] || {}, proj[week] || {}) : null
  const tally = seasonTally(store, week, liveResult)

  // This is a whole TAB, so unlike the fail-soft sections it never renders blank: before the
  // slate exists it says so, and a fetch failure shows a note rather than empty chrome.
  const shell = (body) => (
    <Section kicker="The pick'em" title="Call the week" sponsor={SPONSORS.pickem} slot="pickem">{body}</Section>
  )
  const note = (text) => <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>{text}</div>
  if (week === undefined) return shell(note('Loading the week’s slate…'))
  if (view == null) return shell(note('Picks open when the season’s slate is posted.'))

  // Per-row percentage: the live win probability while a game is on, FPI's projection otherwise.
  const pctFor = (g) => {
    if (g.state === 'in' && g.homeWinPct != null) return { home: g.homeWinPct, away: 100 - g.homeWinPct }
    const p = viewProj[g.id]
    return p ? { home: Math.round(p.home), away: Math.round(p.away) } : null
  }

  const pickedCount = games ? games.filter((g) => picks[g.id]).length : 0
  const open = games ? games.filter(pickable) : []
  const nextLock = open[0]?.timeValid ? open[0] : null   // kickoff-sorted, so the first open game locks first
  const finals = games ? games.filter((g) => g.completed).length : 0
  const onNow = games ? games.filter((g) => g.state === 'in').length : 0
  const early = week != null && view > week

  let status = ''
  if (games?.length) {
    const lock = nextLock ? `${fmtLock(nextLock.date)} (in ${until(nextLock.date)})` : null
    if (open.length === games.length) {
      status = pickedCount === 0
        ? `Tap a team to call each game — picks lock at kickoff${lock ? `, first ${lock}` : ''}.`
        : pickedCount < games.length
        ? `${games.length - pickedCount} still to call — first lock ${lock || 'at kickoff'}.`
        : `Every game called${lock ? ` — first kickoff ${lock}` : ''}. Come back as the finals land.`
    } else if (finals < games.length) {
      status = `${finals} of ${games.length} final${onNow ? `, ${onNow} on now` : ''}`
        + (open.length ? ` — ${open.length} still open${pickedCount < games.length ? `, ${games.length - pickedCount} uncalled` : ''}.` : '.')
    } else {
      status = result.total ? `Week’s done: you went ${rec(result)}.` : 'Week’s done — no picks were in.'
    }
  }
  const m = result?.model
  const diff = m ? m.mine - m.correct : 0
  const modelLine = m?.total
    ? `ESPN’s FPI went ${m.correct}–${m.total - m.correct} on the same games — ${diff > 0 ? `you’re ${diff} up` : diff < 0 ? `it’s ${-diff} up on you` : 'dead level'}${result.pending ? ' so far' : ''}.`
    : null
  const best = games && result?.total ? bestCall(games, picks, viewProj) : null
  const bestLine = best && best.pct < 50 ? `Best call: ${best.team.name} over the ${best.over.name} — FPI had them at ${best.pct}%.` : null

  const tb = games ? tiebreakGame(games) : null
  const tiebreak = tb ? {
    value: entry.tiebreak ?? null, onChange: setTiebreak,
    locked: !pickable(tb), actual: tb.completed ? tb.home.score + tb.away.score : null,
  } : null

  // Two cards for the feed: the sheet before kickoff ("post your card"), the record after.
  const share = async (card) => {
    const ok = await shareStatCard(card === 'card' ? {
      card: 'pickem-card',
      kicker: `The pick’em · Week ${view}`,
      headline: `My Week ${view} card`,
      chips: games.filter((g) => picks[g.id]).map((g) => {
        const t = picks[g.id] === g.home.id ? g.home : g.away
        return { text: t.abbr, accent: t.id === TEAM_ID }
      }),
      stats: [
        { value: `${pickedCount}/${games.length}`, label: 'Called' },
        entry.tiebreak != null && { value: entry.tiebreak, label: 'Tiebreaker' },
        tally.total > 0 && { value: rec(tally), label: 'Season' },
      ].filter(Boolean),
      footnote: site,
    } : {
      card: 'pickem-week',
      kicker: `The pick’em · Week ${view}`,
      headline: result.pending ? `${result.correct} of ${result.total} so far in Week ${view}` : `I called ${result.correct} of ${result.total} in Week ${view}`,
      stats: [
        { value: rec(result), label: 'This week' },
        m?.total > 0 && { value: `${m.correct}–${m.total - m.correct}`, label: "ESPN's FPI" },
        tally.total > result.total && { value: rec(tally), label: 'Season' },
        tally.total > 0 && { value: `${Math.round((tally.correct / tally.total) * 100)}%`, label: 'Accuracy' },
      ].filter(Boolean),
      footnote: site,
    })
    if (ok) { setShared(card); setTimeout(() => setShared(null), 2500) }
  }
  const shareButton = (card, label) => (
    <button onClick={() => share(card)} className="link-hover"
      style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0, fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.04em', color: shared === card ? theme.green : theme.muted, fontWeight: shared === card ? 700 : 400 }}>
      {shared === card ? 'Card ready to post' : label}
    </button>
  )

  let lastDay = ''
  return shell(
    <div>
      <PickemLedger tally={tally} store={store} liveWeek={week} view={view} onView={openWeek} />

      {failed ? note('The slate isn’t loading right now — it usually clears on the next refresh.')
        : !games ? <div style={{ marginTop: 22 }}><Loading lines={4} /></div>
        : !games.length ? note(`Week ${view}’s slate isn’t posted yet.`)
        : (
          <>
            {/* The reader's card. Always visible, from an empty sheet onward: a pick'em with no
                running score is a form, and a form is not a habit. The bar makes "you have four
                left" a glance instead of a count; the lock countdown makes the deadline real. */}
            <div style={{ borderTop: `2px solid ${theme.green}`, borderBottom: `1px solid ${theme.rule}`, padding: '12px 0 14px', margin: '22px 0 6px' }}>
              <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700, marginBottom: 6 }}>
                Week {view} · {weekRange(games)}{early ? ' · open early' : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: theme.serif, fontSize: 22, color: theme.ink, lineHeight: 1 }}>
                  {pickedCount} <span style={{ fontSize: 15, color: theme.muted }}>of {games.length} called</span>
                </div>
                {result.total > 0 && (
                  <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted }}>
                    This week <strong style={{ color: result.correct * 2 >= result.total ? theme.green : theme.red, fontSize: 13 }}>{rec(result)}</strong>
                    {result.pending > 0 && <span> · {result.pending} to play</span>}
                  </div>
                )}
              </div>
              <div style={{ height: 4, borderRadius: 2, background: theme.rule, marginTop: 10, overflow: 'hidden' }} aria-hidden="true">
                {/* Scaled, not widened: animating width relayouts the bar on every frame. */}
                <div style={{ width: '100%', height: '100%', borderRadius: 2, background: theme.gold, transformOrigin: 'left', transform: `scaleX(${pickedCount / games.length})`, transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }} />
              </div>
              <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 9 }}>{status}</div>
              {(modelLine || bestLine) && (
                <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.ink, marginTop: 5, lineHeight: 1.5 }}>
                  {modelLine}{modelLine && bestLine ? ' ' : ''}{bestLine}
                </div>
              )}
            </div>

            {games.map((g) => {
              const day = fmtDay(g.date)
              const dayLabel = day !== lastDay ? (lastDay = day) : null
              return (
                <div key={g.id}>
                  {dayLabel && (
                    <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700, margin: '16px 0 6px' }}>
                      {dayLabel}
                    </div>
                  )}
                  <PickRow game={g} pick={picks[g.id]} pct={pctFor(g)} pickable={pickable(g)} onPick={(id) => pick(g, id)}
                    packers={g.home.id === TEAM_ID || g.away.id === TEAM_ID} tiebreak={tb?.id === g.id ? tiebreak : null} narrow={narrow} />
                </div>
              )
            })}

            {((pickedCount > 0 && open.length > 0) || result.total > 0) && (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14 }}>
                {pickedCount > 0 && open.length > 0 && shareButton('card', 'Post your card')}
                {result.total > 0 && shareButton('week', 'Share your week')}
              </div>
            )}

            <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 10, lineHeight: 1.5 }}>
              Bragging rights only — picks live in this browser and lock at kickoff, graded as the finals land.
              Percentages are ESPN’s FPI pregame projection (the live win probability while a game is on). Week {view} of {SEASON}.
            </div>
          </>
        )}
    </div>
  )
}
