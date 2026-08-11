import { useEffect, useState, useCallback } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, DIVISION, DIVISION_NAME, SPONSORS, SEASON, headshot } from '../config.js'
import { fetchSeasonGames, fetchStandingsBundle, fetchGameSummary } from '../api.js'
import { teamGameLeaders } from '../games.js'
import { trackBeacon } from '../analytics.js'
import { destination } from '../embed.js'
import TeamLogo from './TeamLogo.jsx'

const REFRESH_MS = 120000

const Headshot = ({ id, size }) => (
  <img src={headshot(id)} alt="" width={size} height={size} loading="lazy" decoding="async"
    style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }}
    onError={(e) => { e.currentTarget.style.display = 'none' }} />
)

const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
// ESPN reuses week numbers across season types — a wild-card game is week 1 again, and so is
// an August exhibition. Postseason games say "Playoffs"; preseason games say so out loud, so
// an exhibition score never reads like the real thing.
const wk = (g) =>
  g.seasonType === 3 ? 'Playoffs'
  : g.seasonType === 1 ? (g.week ? `Preseason Wk ${g.week}` : 'Preseason')
  : g.week ? `Wk ${g.week}` : ''

// Newsletter "digest" mini: last final (score + the Packers' top performers), next game
// (kickoff, TV, venue), and the NFC North standings — one at-a-glance card. While the
// standings are still last season's and exhibitions are underway, the preseason slate takes
// the table's spot (results fill in game by game) and hands it back at Week 1. The whole card
// is one link into the full tracker (target=_top navigates the hosting page, not the iframe).
// Self-contained, fail-soft: any section with no data simply doesn't render (in the offseason
// that's the "last game" block until the games come back).
export default function MiniDigest() {
  const [games, setGames] = useState(null)      // { last, next }
  const [bundle, setBundle] = useState(null)
  const [leaders, setLeaders] = useState(null)  // last game's Packers leaders

  const load = useCallback(() => {
    // Preseason counts here, same as the hero and the scoreboard mini — an August newsletter
    // should carry August's games. The wk() labels keep an exhibition from reading like the
    // regular season, and Week 1 takes the card back over naturally.
    fetchSeasonGames().then(({ games: all }) => {
      const finals = all.filter((g) => g.state === 'post')
      setGames({
        last: finals[finals.length - 1] || null,
        next: all.find((g) => g.state === 'pre') || null,
        slate: all.filter((g) => g.seasonType === 1),
        opener: all.find((g) => g.seasonType === 2 && g.state === 'pre') || null,
      })
    }).catch(() => {})
    fetchStandingsBundle().then(setBundle).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const refresh = () => { if (!document.hidden) load() }
    const id = setInterval(refresh, REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [load])

  const last = games?.last
  const next = games?.next
  const lastId = last?.id

  // The last game's top performers (passing/rushing/receiving), from one cached summary read.
  useEffect(() => {
    setLeaders(null)
    if (!lastId) return
    let alive = true
    fetchGameSummary(lastId).then((s) => { if (alive) setLeaders(teamGameLeaders(s)) }).catch(() => {})
    return () => { alive = false }
  }, [lastId])

  // `?image` is set when this is being screenshotted for the email PNG (see render-digest.mjs).
  // In that mode the "Full tracker →" affordance is dead pixels (an image can't carry a link to
  // just that text), so we drop it — the email puts a real text link below the image instead.
  const imageMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('image')

  const card = {
    display: 'block', maxWidth: 420, margin: '0 auto', textDecoration: 'none', overflow: 'hidden',
    background: '#fff', border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`,
    borderRadius: 8, fontFamily: theme.sans,
  }
  const band = (
    <div style={{ background: theme.green, color: '#fff', fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', padding: '5px 8px', textAlign: 'center' }}>
      Packers digest
    </div>
  )
  const heading = (text) => (
    <div style={{ fontSize: 9, letterSpacing: '0.14em', fontWeight: 700, color: theme.goldText, textTransform: 'uppercase', marginBottom: 6 }}>{text}</div>
  )
  // In image mode with no title sponsor there is nothing to show — skip the footer entirely
  // rather than baking a bare rule over a blank band into every newsletter send.
  const footer = (imageMode && !SPONSORS.header) ? null : (
    <div style={{ borderTop: `1px solid ${theme.rule}`, margin: '0 12px', padding: '7px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      {SPONSORS.header ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{ fontSize: 8, letterSpacing: '0.12em', fontWeight: 700, color: theme.goldText, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Presented by</span>
          {SPONSORS.header.logo
            ? <img src={SPONSORS.header.logo} alt={SPONSORS.header.name} style={{ height: 20, objectFit: 'contain', display: 'block' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
            : <span style={{ fontSize: 8.5, color: theme.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SPONSORS.header.name}</span>}
        </span>
      ) : <span />}
      {!imageMode && <span style={{ fontSize: 11, fontWeight: 700, color: theme.green, whiteSpace: 'nowrap' }}>Full tracker {'→'}</span>}
    </div>
  )
  const linkProps = { href: destination(), target: '_top', onClick: () => trackBeacon('Mini Click', { widget: 'digest' }) }
  const section = { padding: '11px 14px', borderTop: `1px solid ${theme.rule}` }

  // Nothing yet: a branded doorway rather than an empty box.
  if (!games && !bundle) {
    return (
      <a {...linkProps} className="mini-card" style={card}>
        {band}
        <div style={{ padding: '18px 14px', fontFamily: theme.serif, fontSize: 16, color: theme.ink, textAlign: 'center' }}>The Packers, by the numbers</div>
        {footer}
      </a>
    )
  }

  // ---- Last completed game ----
  let lastBlock = null
  if (last) {
    const won = last.won
    lastBlock = (
      <div style={{ padding: '11px 14px' }}>
        {heading(`Last game · ${wk(last) ? `${wk(last)} · ` : ''}${fmtDay(last.date)}`)}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <TeamLogo id={TEAM_ID} size={22} />
            <span style={{ fontFamily: theme.serif, fontSize: 14, fontWeight: won ? 700 : 400, color: won ? theme.green : theme.ink }}>Packers</span>
          </span>
          <span style={{ fontFamily: theme.serif, fontSize: 22, color: theme.ink, whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: won ? 700 : 400, color: won ? theme.green : theme.ink }}>{last.meScore}</span>
            <span style={{ fontSize: 15, color: theme.muted }}> – </span>
            <span style={{ fontWeight: won ? 400 : 700 }}>{last.oppScore}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: theme.serif, fontSize: 14, color: theme.ink }}>{last.oppName}</span>
            <TeamLogo id={last.oppId} size={22} />
          </span>
        </div>
        {leaders?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {leaders.map((l) => (
              <div key={l.cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11, marginTop: 5 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <Headshot id={l.id} size={24} />
                  <span style={{ color: theme.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: theme.goldText, fontWeight: 700 }}>{l.cat}</span> {l.name}
                  </span>
                </span>
                <span style={{ color: theme.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>{l.line}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ---- Next game ----
  let nextBlock = null
  if (next) {
    nextBlock = (
      <div style={last ? section : { padding: '11px 14px' }}>
        {heading(`Next up · ${wk(next) ? `${wk(next)} · ` : ''}${fmtDay(next.date)}${next.timeValid ? ` · ${fmtTime(next.date)}` : ''}`)}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: theme.serif, fontSize: 14, color: theme.ink }}>
          <TeamLogo id={TEAM_ID} size={20} />
          <span style={{ fontWeight: 700, color: theme.green }}>Packers</span>
          <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, fontFamily: theme.sans }}>{next.home ? 'vs' : 'at'}</span>
          <span>{next.oppName}</span>
          <TeamLogo id={next.oppId} size={20} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 10.5, color: theme.muted, marginTop: 5 }}>
          {[next.home ? 'Lambeau Field' : next.venue, next.tv].filter(Boolean).join(' · ')}
        </div>
      </div>
    )
  }

  // ---- Preseason slate — stands in for the standings while the table is still last
  // season's. Exhibition results and dates are the live story in August; the block hands
  // the spot back to the real table the moment the new season's standings exist. The deep
  // offseason (no preseason schedule published yet) keeps the labeled final standings —
  // a year-old table beats a blank card.
  let slateBlock = null
  const slate = games?.slate || []
  if (slate.length && (!bundle || bundle.season < SEASON)) {
    slateBlock = (
      <div style={lastBlock || nextBlock ? section : { padding: '11px 14px' }}>
        {heading('Preseason slate')}
        {slate.map((g, i) => {
          const nextUp = g.id === next?.id
          const right = g.state === 'post'
            ? <span style={{ color: g.won ? theme.green : g.tied ? theme.muted : theme.red, fontWeight: 700 }}>
                {g.won ? 'W' : g.tied ? 'T' : 'L'} {g.won ? `${g.meScore}–${g.oppScore}` : `${g.oppScore}–${g.meScore}`}
              </span>
            : g.state === 'in'
              ? <span style={{ color: theme.red, fontWeight: 700 }}>Live · {g.meScore}–{g.oppScore}</span>
              : <span style={{ color: theme.muted }}>{fmtDay(g.date)}{g.timeValid ? ` · ${fmtTime(g.date)}` : ''}</span>
          return (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none', fontSize: 11.5 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 9, letterSpacing: '0.06em', color: theme.muted, fontWeight: 700, flexShrink: 0 }}>WK {g.week}</span>
                <TeamLogo id={g.oppId} size={16} />
                <span style={{ fontFamily: theme.serif, fontSize: 13, color: theme.ink, fontWeight: nextUp ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {g.home ? 'vs' : 'at'} {g.oppName}
                </span>
              </span>
              <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{right}</span>
            </div>
          )
        })}
        {games?.opener && (
          <div style={{ fontSize: 10, color: theme.muted, marginTop: 6 }}>
            The real thing: {fmtDay(games.opener.date)} {games.opener.home ? 'vs' : 'at'} the {games.opener.oppName} — the {DIVISION_NAME} table returns at Week 1.
          </div>
        )}
      </div>
    )
  }

  // ---- NFC North standings ----
  let standingsBlock = null
  if (bundle && !slateBlock) {
    const rows = bundle.standings
    const stale = bundle.season < SEASON
    const th = { fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, textAlign: 'right', padding: '3px 6px' }
    const td = { fontSize: 12, color: theme.ink, textAlign: 'right', padding: '4px 6px', borderTop: `1px solid ${theme.rule}`, whiteSpace: 'nowrap' }
    standingsBlock = (
      <div style={lastBlock || nextBlock ? section : { padding: '11px 14px' }}>
        {heading(`${DIVISION_NAME}${stale ? ` · final ${bundle.season}` : ''}`)}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Team</th>
              <th style={th}>W</th><th style={th}>L</th><th style={th}>T</th><th style={th}>Strk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const me = t.id === TEAM_ID
              const sc = t.streak || '—'
              return (
                <tr key={t.id} style={me ? { background: theme.wash } : undefined}>
                  <td style={{ ...td, textAlign: 'left' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: theme.serif, fontSize: 13.5, fontWeight: me ? 700 : 400, color: me ? theme.green : theme.ink }}>
                      <TeamLogo id={t.id} size={17} />
                      {DIVISION[t.id] || t.name}
                    </span>
                  </td>
                  <td style={td}>{t.wins}</td>
                  <td style={td}>{t.losses}</td>
                  <td style={td}>{t.ties}</td>
                  <td style={{ ...td, color: sc[0] === 'W' ? theme.green : sc[0] === 'L' ? theme.red : theme.muted, fontWeight: 700 }}>{sc}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <a {...linkProps} className="mini-card" style={card}>
      {band}
      {lastBlock}
      {nextBlock}
      {slateBlock}
      {standingsBlock}
      {footer}
    </a>
  )
}
