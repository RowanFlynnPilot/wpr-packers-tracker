import { theme } from '../theme.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Sponsor from './Sponsor.jsx'

// Editorial section wrapper: kicker + headline, optional sponsor lockup. Single responsibility: layout chrome.
// `sponsor` is a sponsor object, null (renders an "available" slot), or undefined (no slot at all).
export default function Section({ kicker, title, sponsor, slot, children }) {
  const narrow = useIsNarrow()
  return (
    <section style={{ borderTop: `1px solid ${theme.rule}`, padding: narrow ? '28px 0' : '38px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>{kicker}</div>
          <h2 style={{ fontFamily: theme.serif, fontSize: narrow ? 23 : 28, lineHeight: 1.1, margin: '6px 0 0', color: theme.ink, fontWeight: 600 }}>{title}</h2>
        </div>
        {sponsor !== undefined && <Sponsor sponsor={sponsor} variant="light" slot={slot} />}
      </div>
      {children}
    </section>
  )
}
