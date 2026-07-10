import { useState } from 'react'
import { theme } from '../theme.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { track } from '../analytics.js'

// Sponsorable "where to watch" listing for a local bar/restaurant: their photo, what makes it a
// great watch spot, and game-day specials. All content is config-driven (no API).
export default function WhereToWatch({ venue }) {
  const narrow = useIsNarrow()
  const [imgFailed, setImgFailed] = useState(false)
  if (!venue) return null

  const linkProps = venue.url
    ? { href: venue.url, target: '_blank', rel: 'noopener noreferrer sponsored', onClick: () => track('Sponsor Click', { sponsor: venue.name, slot: 'where-to-watch' }) }
    : {}

  return (
    <div style={{ border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 10, background: theme.wash, overflow: 'hidden', display: 'flex', flexDirection: narrow ? 'column' : 'row' }}>
      {/* Photo (venue-provided) or a placeholder */}
      <div style={{ flex: narrow ? 'none' : '0 0 286px', background: theme.green, minHeight: narrow ? 170 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {venue.image && !imgFailed ? (
          <img src={venue.image} alt={venue.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={() => setImgFailed(true)} />
        ) : (
          <span style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Venue photo</span>
        )}
      </div>

      {/* Details */}
      <div style={{ flex: 1, padding: '18px 20px 20px' }}>
        <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>Presented by</div>
        <div style={{ fontFamily: theme.serif, fontSize: 22, color: theme.ink, lineHeight: 1.15, marginTop: 3 }}>{venue.name}</div>
        {venue.tagline && <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 15, color: theme.muted, marginTop: 2 }}>{venue.tagline}</div>}
        {venue.address && <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 4 }}>{venue.address}</div>}

        {venue.features?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
            {venue.features.map((f) => (
              <span key={f} style={{ border: `1px solid ${theme.rule}`, background: '#fff', borderRadius: 20, padding: '3px 11px', fontFamily: theme.sans, fontSize: 11.5, color: theme.green, fontWeight: 700 }}>{f}</span>
            ))}
          </div>
        )}

        {venue.specials?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, marginBottom: 6 }}>Game-day specials</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {venue.specials.map((s) => (
                <li key={s} style={{ display: 'flex', gap: 9, alignItems: 'baseline', padding: '3px 0', fontFamily: theme.sans, fontSize: 13, color: theme.ink, lineHeight: 1.4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.gold, flexShrink: 0, marginTop: 6 }} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {venue.url && (
          <a {...linkProps} className="link-hover" style={{ display: 'inline-block', marginTop: 14, fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: theme.green, textDecoration: 'none' }}>
            Visit {venue.name} {'→'}
          </a>
        )}
      </div>
    </div>
  )
}
