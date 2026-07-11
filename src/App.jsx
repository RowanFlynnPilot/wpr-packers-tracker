import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { theme } from './theme.js'
import { SPONSOR_DISCLAIMER, WATCH_PARTY, WPR_NEWS, SPONSORS, SEASON } from './config.js'
import { fetchStandingsBundle, fetchDivisionSchedules, fetchSeasonGames } from './api.js'
import { lastFinalGame } from './games.js'
import { initAnalytics, track } from './analytics.js'
import { setupAutoResize } from './autosize.js'
import Masthead from './components/Masthead.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import TabBar from './components/TabBar.jsx'
import BookmarkButton from './components/BookmarkButton.jsx'
import PackersBanner from './components/PackersBanner.jsx'
import GameHero from './components/GameHero.jsx'
import Matchup from './components/Matchup.jsx'
import Section from './components/Section.jsx'
import Pulse from './components/Pulse.jsx'
import Standings from './components/Standings.jsx'
import VsNorth from './components/VsNorth.jsx'
import Schedule from './components/Schedule.jsx'
import NextAtLambeau from './components/NextAtLambeau.jsx'
import InjuryReport from './components/InjuryReport.jsx'
import Coverage from './components/Coverage.jsx'
import SponsorBand from './components/SponsorBand.jsx'
import WhereToWatch from './components/WhereToWatch.jsx'
import ThisDay from './components/ThisDay.jsx'
import Leaders from './components/Leaders.jsx'
import TeamProfile from './components/TeamProfile.jsx'
import PlayoffOdds from './components/PlayoffOdds.jsx'
import RoadAhead from './components/RoadAhead.jsx'
import FilmRoom from './components/FilmRoom.jsx'
import PlayerCardHost from './components/PlayerCard.jsx'
import { Loading } from './components/Status.jsx'

// Recharts is the heaviest dependency — load the race chart in its own chunk.
const Race = lazy(() => import('./components/Race.jsx'))

// The sections grouped into tabs (the page is too tall as one scroll). The featured-game hero
// lives on the default "Season" tab. Each tab renders only when active, so its heavier fetches
// fire only when a reader opens it (and the API memoizes them across revisits).
const TABS = [
  { id: 'season', label: 'Season' },
  { id: 'schedule', label: 'Schedule' },
  // Label follows the house sentence case ("Film room"); the id stays `leaders` so the
  // Plausible Tab events and panel ids keep their history.
  { id: 'leaders', label: 'Season stats' },
  { id: 'film', label: 'Film room' },
]

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
  const [opener, setOpener] = useState(null) // the next regular-season kickoff (countdown chip)
  const [updatedAt, setUpdatedAt] = useState(null)
  // Per-feed failure flags so a failed FIRST load shows an error state instead of an eternal
  // skeleton. Once a feed has data, later failures keep the prior data (flag cleared on success).
  const [errors, setErrors] = useState({})
  const [tab, setTab] = useState('season')

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
      .then(({ games }) => setOpener(games.find((g) => g.seasonType === 2 && g.state === 'pre') || null))
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

  const changeTab = (id) => { setTab(id); track('Tab', { tab: id }); window.scrollTo(0, 0) }

  const lastGame = schedules ? lastFinalGame(schedules) : null
  const raceSeason = bundle?.season ?? SEASON

  return (
    <div style={{ background: theme.paper, color: theme.ink, minHeight: '100vh' }}>
      <Masthead />
      <PackersBanner />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 20px' }}>
        <ErrorBoundary>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0 0' }}>
          <BookmarkButton />
          <UpdatedStamp at={updatedAt} />
        </div>
        <TabBar tabs={TABS} active={tab} onChange={changeTab} />

        {tab === 'season' && (
          <div role="tabpanel" id="panel-season" aria-labelledby="tab-season">
            <GameHero />
            <Matchup />
            <Section kicker="Season pulse" title="Where things stand"><Pulse bundle={bundle} lastGame={lastGame} opener={opener} error={errors.standings} /></Section>
            <Section kicker="NFC North" title="The standings"><Standings bundle={bundle} schedules={schedules} error={errors.standings} /><VsNorth /></Section>
            <Section kicker="The division race" title="NFC North, week by week" sponsor={SPONSORS.race} slot="race">
              <Suspense fallback={<Loading block />}><Race schedules={schedules} season={raceSeason} error={errors.schedules} /></Suspense>
            </Section>
            <PlayoffOdds />
            <RoadAhead />
          </div>
        )}

        {tab === 'schedule' && (
          <div role="tabpanel" id="panel-schedule" aria-labelledby="tab-schedule">
            <Section kicker="The season" title="The schedule"><Schedule /></Section>
            <NextAtLambeau />
            <InjuryReport />
            {WPR_NEWS && <Coverage />}
            <SponsorBand />
            {WATCH_PARTY && <Section kicker="Where to watch" title="Catch the games this week"><WhereToWatch venue={WATCH_PARTY} /></Section>}
            <ThisDay />
          </div>
        )}

        {tab === 'leaders' && (
          <div role="tabpanel" id="panel-leaders" aria-labelledby="tab-leaders">
            <Section kicker="Moving the ball" title="Offensive leaders" sponsor={SPONSORS.leaders} slot="leaders"><Leaders side="offense" /></Section>
            <Section kicker="Getting stops" title="Defensive leaders"><Leaders side="defense" /></Section>
            <TeamProfile />
          </div>
        )}

        {tab === 'film' && <div role="tabpanel" id="panel-film" aria-labelledby="tab-film"><FilmRoom /></div>}

        <PlayerCardHost />
        </ErrorBoundary>
        <footer style={{ borderTop: `1px solid ${theme.rule}`, padding: '22px 0 44px', fontFamily: theme.sans, fontSize: 11, color: theme.muted, lineHeight: 1.6 }}>
          Data via ESPN's public NFL feeds · refreshes live. Not affiliated with or endorsed by the NFL, the Green Bay Packers, or ESPN.<br />
          {SPONSOR_DISCLAIMER && <>{SPONSOR_DISCLAIMER}<br /></>}
          Wausau Pilot &amp; Review · 715-301-5539
        </footer>
      </div>
    </div>
  )
}
