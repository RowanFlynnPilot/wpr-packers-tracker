import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { WATCH_VENUES, SPONSOR_INQUIRY, TEAM_NAMES } from '../config.js'
import { fetchSeasonGames } from '../api.js'
import { track } from '../analytics.js'
import { useInquiry } from '../useInquiry.js'
import Section from './Section.jsx'

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

function VenueCard({ venue }) {
  const [heroFailed, setHeroFailed] = useState(false)
  const hero = venue.images?.[0]
  const thumbs = (venue.images || []).slice(1, 4)
  const linkProps = venue.url
    ? { href: venue.url, target: '_blank', rel: 'noopener noreferrer sponsored', onClick: () => track('Sponsor Click', { sponsor: venue.name, slot: 'where-to-watch' }) }
    : {}
  return (
    <div style={{ border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`, borderRadius: 10, background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Hero photo (venue-provided) or a quiet placeholder band */}
      <div style={{ aspectRatio: '16 / 9', background: theme.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {hero && !heroFailed ? (
          <img src={hero} alt={venue.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={() => setHeroFailed(true)} />
        ) : (
          <span style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Venue photo</span>
        )}
      </div>
      {thumbs.length > 0 && (
        <div style={{ display: 'flex', gap: 3, background: theme.green }}>
          {thumbs.map((t, i) => (
            <div key={i} style={{ flex: 1, aspectRatio: '4 / 3', overflow: 'hidden' }}>
              <Photo src={t} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '15px 18px 17px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ fontFamily: theme.sans, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>Game-day partner</div>
        <div style={{ fontFamily: theme.serif, fontSize: 21, color: theme.ink, lineHeight: 1.15, marginTop: 3 }}>{venue.name}</div>
        {venue.tagline && <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 14.5, color: theme.muted, marginTop: 2 }}>{venue.tagline}</div>}
        {(venue.address || venue.phone) && (
          <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 5 }}>
            {[venue.address, venue.phone].filter(Boolean).join(' · ')}
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

        {venue.url && (
          <a {...linkProps} className="link-hover" style={{ display: 'inline-block', marginTop: 'auto', paddingTop: 14, fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: theme.green, textDecoration: 'none' }}>
            Menu &amp; info {'→'}
          </a>
        )}
      </div>
    </div>
  )
}

export default function WhereToWatch() {
  const [next, setNext] = useState(null)
  const inquiry = useInquiry('where-to-watch')

  useEffect(() => {
    if (!WATCH_VENUES.length) return
    let alive = true
    fetchSeasonGames()
      .then(({ games }) => { if (alive) setNext(games.find((g) => g.state === 'pre') || null) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!WATCH_VENUES.length) return null

  return (
    <Section kicker="Where to watch" title="Catch the game this week">
      {next && (
        <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 16px', maxWidth: 620, lineHeight: 1.5 }}>
          Packers {next.home ? 'vs' : 'at'} {TEAM_NAMES[next.oppId] || next.oppName}, {fmtWhen(next)} — here's where Wausau will be watching.
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
        {WATCH_VENUES.map((v) => <VenueCard key={v.name} venue={v} />)}
        {/* Open inventory: the guide sells by the listing, so the next slot pitches itself. */}
        <div style={{ border: `1px dashed ${theme.rule}`, borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, minHeight: 160 }}>
          <div style={{ fontFamily: theme.sans, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700 }}>Listing available</div>
          <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 16, color: theme.ink, lineHeight: 1.4 }}>
            Your bar or restaurant, in front of every game-day reader — photos, specials, and what makes your room the place to watch.
          </div>
          <a href={`mailto:${SPONSOR_INQUIRY}?subject=${encodeURIComponent('Packers tracker — game-day guide listing')}`}
            className="link-hover" onClick={inquiry.onClick}
            style={{ fontFamily: theme.sans, fontSize: 11.5, fontWeight: 700, color: theme.green, textDecoration: 'none' }}>
            {inquiry.copied ? '✓ Address copied — paste into any email' : <>{SPONSOR_INQUIRY} <span aria-hidden="true">→</span></>}
          </a>
        </div>
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 12 }}>
        Venue listings are paid placements.
      </div>
    </Section>
  )
}
