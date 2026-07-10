import { theme } from '../theme.js'
import { USE_TEAM_LOGO, TEAM_LOGO, SPONSORS } from '../config.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Sponsor from './Sponsor.jsx'

export default function PackersBanner() {
  const narrow = useIsNarrow()
  return (
    <div style={{ background: theme.green, color: '#fff', padding: narrow ? '20px 16px' : '26px 20px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          {USE_TEAM_LOGO && (
            <img src={TEAM_LOGO} alt="Green Bay Packers" width={56} height={56} style={{ objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
          )}
          <div>
            <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: theme.gold }}>Wisconsin Sports</div>
            <h1 style={{ fontFamily: theme.serif, fontSize: narrow ? 27 : 36, lineHeight: 1.02, margin: '4px 0 0', fontWeight: 600 }}>The Packers, by the numbers</h1>
            <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 16, color: '#cfd8d3', marginTop: 4 }}>The shape of Green Bay's season, updated live.</div>
          </div>
        </div>
        {/* Title sponsor spans the full banner width — the premium placement, sized like one. */}
        <Sponsor sponsor={SPONSORS.header} variant="dark" slot="banner" fullWidth />
      </div>
    </div>
  )
}
