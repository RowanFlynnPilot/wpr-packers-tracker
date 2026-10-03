import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { WATCH_VENUES, TEAM_NAMES } from '../config.js'
import { fetchSeasonGames } from '../api.js'
import { track } from '../analytics.js'
import Section from './Section.jsx'
import DirectionsChip from './DirectionsChip.jsx'
import { useIsNarrow } from '../useIsNarrow.js'

// The game-day guide — bar/restaurant listings sold per listing (config WATCH_VENUES): photos,
// amenity chips, game-day specials, and a tracked link per venue. The intro line ties the
// section to this week's actual kickoff (one cached schedule read, fail-soft). Owns its
// Section; with no venues sold there is no section — except in ?demo, where sales previews
// fill it with placeholders (see config.js).
const fmtWhen = (g) =>
  g.timeValid
    ? new Date(g.date).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })
    : new Date(g.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

// One photo that quietly removes itself if the venue's URL is bad.
function Photo({ src, alt, style }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null
  return <img src={src} alt={alt} loading="lazy" style={style} onError={() => setFailed(true)} />
}

// `slot` labels the placement in click reporting. `wide` lays the card out side by side (photos
// left, details right) for a full-width row; it falls back to the stacked card on narrow screens.
function VenueCard({ venue, slot, wide = false }) {
  const [heroFailed, setHeroFailed] = useState(false)
  const narrow = useIsNarrow(700)
  const row = wide && !narrow
  const hero = venue.images?.[0]
  const thumbs = (venue.images || []).slice(1, 4)
  const linkProps = venue.url
    ? { href: venue.url, target: '_blank', rel: 'noopener noreferrer sponsored', onClick: () => track('Sponsor Click', { sponsor: venue.name, slot }) }
    : {}
  const heroImg = hero && !heroFailed && (
    <img src={hero} alt={venue.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={() => setHeroFailed(true)} />
  )
  return (
    <div style={{ border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`, borderRadius: 10, background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: row ? 'row' : 'column' }}>
      {/* Hero photo (venue-provided) or a quiet placeholder band. The photo — often the venue's
          own ad art — taps through to the venue like the "Menu & info" link; it's a duplicate
          of that link, so it stays out of the tab order and the accessibility tree. Side by
          side, the photos inset beside the details instead of bleeding across the top. */}
      <div style={row ? { flex: '0 0 320px', alignSelf: 'center', padding: '16px 0 16px 16px' } : undefined}>
        <div style={{ aspectRatio: '16 / 9', background: theme.green, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: row ? 6 : 0, overflow: 'hidden' }}>
          {heroImg && venue.url ? (
            <a {...linkProps} tabIndex={-1} aria-hidden="true" style={{ display: 'block', width: '100%', height: '100%' }}>{heroImg}</a>
          ) : heroImg || (
            <span style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Venue photo</span>
          )}
        </div>
        {thumbs.length > 0 && (
          <div style={{ display: 'flex', gap: 3, background: theme.green, marginTop: row ? 3 : 0 }}>
            {thumbs.map((t, i) => (
              <div key={i} style={{ flex: 1, aspectRatio: '4 / 3', overflow: 'hidden' }}>
                <Photo src={t} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '15px 18px 17px', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: theme.sans, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>Game-day partner</div>
        <div style={{ fontFamily: theme.serif, fontSize: 21, color: theme.ink, lineHeight: 1.15, marginTop: 3 }}>{venue.name}</div>
        {venue.tagline && <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 14.5, color: theme.muted, marginTop: 2 }}>{venue.tagline}</div>}
        {(venue.address || venue.phone) && (
          <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 5 }}>
            {venue.address}
            {venue.address && venue.phone && ' · '}
            {venue.phone && (
              <a href={`tel:${venue.phone.replace(/[^\d+]/g, '')}`} className="link-hover" style={{ color: 'inherit', whiteSpace: 'nowrap' }}
                onClick={() => track('Sponsor Click', { sponsor: venue.name, slot, action: 'call' })}>
                {venue.phone}
              </a>
            )}
          </div>
        )}

        {venue.features?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
            {venue.features.map((f) => (
              <span key={f} style={{ border: `1px solid ${theme.rule}`, background: theme.wash, borderRadius: 20, padding: '3px 11px', fontFamily: theme.sans, fontSize: 11.5, color: theme.green, fontWeight: 700 }}>{f}</span>
            ))}
          </div>
        )}

        {venue.specials?.length > 0 && (
          <div style={{ marginTop: 13 }}>
            <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, marginBottom: 5 }}>Game-day specials</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {venue.specials.map((s) => (
                <li key={s} style={{ display: 'flex', gap: 9, alignItems: 'baseline', padding: '3px 0', fontFamily: theme.sans, fontSize: 13, color: theme.ink, lineHeight: 1.4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.gold, flexShrink: 0, position: 'relative', top: -2 }} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(venue.url || venue.address) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 14 }}>
            {venue.url && (
              <a {...linkProps} className="link-hover" style={{ fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: theme.green, textDecoration: 'none' }}>
                Menu &amp; info {'→'}
              </a>
            )}
            {venue.address && <DirectionsChip address={venue.address} sponsor={venue.name} slot={slot} />}
          </div>
        )}
      </div>
    </div>
  )
}

// One full-width row per venue, both tabs. `compact` is the Season-tab edition: no intro line
// (the game hero above already names the kickoff), reported as its own slot.
//
// No "listing available" card beside a sold venue: a paying bar shouldn't share its placement
// with an ad for its competitors (Oct 2026, the guide's first sale). The open inventory sells
// from the media kit (sponsors.html) instead.
export default function WhereToWatch({ compact = false }) {
  const [next, setNext] = useState(null)

  useEffect(() => {
    if (!WATCH_VENUES.length || compact) return
    let alive = true
    fetchSeasonGames()
      .then(({ games }) => { if (alive) setNext(games.find((g) => g.state === 'pre') || null) })
      .catch(() => {})
    return () => { alive = false }
  }, [compact])

  if (!WATCH_VENUES.length) return null

  return (
    <Section kicker="Where to watch" title="Catch the game this week">
      {!compact && next && (
        <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 16px', maxWidth: 620, lineHeight: 1.5 }}>
          Packers {next.home ? 'vs' : 'at'} {TEAM_NAMES[next.oppId] || next.oppName}, {fmtWhen(next)} — here's where Wausau will be watching.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {WATCH_VENUES.map((v) => <VenueCard key={v.name} venue={v} slot={compact ? 'where-to-watch-season' : 'where-to-watch'} wide />)}
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 12 }}>
        Venue listings are paid placements.
      </div>
    </Section>
  )
}
