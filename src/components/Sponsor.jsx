import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { SPONSOR_INQUIRY } from '../config.js'
import { fetchSeasonGames } from '../api.js'
import { track } from '../analytics.js'
import { useInquiry } from '../useInquiry.js'

// Sponsor lockup. One responsibility: render a paid sponsor, or an "available" upsell card.
// `variant` adapts the chrome to the dark green banner vs. a light editorial section.
// `slot` labels the placement (banner/hero/race/leaders) for per-slot click reporting.
// `fullWidth` stretches the lockup across its container (the banner) as a horizontal bar.
// Upsell cards are a working funnel: the email is a tappable mailto with the placement in the
// subject, clicks fire a `Sponsor Inquiry` event, and until Week 1 a kickoff countdown makes
// the deadline real.
export default function Sponsor({ sponsor, variant = 'light', compact = false, fullWidth = false, slot }) {
  const dark = variant === 'dark'
  const [daysToKickoff, setDaysToKickoff] = useState(null)
  const inquiry = useInquiry(slot || 'unknown')
  useEffect(() => {
    if (sponsor) return // sold slots don't sell themselves
    let alive = true
    fetchSeasonGames().then(({ games }) => {
      const opener = games.find((g) => g.seasonType === 2 && g.state === 'pre')
      if (alive && opener) setDaysToKickoff(Math.ceil((new Date(opener.date) - Date.now()) / 86400000))
    }).catch(() => {})
    return () => { alive = false }
  }, [sponsor])
  const labelColor = dark ? '#cfd8d3' : theme.muted
  const nameColor = dark ? '#fff' : theme.ink
  const border = dark ? 'rgba(255,255,255,0.4)' : theme.rule

  const linkProps = sponsor?.url
    ? {
        href: sponsor.url,
        target: '_blank',
        rel: 'noopener noreferrer sponsored',
        onClick: () => track('Sponsor Click', { sponsor: sponsor.name, slot: slot || 'unknown' }),
      }
    : {}

  // Compact credit — a one-line "Presented by NAME" link, no logo card. For tight placements
  // (e.g. the hero) where a full lockup already appears elsewhere on the page.
  if (compact && sponsor) {
    const Tag = sponsor.url ? 'a' : 'span'
    return (
      <Tag {...linkProps} className={sponsor.url ? 'link-hover' : undefined} style={{ textDecoration: 'none', fontFamily: theme.sans, fontSize: 11, color: labelColor }}>
        <span style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>Presented by </span>
        <span style={{ fontFamily: theme.serif, fontSize: 13, color: nameColor }}>{sponsor.name}</span>
      </Tag>
    )
  }

  const label = (text, size = 9) => (
    <div style={{ fontFamily: theme.sans, fontSize: size, letterSpacing: '0.12em', textTransform: 'uppercase', color: labelColor }}>
      {text}
    </div>
  )

  // Open slot — a tasteful upsell rather than an empty hole, and a working funnel: tap the
  // email to start the conversation.
  if (!sponsor) {
    const mailto = `mailto:${SPONSOR_INQUIRY}?subject=${encodeURIComponent(`Packers tracker sponsorship — ${slot || 'placement'}`)}`
    return (
      <div style={{ textAlign: fullWidth ? 'left' : 'right', width: fullWidth ? '100%' : undefined, border: `1px dashed ${border}`, borderRadius: 4, padding: '8px 12px' }}>
        {label('Sponsorship available')}
        <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 13, color: nameColor, marginTop: 3 }}>
          Reach Wisconsin sports fans
        </div>
        <a href={mailto} className="link-hover" onClick={inquiry.onClick}
          style={{ display: 'inline-block', fontFamily: theme.sans, fontSize: 10.5, fontWeight: 700, color: dark ? '#fff' : theme.green, textDecoration: 'none', marginTop: 3 }}>
          {inquiry.copied ? '✓ Address copied — paste into any email' : <>{SPONSOR_INQUIRY} <span aria-hidden="true">→</span></>}
        </a>
        {daysToKickoff > 0 && daysToKickoff <= 150 && (
          <div style={{ fontFamily: theme.sans, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', color: dark ? theme.gold : theme.goldText, marginTop: 3 }}>
            Kickoff in {daysToKickoff} days — placements close before Week 1
          </div>
        )}
      </div>
    )
  }

  // Full lockup — a white card that pops on the green banner (and reads cleanly on paper), with a
  // gold top-accent, a prominent logo, and a click cue. The logo art is on white, so a white card
  // frames it naturally.
  const Box = sponsor.url ? 'a' : 'div'

  // Directions: the whole card is already an <a>, so this renders as a button-role span
  // (nested anchors are invalid) that opens the platform's maps app — Apple Maps on Apple
  // hardware, Google Maps everywhere else. Same treatment as the Brewers tracker.
  const openDirections = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const q = encodeURIComponent(sponsor.address)
    const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
    track('Sponsor Click', { sponsor: sponsor.name, slot: slot || 'unknown', action: 'directions' })
    window.open(apple ? `https://maps.apple.com/?daddr=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank', 'noopener')
  }
  const directionsChip = sponsor.address && (
    <span role="button" tabIndex={0} onClick={openDirections} onKeyDown={(e) => e.key === 'Enter' && openDirections(e)} className="link-hover"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1.5px solid ${theme.gold}`, borderRadius: 16, padding: '4px 12px', fontFamily: theme.sans, fontSize: 11.5, fontWeight: 700, color: theme.green, whiteSpace: 'nowrap', cursor: 'pointer' }}>
      <svg width="11" height="14" viewBox="0 0 12 15" aria-hidden="true"><path d="M6 0C2.9 0 .5 2.4.5 5.4c0 3.9 4.9 9 5.1 9.2a.55.55 0 0 0 .8 0c.2-.2 5.1-5.3 5.1-9.2C11.5 2.4 9.1 0 6 0zm0 7.6a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z" fill={theme.gold} /></svg>
      Directions
    </span>
  )

  // Full-width bar: eyebrow on top, then logo · big amenity line + location · actions.
  // The tagline splits at the em-dash: what the sponsor offers reads LARGE; where they are
  // sits under it — the bar's middle carries real weight instead of one small gray line.
  if (fullWidth) {
    const [amenities, location] = (sponsor.tagline || '').split('—').map((s) => s.trim())
    return (
      <Box
        {...linkProps}
        className={sponsor.url ? 'link-hover' : undefined}
        style={{
          display: 'block', width: '100%', textAlign: 'left', textDecoration: 'none',
          background: '#fff', border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`,
          borderRadius: 8, padding: '10px 18px 12px',
          boxShadow: dark ? '0 6px 20px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ fontFamily: theme.sans, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>Presented by</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginTop: 6 }}>
          {sponsor.logo ? (
            <img src={sponsor.logo} alt={sponsor.name} style={{ display: 'block', height: 50, objectFit: 'contain' }} />
          ) : (
            <div style={{ fontFamily: theme.serif, fontSize: 20, color: theme.ink }}>{sponsor.name}</div>
          )}
          {sponsor.tagline && (
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontFamily: theme.sans, fontSize: 15.5, fontWeight: 700, color: theme.ink, lineHeight: 1.3 }}>{amenities}</div>
              {location && <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 2 }}>{location}</div>}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {directionsChip}
            {sponsor.url && (
              <span style={{ fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: theme.green, whiteSpace: 'nowrap' }}>
                Plan your visit <span aria-hidden="true">→</span>
              </span>
            )}
          </div>
        </div>
      </Box>
    )
  }

  return (
    <Box
      {...linkProps}
      className={sponsor.url ? 'link-hover' : undefined}
      style={{
        display: 'inline-block', textAlign: 'left', textDecoration: 'none',
        background: '#fff', border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`,
        borderRadius: 8, padding: '12px 16px 13px', maxWidth: 300,
        boxShadow: dark ? '0 6px 20px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ fontFamily: theme.sans, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>Presented by</div>
      {sponsor.logo ? (
        <img src={sponsor.logo} alt={sponsor.name} style={{ display: 'block', height: 50, objectFit: 'contain', margin: '8px 0 2px' }} />
      ) : (
        <div style={{ fontFamily: theme.serif, fontSize: 20, color: theme.ink, margin: '6px 0 2px' }}>{sponsor.name}</div>
      )}
      {sponsor.tagline && (
        <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 4, lineHeight: 1.4 }}>{sponsor.tagline}</div>
      )}
      {sponsor.url && (
        <div style={{ fontFamily: theme.sans, fontSize: 11.5, fontWeight: 700, color: theme.green, marginTop: 9 }}>
          Plan your visit <span aria-hidden="true">→</span>
        </div>
      )}
    </Box>
  )
}
