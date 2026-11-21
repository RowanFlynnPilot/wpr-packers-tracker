import { SPONSORS } from '../config.js'
import Section from '../components/Section.jsx'
import MilestoneWatch from '../components/MilestoneWatch.jsx'
import Leaders from '../components/Leaders.jsx'
import TeamProfile from '../components/TeamProfile.jsx'

// The Season stats tab (id `leaders`).
export default function LeadersTab() {
  return (
    <>
      <MilestoneWatch />
      <Section kicker="Moving the ball" title="Offensive leaders" sponsor={SPONSORS.leaders} slot="leaders"><Leaders side="offense" /></Section>
      <Section kicker="Getting stops" title="Defensive leaders"><Leaders side="defense" /></Section>
      <TeamProfile />
    </>
  )
}
