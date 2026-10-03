import { theme } from '../theme.js'
import { track } from '../analytics.js'

// "Directions" pill for a sponsor with a physical door — the title sponsor's banner lockup and
// each game-day guide venue. Opens the platform's maps app (Apple Maps on Apple hardware, Google
// Maps everywhere else) and reports the tap as a `Sponsor Click` with action 'directions'.
// A button-role span, not an <a>: the banner lockup is itself one big link, and anchors can't
// nest — so it stops the click from also following the card's link.
export default function DirectionsChip({ address, sponsor, slot }) {
  const open = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const q = encodeURIComponent(address)
    const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
    track('Sponsor Click', { sponsor, slot, action: 'directions' })
    window.open(apple ? `https://maps.apple.com/?daddr=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank', 'noopener')
  }
  return (
    <span role="button" tabIndex={0} onClick={open} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open(e)} className="link-hover"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1.5px solid ${theme.gold}`, borderRadius: 16, padding: '4px 12px', fontFamily: theme.sans, fontSize: 11.5, fontWeight: 700, color: theme.green, whiteSpace: 'nowrap', cursor: 'pointer' }}>
      <svg width="11" height="14" viewBox="0 0 12 15" aria-hidden="true"><path d="M6 0C2.9 0 .5 2.4.5 5.4c0 3.9 4.9 9 5.1 9.2a.55.55 0 0 0 .8 0c.2-.2 5.1-5.3 5.1-9.2C11.5 2.4 9.1 0 6 0zm0 7.6a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z" fill={theme.gold} /></svg>
      Directions
    </span>
  )
}
