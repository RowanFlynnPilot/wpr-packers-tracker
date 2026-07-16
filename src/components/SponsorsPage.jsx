import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { SPONSORS, WATCH_VENUES, SPONSOR_INQUIRY, SEASON } from '../config.js'
import { fetchSeasonGames } from '../api.js'
import { track } from '../analytics.js'
import Masthead from './Masthead.jsx'

// The hosted media kit (sponsors.html) — one URL that sells the tracker: the inventory drawn
// LIVE from config (a sold slot flips to "Sold" the moment config.js changes, so this page can
// never go stale the way a deck does), live mini embeds as proof the product works, and one
// tap to inquire. Linked from the tracker footer; the direct URL is what WPR sales sends out.
const mailto = (subject) => `mailto:${SPONSOR_INQUIRY}?subject=${encodeURIComponent(subject)}`

const INVENTORY = [
  {
    key: 'header', name: 'Title sponsorship — the flagship',
    desc: 'Your lockup on the green banner atop every load, a credit on the live game hero, the mid-page band, and your logo baked into the twice-daily email digest image.',
    sold: () => !!SPONSORS.header, demo: './?demo',
  },
  {
    key: 'race', name: 'Division race section',
    desc: 'Your lockup beside the season-long NFC North race chart — the page’s signature graphic.',
    sold: () => !!SPONSORS.race, demo: './?demo',
  },
  {
    key: 'leaders', name: 'Season stats section',
    desc: 'Your lockup over the offense and defense leader boards readers check all week.',
    sold: () => !!SPONSORS.leaders, demo: './?demo&tab=leaders',
  },
  {
    key: 'forecast', name: 'Kickoff forecast credit',
    desc: '“Presented by” on the Lambeau weather line, every home game week — December football is a weather story.',
    sold: () => !!SPONSORS.forecast, demo: './?demo',
  },
  {
    key: 'where-to-watch', name: 'Game-day guide listings',
    desc: 'Your bar or restaurant in the “Where to watch” guide: photos, amenity chips, game-day specials, and a tracked link. Sold per listing — multiple venues run side by side.',
    sold: () => false, multi: true, demo: './?demo&tab=schedule',
  },
]

const WHY = [
  ['7 days', 'of anticipation around every game — countdown, injuries, matchup, film room'],
  ['30s', 'data refresh — score, situation and win probability are always live'],
  ['0', 'cookies — no consent banner between a reader and your brand'],
  ['Per-slot', 'reporting — impressions and clicks for your placement, not the page average'],
]

export default function SponsorsPage() {
  const [days, setDays] = useState(null)

  useEffect(() => {
    let alive = true
    fetchSeasonGames().then(({ games }) => {
      const opener = games.find((g) => g.seasonType === 2 && g.state === 'pre')
      if (alive && opener) setDays(Math.ceil((new Date(opener.date) - Date.now()) / 86400000))
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  const inquire = (slot) => track('Sponsor Inquiry', { slot })
  const kicker = { fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }
  const cta = (subject, slot, label, big = false) => (
    <a href={mailto(subject)} onClick={() => inquire(slot)} className="link-hover"
      style={{ display: 'inline-block', background: theme.gold, color: theme.green, fontFamily: theme.sans, fontWeight: 700, fontSize: big ? 15 : 12.5, borderRadius: 8, padding: big ? '13px 26px' : '9px 16px', textDecoration: 'none' }}>
      {label}
    </a>
  )

  return (
    <div style={{ background: theme.paper, color: theme.ink, minHeight: '100vh' }}>
      <Masthead />

      {/* Header band */}
      <div style={{ background: theme.green, color: '#fff', padding: '34px 20px 38px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ ...kicker, color: theme.gold }}>Sponsorships · {SEASON} season</div>
          <h1 style={{ fontFamily: theme.serif, fontSize: 'clamp(28px, 5vw, 40px)', lineHeight: 1.05, margin: '8px 0 10px', fontWeight: 600 }}>
            Put your brand on the Packers tracker
          </h1>
          <p style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 17, color: '#cfd8d3', margin: '0 0 18px', maxWidth: 560, lineHeight: 1.5 }}>
            A live, season-long Green Bay Packers stats experience inside Wisconsin's most local
            news brand — with your name on it.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {cta(`Packers tracker sponsorship — ${SEASON} season`, 'media-kit-header', 'Start the conversation', true)}
            {days > 0 && (
              <span style={{ fontFamily: theme.sans, fontSize: 12.5, fontWeight: 700, color: theme.gold }}>
                Kickoff in {days} days — placements close before Week 1
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 20px' }}>
        {/* Why it works */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, margin: '30px 0' }}>
          {WHY.map(([num, text]) => (
            <div key={num} style={{ border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontFamily: theme.serif, fontSize: 26, fontWeight: 700, color: theme.green, lineHeight: 1 }}>{num}</div>
              <div style={{ fontFamily: theme.sans, fontSize: 11.5, color: theme.muted, marginTop: 7, lineHeight: 1.45 }}>{text}</div>
            </div>
          ))}
        </div>

        {/* Inventory — drawn live from config, so status can't go stale. */}
        <div style={{ ...kicker, color: theme.goldText }}>The placements</div>
        <h2 style={{ fontFamily: theme.serif, fontSize: 26, margin: '4px 0 14px', fontWeight: 600 }}>What's on the board</h2>
        {INVENTORY.map((item, i) => {
          const sold = item.sold()
          return (
            <div key={item.key} style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '14px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink, fontWeight: 600 }}>{item.name}</span>
                  <span style={{ fontFamily: theme.sans, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 3, padding: '2px 8px', color: sold ? theme.muted : theme.green, border: `1px solid ${sold ? theme.rule : theme.green}` }}>
                    {sold ? 'Sold' : item.multi ? 'Listings open' : 'Open'}
                  </span>
                </div>
                <div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginTop: 4, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
                <a href={item.demo} target="_blank" rel="noopener noreferrer" className="link-hover"
                  style={{ fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: theme.green, textDecoration: 'none' }}>
                  See it live <span aria-hidden="true">→</span>
                </a>
                {!sold && cta(`Packers tracker sponsorship — ${item.name}`, `media-kit-${item.key}`, 'Inquire')}
              </div>
            </div>
          )
        })}

        {/* Live proof: the actual minis, running on the same data readers see. */}
        <div style={{ marginTop: 34 }}>
          <div style={{ ...kicker, color: theme.goldText }}>Live right now</div>
          <h2 style={{ fontFamily: theme.serif, fontSize: 26, margin: '4px 0 6px', fontWeight: 600 }}>This isn't a mockup</h2>
          <p style={{ fontFamily: theme.serif, fontSize: 15.5, color: theme.muted, margin: '0 0 14px', maxWidth: 620, lineHeight: 1.5 }}>
            These embeds are the real widgets, pulling the same live data your customers see —
            the sidebar scoreboard and standings cards also run across Wausau Pilot &amp; Review.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <iframe src="mini.html?demo" title="Live Packers scoreboard" loading="lazy" style={{ width: '100%', height: 300, border: 0 }} />
            <iframe src="mini-standings.html?demo" title="Live NFC North standings" loading="lazy" style={{ width: '100%', height: 300, border: 0 }} />
          </div>
        </div>

        {/* Reporting promise */}
        <div style={{ marginTop: 30, border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 8, background: theme.wash, padding: '16px 20px' }}>
          <div style={{ fontFamily: theme.serif, fontSize: 17, color: theme.ink, fontWeight: 600 }}>Provable, not promised</div>
          <div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginTop: 5, lineHeight: 1.55 }}>
            Every placement reports its own numbers — impressions and per-slot click-throughs,
            measured cookieless. Your link carries your campaign tags, so the traffic shows up in
            your own analytics too. Full deck and screenshots available on request.
          </div>
        </div>

        {/* Closing CTA */}
        <div style={{ textAlign: 'center', margin: '40px 0 20px' }}>
          {cta(`Packers tracker sponsorship — ${SEASON} season`, 'media-kit-footer', `Book a placement for the ${SEASON} season`, true)}
          <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 10 }}>
            {SPONSOR_INQUIRY} · 715-301-5539 · Wausau Pilot &amp; Review
          </div>
        </div>

        <footer style={{ borderTop: `1px solid ${theme.rule}`, padding: '18px 0 40px', fontFamily: theme.sans, fontSize: 11, color: theme.muted, lineHeight: 1.6 }}>
          The tracker is not affiliated with or endorsed by the NFL, the Green Bay Packers, or ESPN. Data via ESPN's public NFL feeds.{' '}
          <a href="./" className="link-hover" style={{ color: theme.green, fontWeight: 700, textDecoration: 'none' }}>See the tracker →</a>
        </footer>
      </div>
    </div>
  )
}
