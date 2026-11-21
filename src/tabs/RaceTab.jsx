import { SPONSORS, DIVISION_NAME } from '../config.js'
import Section from '../components/Section.jsx'
import PlayoffPicture from '../components/PlayoffPicture.jsx'
import PlayoffOdds from '../components/PlayoffOdds.jsx'
import RootingGuide from '../components/RootingGuide.jsx'
import PickYourPath from '../components/PickYourPath.jsx'
import RoadAhead from '../components/RoadAhead.jsx'
// Plain SVG — recharts (the film room's chart) stays out of this tab too.
import Race from '../components/Race.jsx'

// The Playoff race tab: where they stand, how likely, what moves it this week, the reader's own
// path, then the division chart and the schedule's difficulty. While a Packers game is on, the
// scores that matter elsewhere lead. Blocks are keyed so the reorder doesn't remount them.
const ORDER = {
  live: ['guide', 'picture', 'odds', 'path', 'race', 'road'],
  other: ['picture', 'odds', 'guide', 'path', 'race', 'road'],
}

export default function RaceTab({ bundle, schedules, raceSeason, schedulesError, live }) {
  const blocks = {
    picture: <PlayoffPicture key="picture" bundle={bundle} />,
    odds: <PlayoffOdds key="odds" />,
    guide: <RootingGuide key="guide" />,
    path: <PickYourPath key="path" />,
    race: (
      <Section key="race" kicker="The division race" title={`${DIVISION_NAME}, week by week`} sponsor={SPONSORS.race} slot="race">
        <Race schedules={schedules} season={raceSeason} error={schedulesError} />
      </Section>
    ),
    road: <RoadAhead key="road" />,
  }
  return ORDER[live ? 'live' : 'other'].map((k) => blocks[k])
}
