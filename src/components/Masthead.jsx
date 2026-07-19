import { theme } from '../theme.js'
import { WPR_LOGO, WPR_BADGE, WPR_TAGLINE, WPR_URL } from '../config.js'

// Wausau Pilot & Review masthead — modeled on the paper's own newspaper-style header: the
// typewriter press seal beside the wordmark (both linked home), the tagline, and a dateline,
// framed by slate rules. The badge matches WPR's other tools (wpr-water etc.).
export default function Masthead() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  return (
    <div style={{ borderTop: `4px solid ${theme.slate}`, borderBottom: `1px solid ${theme.slate}`, padding: '16px 20px 12px', textAlign: 'center', background: theme.paper }}>
      <a href={WPR_URL} target="_blank" rel="noopener noreferrer" aria-label="Wausau Pilot & Review home"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 14, maxWidth: '94%' }}>
        <img src={WPR_BADGE} alt="" width={62} height={62} decoding="async"
          style={{ flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <img src={WPR_LOGO} alt="Wausau Pilot & Review" style={{ maxHeight: 58, minWidth: 0, maxWidth: '100%', height: 'auto', width: 'auto', objectFit: 'contain' }} />
      </a>
      <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: theme.slate, marginTop: 8 }}>{WPR_TAGLINE}</div>
      <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.04em', color: theme.muted, marginTop: 6, borderTop: `1px solid ${theme.rule}`, paddingTop: 8, maxWidth: 880, marginLeft: 'auto', marginRight: 'auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <span>{today}</span>
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>Wausau, Wisconsin</span>
      </div>
    </div>
  )
}
