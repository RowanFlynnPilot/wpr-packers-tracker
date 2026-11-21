import { WPR_NEWS } from '../config.js'
import Section from '../components/Section.jsx'
import WhereToWatch from '../components/WhereToWatch.jsx'
import Schedule from '../components/Schedule.jsx'
import NextAtLambeau from '../components/NextAtLambeau.jsx'
import ColdLedger from '../components/ColdLedger.jsx'
import InjuryReport from '../components/InjuryReport.jsx'
import Coverage from '../components/Coverage.jsx'
import SponsorBand from '../components/SponsorBand.jsx'
import ThisDay from '../components/ThisDay.jsx'

// The Schedule tab. The game-day guide leads it — prime placement is the product being sold.
export default function ScheduleTab() {
  return (
    <>
      <WhereToWatch />
      <Section kicker="The season" title="The schedule"><Schedule /></Section>
      <NextAtLambeau />
      <ColdLedger />
      <InjuryReport />
      {WPR_NEWS && <Coverage />}
      <SponsorBand />
      <ThisDay />
    </>
  )
}
