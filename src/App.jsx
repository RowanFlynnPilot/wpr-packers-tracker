import { useEffect, useState, useCallback, Suspense } from 'react'
import { theme } from './theme.js'
import { SPONSOR_DISCLAIMER, SEASON, SPONSOR_INQUIRY, WPR_BADGE, PICKEM_TAB, DIVISION_NAME } from './config.js'
import { fetchStandingsBundle, fetchDivisionSchedules, fetchSeasonGames } from './api.js'
import { lastFinalGame } from './games.js'
import { initAnalytics, track } from './analytics.js'
import { setupAutoResize } from './autosize.js'
import { useInquiry } from './useInquiry.js'
import Masthead from './components/Masthead.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import TabBar from './components/TabBar.jsx'
import BookmarkButton from './components/BookmarkButton.jsx'
import PackersBanner from './components/PackersBanner.jsx'
import GameHero from './components/GameHero.jsx'
import Storylines from './components/Storylines.jsx'
import Matchup from './components/Matchup.jsx'
import Section from './components/Section.jsx'
import Pulse from './components/Pulse.jsx'
import PreseasonSlate from './components/PreseasonSlate.jsx'
import Standings from './components/Standings.jsx'
import VsNorth from './components/VsNorth.jsx'
import InjuryReport from './components/InjuryReport.jsx'
import WhereToWatch from './components/WhereToWatch.jsx'
import RaceDoor from './components/RaceDoor.jsx'
import GuessPromo from './components/GuessPromo.jsx'
import { Loading } from './components/Status.jsx'
import { lazyTab } from './lazyTab.js'

// Every tab but the default loads its code when first opened (lazyTab.js): the Season tab is
// what almost every reader sees, and it no longer carries the other five tabs' JavaScript.
const RaceTab = lazyTab(() => import('./tabs/RaceTab.jsx'))
const ScheduleTab = lazyTab(() => import('./tabs/ScheduleTab.jsx'))
const LeadersTab = lazyTab(() => import('./tabs/LeadersTab.jsx'))
const FilmTab = lazyTab(() => import('./tabs/FilmTab.jsx'))
const GuessGame = lazyTab(() => import('./components/GuessGame.jsx'))
const Pickem = lazyTab(() => import('./components/Pickem.jsx'))
import PlayerCardHost from './components/PlayerCard.jsx'

// The sections grouped into tabs (the page is too tall as one scroll). The featured-game hero
// lives on the default "Season" tab. Each tab renders only when active, so its heavier fetches
// fire only when a reader opens it (and the API memoizes them across revisits).
const TABS = [
  { id: 'season', label: 'Season' },
  // The playoff material has its own tab (Nov 2026): on one tab the Season page ran to almost
  // ten phone screens. `?tab=race` is also where a shared "Pick your path" link lands.
  { id: 'race', label: 'Playoff race', short: 'Race' },
  { id: 'schedule', label: 'Schedule', short: 'Sched.' },
  // Label follows the house sentence case ("Film room"); the id stays `leaders` so the
  // Plausible Tab events and panel ids keep their history. `short` labels keep five tabs
  // legible on phones (TabBar swaps them in below the narrow breakpoint).
  { id: 'leaders', label: 'Season stats', short: 'Stats' },
  { id: 'film', label: 'Film room', short: 'Film' },
  // The daily game — its own tab so `?tab=guess` can be a newsletter link.
  { id: 'guess', label: 'Guess the Packer', short: 'Guess' },
  { id: 'pickem', label: "Pick'em", short: 'Picks' },
]

// The tabs a visitor can see: the Pick'em tab stays hidden until PICKEM_TAB flips (config.js),
// except in sales demo mode, where the media kit previews the placement.
const visibleTabs = () => {
  const demo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')
  return PICKEM_TAB || demo ? TABS : TABS.filter((t) => t.id !== 'pickem')
}

// The Season tab tells the story the week is in, so its sections reorder by phase (Nov 2026
// critique: on game day the matchup and injuries sat below three screens of standings).
//   offseason — last season's finals + the countdown
//   week      — between games: where things stand; the next matchup trails
//   gameday   — kickoff inside 48 hours: the matchup and this week's injuries move up
//   live      — a Packers game is on: the door to the playoff race right under the venues
// The hero, the lede and the sold game-day venues hold the top three spots in every phase, so
// a sponsor's placement never slides around under it. `door` is the row through to the Playoff
// race tab, `game` the row through to the daily game.
const SEASON_ORDER = {
  offseason: ['hero', 'story', 'watch', 'game', 'matchup', 'standings', 'preseason'],
  week: ['hero', 'story', 'watch', 'game', 'standings', 'door', 'matchup'],
  gameday: ['hero', 'story', 'watch', 'matchup', 'injuries', 'standings', 'door', 'game'],
  live: ['hero', 'story', 'watch', 'door', 'standings', 'matchup', 'game'],
}
const GAMEDAY_MS = 48 * 3600 * 1000

function seasonPhase(bundle, games) {
  if (!bundle || bundle.season !== SEASON || !games) return 'offseason'
  if (games.some((g) => g.state === 'in')) return 'live'
  const next = games.find((g) => g.state === 'pre' && g.seasonType !== 1)
  return next && new Date(next.date) - Date.now() < GAMEDAY_MS ? 'gameday' : 'week'
}

// Subtle "Updated Xm ago" stamp; re-renders every 30s so the relative time stays current.
function UpdatedStamp({ at }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])
  if (!at) return null
  const mins = Math.floor((Date.now() - at) / 60000)
  const label = mins < 1 ? 'just now' : mins === 1 ? '1 min ago' : `${mins} min ago`
  return (
    <div style={{ textAlign: 'right', fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.gold }} /> Updated {label} · refreshes live
      </span>
    </div>
  )
}

export default function App() {
  // The standings bundle + division schedules are fetched here and shared (Pulse, Standings,
  // Race, form strips); other modules fetch their own feeds.
  const [bundle, setBundle] = useState(null)
  const [schedules, setSchedules] = useState(null)
  const [teamGames, setTeamGames] = useState(null) // the Packers' season: phase + countdown chip
  const [updatedAt, setUpdatedAt] = useState(null)
  // Per-feed failure flags so a failed FIRST load shows an error state instead of an eternal
  // skeleton. Once a feed has data, later failures keep the prior data (flag cleared on success).
  const [errors, setErrors] = useState({})
  // Tabs are deep-linkable: `?tab=schedule` opens there (so WPR articles can link straight to
  // a section), and switching tabs rewrites the param via replaceState — no history spam.
  const [tab, setTab] = useState(() => {
    const q = new URLSearchParams(window.location.search)
    const t = q.get('tab')
    if (visibleTabs().some((x) => x.id === t)) return t
    return q.has('path') ? 'race' : 'season' // a shared "Pick your path" link opens on its tab
  })

  // Refresh on a gentle interval (and on tab focus) so the whole page — not just the hero — stays live.
  const load = useCallback(() => {
    const flag = (key, v) => setErrors((e) => (e[key] === v ? e : { ...e, [key]: v }))
    fetchStandingsBundle()
      .then((b) => {
        setBundle(b)
        setUpdatedAt(Date.now())
        flag('standings', false)
        // Schedules get their own failure flag — a race-chart problem shouldn't read as a
        // standings problem (and vice versa its skeleton should resolve to an error state).
        return fetchDivisionSchedules(b.season)
          .then((s) => { setSchedules(s); flag('schedules', false) })
          .catch(() => flag('schedules', true))
      })
      // A standings failure also blocks the schedules fetch (it needs the season), so both
      // flags flip — otherwise the race chart skeletons forever instead of showing its error.
      .catch(() => { flag('standings', true); flag('schedules', true) })
    fetchSeasonGames()
      .then(({ games }) => setTeamGames(games))
      .catch(() => {})
  }, [])

  useEffect(() => {
    initAnalytics()
    setupAutoResize()
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 120000)
    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  const changeTab = (id) => {
    if (id === tab) return // re-clicking the active tab is not a tab view
    setTab(id)
    track('Tab', { tab: id })
    // Standalone, scroll ourselves; embedded, the auto-sized iframe has no inner scroll, so
    // ask the host to bring the widget's top back into view (snippet in the README) — without
    // this a reader deep in one tab lands stranded mid-way down the next.
    if (window.self === window.top) window.scrollTo(0, 0)
    else window.parent.postMessage({ type: 'wpr-packers-scroll' }, '*')
    const url = new URL(window.location)
    if (id === 'season') url.searchParams.delete('tab') // the default tab keeps a clean URL
    else url.searchParams.set('tab', id)
    window.history.replaceState(null, '', url)
  }

  const lastGame = schedules ? lastFinalGame(schedules) : null
  const raceSeason = bundle?.season ?? SEASON
  const opener = teamGames ? teamGames.find((g) => g.seasonType === 2 && g.state === 'pre') || null : null
  const phase = seasonPhase(bundle, teamGames)

  // The Season tab's sections, keyed so a phase change REORDERS them without
  // remounting (the hero keeps its live state across the flip to "live").
  const seasonBlocks = {
    hero: <GameHero key="hero" />,
    story: <Storylines key="story" />,
    // Sold game-day venues ride on the default tab too, after the lede so the game card and its
    // story stay together; the full guide is on Schedule.
    watch: <WhereToWatch key="watch" compact />,
    matchup: <Matchup key="matchup" />,
    injuries: <InjuryReport key="injuries" weekOnly />,
    // The Pulse figures and the division table were two sections saying "where things stand"
    // one after the other; they're one now.
    standings: (
      <Section key="standings" kicker={DIVISION_NAME} title="Where things stand">
        <Pulse bundle={bundle} lastGame={lastGame} opener={opener} error={errors.standings} />
        {bundle && <div style={{ marginTop: 26 }}><Standings bundle={bundle} schedules={schedules} /></div>}
        <VsNorth />
      </Section>
    ),
    preseason: <PreseasonSlate key="preseason" />,
    // The door to the daily game: high on quiet days, out of the way on game day.
    game: <GuessPromo key="game" onPlay={() => changeTab('guess')} />,
    door: <RaceDoor key="door" bundle={bundle} onOpen={() => changeTab('race')} />,
  }

  // ?demo pages look identical to the live page — a forwarded demo link explains itself.
  const demo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')
  const embedded = typeof window !== 'undefined' && window.self !== window.top
  const ribbonInquiry = useInquiry('demo-ribbon')

  return (
    <div style={{ background: theme.paper, color: theme.ink, minHeight: '100vh' }}>
      {demo && (
        <div style={{ background: theme.gold, color: theme.green, fontFamily: theme.sans, fontSize: 11.5, fontWeight: 700, textAlign: 'center', padding: '7px 14px' }}>
          Sales preview — open placements are shown filled with samples.{' '}
          <a href={`mailto:${SPONSOR_INQUIRY}?subject=${encodeURIComponent('Packers tracker sponsorship')}`}
            onClick={ribbonInquiry.onClick}
            style={{ color: theme.green, textDecoration: 'underline' }}>
            {ribbonInquiry.copied ? '✓ Address copied' : 'Book a placement'}
          </a>
        </div>
      )}
      {/* Keyboard and screen-reader users skip the masthead, banner and title-sponsor card
          straight to the tabs and the game (hidden until focused — styles.css .skip-link). */}
      <a href="#main" className="skip-link">Skip to the tracker</a>
      {/* Embedded in WPR's own page, the site's header already sits right above the iframe; a
          second Wausau Pilot & Review masthead cost phones ~180px before the game (Oct 2026
          critique). The standalone page — and the media kit and rules pages — keep it. */}
      {!embedded && <Masthead />}
      <PackersBanner />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 20px' }}>
        <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
        <ErrorBoundary>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0 0' }}>
          <BookmarkButton />
          <UpdatedStamp at={updatedAt} />
        </div>
        <TabBar tabs={visibleTabs()} active={tab} onChange={changeTab} />

        {tab === 'season' && (
          <div role="tabpanel" id="panel-season" aria-labelledby="tab-season" data-phase={phase}>
            {SEASON_ORDER[phase].map((k) => seasonBlocks[k])}
          </div>
        )}

        {/* The other tabs arrive as their own chunks; the skeleton holds the place meanwhile. */}
        <Suspense fallback={<div style={{ padding: '28px 0' }}><Loading lines={4} /></div>}>
          {tab === 'race' && (
            <div role="tabpanel" id="panel-race" aria-labelledby="tab-race">
              <RaceTab bundle={bundle} schedules={schedules} raceSeason={raceSeason} schedulesError={errors.schedules} live={phase === 'live'} />
            </div>
          )}
          {tab === 'schedule' && <div role="tabpanel" id="panel-schedule" aria-labelledby="tab-schedule"><ScheduleTab /></div>}
          {tab === 'leaders' && <div role="tabpanel" id="panel-leaders" aria-labelledby="tab-leaders"><LeadersTab /></div>}
          {tab === 'film' && <div role="tabpanel" id="panel-film" aria-labelledby="tab-film"><FilmTab /></div>}
          {tab === 'guess' && <div role="tabpanel" id="panel-guess" aria-labelledby="tab-guess"><GuessGame /></div>}
          {tab === 'pickem' && <div role="tabpanel" id="panel-pickem" aria-labelledby="tab-pickem"><Pickem /></div>}
        </Suspense>

        <PlayerCardHost />
        </ErrorBoundary>
        </main>
        <footer style={{ borderTop: `1px solid ${theme.rule}`, padding: '22px 0 44px', fontFamily: theme.sans, fontSize: 11, color: theme.muted, lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <img src={WPR_BADGE} alt="" width={44} height={44} loading="lazy" decoding="async"
            style={{ flexShrink: 0, marginTop: 2 }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <div>
            Data via ESPN's public NFL feeds · refreshes live. Not affiliated with or endorsed by the NFL, the Green Bay Packers, or ESPN.<br />
            {SPONSOR_DISCLAIMER && <>{SPONSOR_DISCLAIMER}<br /></>}
            Wausau Pilot &amp; Review · 715-301-5539 ·{' '}
            <a href="sponsors.html" target="_blank" rel="noopener noreferrer" className="link-hover" style={{ display: 'inline-block', padding: '6px 0', color: theme.green, fontWeight: 700, textDecoration: 'none' }}>
              Advertise on this tracker
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
