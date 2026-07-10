import { theme } from '../theme.js'
import { SPONSORS } from '../config.js'
import Sponsor from './Sponsor.jsx'

// Mid-page sponsor band: the title sponsor again at the scroll pause between the schedule and
// the vault, echoing the top banner — green field, full-width lockup. Renders nothing when the
// header slot is unsold (no mid-page upsell; the section slots already carry those).
export default function SponsorBand() {
  if (!SPONSORS.header) return null
  return (
    <div style={{ background: theme.green, borderRadius: 10, padding: '16px 18px', margin: '0 0 38px' }}>
      <Sponsor sponsor={SPONSORS.header} variant="dark" slot="midpage" fullWidth />
    </div>
  )
}
