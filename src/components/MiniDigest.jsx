import { useEffect, useState, useCallback } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, DIVISION, DIVISION_NAME, SPONSORS, SEASON, WATCH_VENUES, headshot } from '../config.js'
import { fetchSeasonGames, fetchStandingsBundle, fetchGameSummary } from '../api.js'
import { teamGameLeaders, gamesBack } from '../games.js'
import { conferenceTeams, simulate, gameStakes, openRace, oddsText, CLINCH } from '../playoffSim.js'
import { buildWeek, swing, rootingRows } from '../rooting.js'
import { isStreaming } from '../calendar.js'
import { trackBeacon } from '../analytics.js'
import { destination } from '../embed.js'
import TeamLogo from './TeamLogo.jsx'

const REFRESH_MS = 120000

const Headshot = ({ id, size }) => (
  <img src={headshot(id, size)} alt="" width={size} height={size} loading="lazy" decoding="async"
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
  // `?image` is set when this is being screenshotted for the email PNG (see render-digest.mjs).
  const imageMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('image')
  // The playoff race in three lines — the newsletter IMAGE only (see raceBlock below).
  // undefined = still working it out (the render script waits on that), null = nothing to say.
  const [race, setRace] = useState(undefined)
  // The newsletter image is drawn 420px wide and shown about 350px wide on a phone, where the
  // card's 10-11px labels landed near 8-9px. In image mode all type (and the logos beside it)
  // runs 20% larger; the web card, embedded at its own size, is untouched.
  const f = (n) => (imageMode ? Math.round(n * 1.2 * 2) / 2 : n)
  const sz = (n) => (imageMode ? Math.round(n * 1.2) : n)

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

  // The odds, what the next game is worth, and the week's top rooting interest — the same
  // numbers the tracker prints (same table, same seed), worked out here for the email image.
  useEffect(() => {
    if (!imageMode || !bundle || !games) return
    let alive = true
    ;(async () => {
      if (bundle.season !== SEASON) return null // before Week 1 there is no race to report
      const me = bundle.league.find((r) => r.id === TEAM_ID)
      const teams = conferenceTeams(bundle.league)
      if (!me || !teams || me.clincher === 'e') return null
      const metric = openRace(me.clincher)
      const out = { seed: me.seed, conf: me.conf, clinch: CLINCH[me.clincher]?.badge || null, metric }
      if (!metric) return out.clinch ? out : null
      out.odds = simulate(teams)[metric]
      if (next && next.seasonType === 2) {
        const s = gameStakes(teams, next.oppId)
        if (s.win[metric] - s.loss[metric] >= 2) out.stakes = { win: s.win[metric], loss: s.loss[metric] }
      }
      const week = await buildWeek().catch(() => null)
      const top = week && rootingRows(week).find((g) => g.state !== 'post')
      if (top) out.root = { pick: top.root === 'home' ? top.home : top.away, over: top.root === 'home' ? top.away : top.home, pts: swing(top) }
      return out
    })().then((r) => { if (alive) setRace(r) }).catch(() => { if (alive) setRace(null) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the standings and the next game pin the run
  }, [imageMode, bundle, next?.id])

  // In image mode the "Full tracker →" affordance is dead pixels (an image can't carry a link to
  // just that text), so we drop it — the email puts a real text link below the image instead.

  const card = {
    display: 'block', maxWidth: 420, margin: '0 auto', textDecoration: 'none', overflow: 'hidden',
    background: '#fff', border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`,
    borderRadius: 8, fontFamily: theme.sans,
  }
  const band = (
    <div style={{ background: theme.green, color: '#fff', fontSize: f(10), letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', padding: '5px 8px', textAlign: 'center' }}>
      Packers digest
    </div>
  )
  // The title sponsor leads the IMAGE: a strip right under the band, its logo at twice the old
  // footer size. At the foot of the card it was the smallest thing on it, smaller than the
  // game-day partner strip above it, which is backwards for the title package.
  const presented = imageMode && SPONSORS.header && (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '9px 14px', borderBottom: `1px solid ${theme.rule}` }}>
      <span style={{ fontSize: f(10), letterSpacing: '0.14em', fontWeight: 700, color: theme.goldText, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Presented by</span>
      {SPONSORS.header.logo
        ? <img src={SPONSORS.header.logo} alt={SPONSORS.header.name} style={{ height: 40, objectFit: 'contain', display: 'block' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
        : <span style={{ fontFamily: theme.serif, fontSize: f(14), color: theme.ink }}>{SPONSORS.header.name}</span>}
    </div>
  )
  const heading = (text) => (
    <div style={{ fontSize: f(10), letterSpacing: '0.14em', fontWeight: 700, color: theme.goldText, textTransform: 'uppercase', marginBottom: 6 }}>{text}</div>
  )
  // The foot of the card. On the web: the title sponsor and "Full tracker". In the IMAGE: a
  // drawn button and when the snapshot was taken. The newsletter wraps the whole image in one
  // link, so the button works wherever it is tapped (it is there to say the image is tappable),
  // and the stamp matters now that the card carries odds (it is re-rendered twice a day).
  const stamp = new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const footer = imageMode ? (
    <div style={{ borderTop: `1px solid ${theme.rule}`, padding: '13px 14px 12px', textAlign: 'center' }}>
      <span style={{ display: 'inline-block', background: theme.green, color: '#fff', borderRadius: 20, padding: '9px 22px', fontSize: f(12.5), fontWeight: 700 }}>
        Open the live tracker {'→'}
      </span>
      <div style={{ fontSize: f(9.5), color: theme.muted, marginTop: 8, lineHeight: 1.45 }}>
        As of {stamp}<br />Updated live at wausaupilotandreview.com/green-bay-packers
      </div>
    </div>
  ) : (
    <div style={{ borderTop: `1px solid ${theme.rule}`, margin: '0 12px', padding: '7px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      {SPONSORS.header ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.12em', fontWeight: 700, color: theme.goldText, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Presented by</span>
          {SPONSORS.header.logo
            ? <img src={SPONSORS.header.logo} alt={SPONSORS.header.name} style={{ height: 20, objectFit: 'contain', display: 'block' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
            : <span style={{ fontSize: 10, color: theme.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SPONSORS.header.name}</span>}
        </span>
      ) : <span />}
      <span style={{ fontSize: 11, fontWeight: 700, color: theme.green, whiteSpace: 'nowrap' }}>Full tracker {'→'}</span>
    </div>
  )
  const linkProps = { href: destination(), target: '_top', onClick: () => trackBeacon('Mini Click', { widget: 'digest' }) }
  const section = { padding: '11px 14px', borderTop: `1px solid ${theme.rule}` }

  // Nothing yet: a branded doorway rather than an empty box.
  if (!games && !bundle) {
    return (
      <a {...linkProps} className="mini-card" style={card}>
        {band}
        <div style={{ padding: '18px 14px', fontFamily: theme.serif, fontSize: f(16), color: theme.ink, textAlign: 'center' }}>The Packers, by the numbers</div>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          {heading(`Last game · ${wk(last) ? `${wk(last)} · ` : ''}${fmtDay(last.date)}`)}
          {/* The result in a word (image): a loss was signaled only by which number was bold. */}
          {imageMode && (
            <span style={{ fontSize: f(10), fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', background: last.tied ? theme.muted : won ? theme.green : theme.red, borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {last.tied ? 'Tie' : won ? 'Win' : 'Loss'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <TeamLogo id={TEAM_ID} size={sz(22)} />
            <span style={{ fontFamily: theme.serif, fontSize: f(14), fontWeight: won ? 700 : 400, color: won ? theme.green : theme.ink }}>Packers</span>
          </span>
          <span style={{ fontFamily: theme.serif, fontSize: imageMode ? 32 : 22, color: theme.ink, whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: won ? 700 : 400, color: won ? theme.green : theme.ink }}>{last.meScore}</span>
            <span style={{ fontSize: f(15), color: theme.muted }}> – </span>
            <span style={{ fontWeight: won ? 400 : 700 }}>{last.oppScore}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: theme.serif, fontSize: f(14), color: theme.ink }}>{last.oppName}</span>
            <TeamLogo id={last.oppId} size={sz(22)} />
          </span>
        </div>
        {leaders?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {leaders.map((l) => (
              <div key={l.cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: f(11), marginTop: 5 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <Headshot id={l.id} size={sz(24)} />
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: theme.serif, fontSize: f(14), color: theme.ink }}>
          <TeamLogo id={TEAM_ID} size={sz(20)} />
          <span style={{ fontWeight: 700, color: theme.green }}>Packers</span>
          <span style={{ fontSize: f(10), letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, fontFamily: theme.sans }}>{next.home ? 'vs' : 'at'}</span>
          <span>{next.oppName}</span>
          <TeamLogo id={next.oppId} size={sz(20)} />
        </div>
        <div style={{ textAlign: 'center', fontSize: f(10.5), color: theme.muted, marginTop: 5 }}>
          {[next.home ? 'Lambeau Field' : next.venue, isStreaming(next.tv) ? `Streaming on ${next.tv}` : next.tv].filter(Boolean).join(' · ')}
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
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none', fontSize: f(11.5) }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: f(10), letterSpacing: '0.06em', color: theme.muted, fontWeight: 700, flexShrink: 0 }}>WK {g.week}</span>
                <TeamLogo id={g.oppId} size={sz(16)} />
                <span style={{ fontFamily: theme.serif, fontSize: f(13), color: theme.ink, fontWeight: nextUp ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {g.home ? 'vs' : 'at'} {g.oppName}
                </span>
              </span>
              <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{right}</span>
            </div>
          )
        })}
        {games?.opener && (
          <div style={{ fontSize: f(10), color: theme.muted, marginTop: 6 }}>
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
    // Games back of the leader says more than a column of zero ties (which shows only when
    // someone in the division actually has one).
    const anyTies = rows.some((t) => t.ties)
    const back = (t) => {
      const g = gamesBack({ w: rows[0].wins, l: rows[0].losses, t: rows[0].ties }, { w: t.wins, l: t.losses, t: t.ties })
      return g ? String(g).replace('.5', '½').replace(/^0(?=½)/, '') : '—'
    }
    const th = { fontSize: f(10), letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, textAlign: 'right', padding: '3px 6px' }
    const td = { fontSize: f(12), color: theme.ink, textAlign: 'right', padding: '4px 6px', borderTop: `1px solid ${theme.rule}`, whiteSpace: 'nowrap' }
    standingsBlock = (
      <div style={lastBlock || nextBlock ? section : { padding: '11px 14px' }}>
        {heading(`${DIVISION_NAME}${stale ? ` · final ${bundle.season}` : ''}`)}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Team</th>
              <th style={th}>W</th><th style={th}>L</th>{anyTies && <th style={th}>T</th>}<th style={th}>GB</th><th style={th}>Strk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const me = t.id === TEAM_ID
              const sc = t.streak || '—'
              return (
                <tr key={t.id} style={me ? { background: theme.wash } : undefined}>
                  <td style={{ ...td, textAlign: 'left' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: theme.serif, fontSize: f(13.5), fontWeight: me ? 700 : 400, color: me ? theme.green : theme.ink }}>
                      <TeamLogo id={t.id} size={sz(17)} />
                      {DIVISION[t.id] || t.name}
                    </span>
                  </td>
                  <td style={td}>{t.wins}</td>
                  <td style={td}>{t.losses}</td>
                  {anyTies && <td style={td}>{t.ties}</td>}
                  <td style={{ ...td, color: theme.muted }}>{back(t)}</td>
                  <td style={{ ...td, color: sc[0] === 'W' ? theme.green : sc[0] === 'L' ? theme.red : theme.muted, fontWeight: 700 }}>{sc}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // ---- The playoff race — the newsletter IMAGE only (the web digest is embedded at a fixed
  // height a taller card would overflow). Every subscriber sees this image; the tracker's newest
  // material — the odds, what the next game is worth, who to root for — used to be invisible
  // from it. Three lines, labeled as the house model; nothing before Week 1 or once eliminated.
  let raceBlock = null
  if (imageMode && race) {
    const division = race.metric === 'division'
    const day = next ? new Date(next.date).toLocaleDateString('en-US', { weekday: 'long' }) : ''
    raceBlock = (
      <div style={section}>
        {heading('The playoff race')}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
            {race.metric
              ? <><span style={{ fontFamily: theme.serif, fontSize: f(26), color: theme.green, lineHeight: 1 }}>{oddsText(race.odds)}</span>
                  <span style={{ fontSize: f(12), color: theme.ink }}>{division ? `to win the ${DIVISION_NAME}` : 'to make the playoffs'}</span></>
              : <span style={{ fontFamily: theme.serif, fontSize: f(17), color: theme.green }}>{race.clinch}</span>}
          </span>
          {race.seed && <span style={{ fontSize: f(11), fontWeight: 700, color: theme.green, background: theme.wash, border: `1px solid ${theme.rule}`, borderRadius: 10, padding: '2px 9px', whiteSpace: 'nowrap' }}>No. {race.seed} in the {race.conf}</span>}
        </div>
        {division && race.clinch && <div style={{ fontSize: f(11.5), color: theme.ink, marginTop: 5 }}>{race.clinch}.</div>}
        {/* What the next game is worth, as a picture: one 0-100 track, the loss end in red, the
            win end in green, today ticked: the hero's stakes bar, at card size. */}
        {race.stakes && (() => {
          const pos = (v) => `${Math.min(99, Math.max(1, v))}%`
          const { win, loss } = race.stakes
          return (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: f(11), color: theme.ink, marginBottom: 7 }}>
                {day} {next.home ? 'vs' : 'at'} the {next.oppName} is worth <strong>{win - loss} points</strong> of that:
              </div>
              <div style={{ position: 'relative', height: 8, borderRadius: 4, background: theme.rule }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: pos(loss), width: `calc(${pos(race.odds)} - ${pos(loss)})`, background: theme.red, opacity: 0.6, borderRadius: '4px 0 0 4px' }} />
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: pos(race.odds), width: `calc(${pos(win)} - ${pos(race.odds)})`, background: theme.green, borderRadius: '0 4px 4px 0' }} />
                <div style={{ position: 'absolute', top: -4, bottom: -4, left: pos(race.odds), width: 2, marginLeft: -1, background: theme.ink }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: f(11), marginTop: 6 }}>
                <span style={{ color: theme.red, fontWeight: 700 }}>{oddsText(loss)} with a loss</span>
                <span style={{ color: theme.green, fontWeight: 700 }}>{oddsText(win)} with a win</span>
              </div>
            </div>
          )
        })()}
        {race.root && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: f(11.5), color: theme.ink, marginTop: 6 }}>
            <span style={{ color: theme.goldText, fontWeight: 700 }}>Root for</span>
            <TeamLogo id={race.root.pick.id} size={sz(16)} />
            <span><strong>{race.root.pick.name}</strong> over the {race.root.over.name} <span style={{ color: theme.muted }}>· {race.root.pts} {race.root.pts === 1 ? 'pt' : 'pts'}</span></span>
          </div>
        )}
        <div style={{ fontSize: f(10), color: theme.muted, marginTop: 6 }}>Odds from Wausau Pilot &amp; Review’s house model.</div>
      </div>
    )
  }

  // ---- Game-day partner — the newsletter IMAGE only. The sold venue(s) from the game-day guide
  // (config WATCH_VENUES; placeholders have no url, so they never print), set above the title
  // sponsor's "Presented by", which stays the card's sign-off. Image-only because the web
  // digest is one link to the tracker (a partner link can't nest inside it) and is embedded at
  // a fixed 480px that a taller card would overflow. Evergreen fields only — never the dated
  // specials, which would sit in subscribers' inboxes after they expire.
  const partners = imageMode ? WATCH_VENUES.filter((v) => v.url).slice(0, 2) : []
  const partnerBlock = partners.length > 0 && (
    <div style={{ ...section, background: theme.wash }}>
      {heading(partners.length > 1 ? 'Game-day partners' : 'Game-day partner')}
      {partners.map((v, i) => (
        <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: i ? 10 : 0 }}>
          {v.logo && <img src={v.logo} alt="" width={sz(48)} height={sz(48)} style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0, display: 'block' }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: theme.serif, fontSize: f(15.5), color: theme.ink, lineHeight: 1.15 }}>{v.name}</div>
            {v.tagline && <div style={{ fontSize: f(11), color: theme.ink, marginTop: 3, lineHeight: 1.35, textWrap: 'balance' }}>{v.tagline}</div>}
            {/* Each piece keeps to its own line if the pair won't fit: a phone number split
                across two lines ("715-571-" / "6733") is a number nobody can read at a glance. */}
            {(v.address || v.phone) && (
              <div style={{ fontSize: f(10.5), color: theme.muted, marginTop: 3, display: 'flex', flexWrap: 'wrap', columnGap: 8 }}>
                {v.address && <span>{v.address}</span>}
                {v.phone && <span style={{ whiteSpace: 'nowrap' }}>{v.phone}</span>}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <a {...linkProps} className="mini-card" style={card} data-race={imageMode ? (race === undefined ? 'pending' : 'done') : undefined}>
      {band}
      {presented}
      {lastBlock}
      {nextBlock}
      {raceBlock}
      {slateBlock}
      {standingsBlock}
      {partnerBlock}
      {footer}
    </a>
  )
}
