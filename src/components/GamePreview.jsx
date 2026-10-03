import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, TEAM_NAMES, headshot } from '../config.js'
import { fetchGameSummary, fetchRecentMeetings } from '../api.js'
import { teamGameLeaders } from '../games.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { openPlayerCard } from './PlayerCard.jsx'
import TeamLogo from './TeamLogo.jsx'

const CATS = ['passingYards', 'rushingYards', 'receivingYards', 'sacks', 'totalTackles']
const MEETINGS = 5
// ESPN labels a tackles total "TOT"; in a cell under "Tackles" the abbreviation reads as noise.
const UNIT = { TOT: 'TKL' }
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const kicker = { fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }
const quiet = { fontFamily: theme.sans, fontSize: 12, color: theme.muted }

// An upcoming game opened up from its schedule row: both teams' SEASON leaders, category by
// category (an upcoming game's summary carries them for both sides — one read), and the last
// five meetings, each a tap from its box score. Nothing loads until a reader opens the row. The
// halves render independently: one that fails or comes back empty simply isn't there.
export default function GamePreview({ game, onBoxScore }) {
  const [leaders, setLeaders] = useState(null)   // { me, opp } | 'none'
  const [meetings, setMeetings] = useState(null) // [game…] | 'none'
  const narrow = useIsNarrow()

  useEffect(() => {
    let alive = true
    fetchGameSummary(game.id).then((s) => {
      if (!alive) return
      const me = teamGameLeaders(s, TEAM_ID, CATS)
      const opp = teamGameLeaders(s, game.oppId, CATS)
      setLeaders(me.length || opp.length ? { me, opp } : 'none')
    }).catch(() => { if (alive) setLeaders('none') })
    fetchRecentMeetings(game.oppId, MEETINGS)
      .then((m) => { if (alive) setMeetings(m.length ? m : 'none') })
      .catch(() => { if (alive) setMeetings('none') })
    return () => { alive = false }
  }, [game.id, game.oppId])

  const oppName = TEAM_NAMES[game.oppId] || game.oppName
  const cols = narrow ? '62px 1fr 1fr' : '92px 1fr 1fr'

  const cell = (l) => {
    if (!l) return <span style={quiet}>—</span>
    const face = (
      <>
        {!narrow && (
          <img src={headshot(l.id, 32)} alt="" width={32} height={32} loading="lazy"
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }}
            onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
        )}
        <span style={{ minWidth: 0 }}>
          <span className="player-name" style={{ display: 'block', fontFamily: theme.serif, fontSize: 14, color: theme.ink, lineHeight: 1.25 }}>{l.name}</span>
          <span style={{ display: 'block', fontFamily: theme.sans, fontSize: 11.5, color: theme.muted, marginTop: 1, lineHeight: 1.35 }}>
            <strong style={{ color: theme.ink }}>{l.value} {UNIT[l.unit] || l.unit}</strong>{l.detail ? ` · ${l.detail}` : ''}
          </span>
        </span>
      </>
    )
    // The face + name is the tap target (any NFL player's card opens — opponents included).
    return (
      <button type="button" className="player-link" aria-haspopup="dialog" onClick={() => openPlayerCard(l.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', minWidth: 0 }}>
        {face}
      </button>
    )
  }

  const renderLeaders = () => {
    if (leaders === 'none') return null
    if (!leaders) return <div style={quiet}>Pulling the season leaders…</div>
    const byKey = (list) => Object.fromEntries(list.map((l) => [l.key, l]))
    const me = byKey(leaders.me)
    const opp = byKey(leaders.opp)
    const rows = CATS.filter((c) => me[c] || opp[c])
    const team = (id, name) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: theme.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.ink }}>
        <TeamLogo id={id} size={18} /> {name}
      </span>
    )
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 12, alignItems: 'center', paddingBottom: 7 }}>
          <span style={kicker}>Season leaders</span>
          {team(TEAM_ID, 'Packers')}
          {team(game.oppId, oppName)}
        </div>
        {rows.map((c) => (
          <div key={c} style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 12, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${theme.rule}` }}>
            <span style={{ fontFamily: theme.sans, fontSize: 11, fontWeight: 700, color: theme.muted }}>{(me[c] || opp[c]).cat}</span>
            {cell(me[c])}
            {cell(opp[c])}
          </div>
        ))}
      </div>
    )
  }

  const renderMeetings = () => {
    if (meetings === 'none') return null
    if (!meetings) return <div style={quiet}>Looking up the last {MEETINGS} meetings…</div>
    const w = meetings.filter((m) => m.won).length
    const t = meetings.filter((m) => m.tied).length
    const l = meetings.length - w - t
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', paddingBottom: 7 }}>
          <span style={kicker}>Last {meetings.length} meetings</span>
          <span style={{ fontFamily: theme.sans, fontSize: 11.5, color: theme.muted }}>
            Packers <strong style={{ color: theme.ink }}>{w}–{l}{t ? `–${t}` : ''}</strong> in those games
          </span>
        </div>
        {meetings.map((m) => (
          <button key={m.id} type="button" className="hover-row" aria-haspopup="dialog"
            onClick={() => onBoxScore(m.id, `${m.home ? 'vs' : '@'} ${m.oppName} · ${fmtDate(m.date)}`)}
            style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: narrow ? 'nowrap' : 'wrap', width: '100%', padding: '8px 0', background: 'transparent', border: 'none', borderTop: `1px solid ${theme.rule}`, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
            <span style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, width: narrow ? 84 : 96, flexShrink: 0 }}>{fmtDate(m.date)}</span>
            <span style={{ fontFamily: theme.serif, fontSize: 14.5, color: theme.ink, flex: '1 1 120px', minWidth: 0 }}>
              {m.home ? 'vs' : '@'} {m.oppName}
              {m.seasonType === 3 && (
                <span style={{ marginLeft: 7, fontFamily: theme.sans, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.goldText, whiteSpace: 'nowrap' }}>
                  {m.note || 'Playoffs'}
                </span>
              )}
            </span>
            <span style={{ fontFamily: theme.serif, fontSize: 15, marginLeft: 'auto', whiteSpace: 'nowrap', color: m.tied ? theme.muted : m.won ? theme.green : theme.red }}>
              <span style={{ fontWeight: 700 }}>{m.tied ? 'T' : m.won ? 'W' : 'L'}</span>{' '}
              <span style={{ color: m.won ? theme.green : theme.ink }}>{m.meScore}–{m.oppScore}</span>
              {m.ot && <span style={{ fontFamily: theme.sans, fontSize: 9.5, fontWeight: 700, color: theme.muted, marginLeft: 4 }}>OT</span>}
            </span>
            {/* On a phone the label would wrap to a line of its own under every meeting; the
                arrow alone says the row opens. */}
            <span style={{ fontFamily: theme.sans, fontSize: 11, fontWeight: 700, color: theme.goldText, whiteSpace: 'nowrap' }}>{narrow ? '→' : 'Box score →'}</span>
          </button>
        ))}
      </div>
    )
  }

  const empty = leaders === 'none' && meetings === 'none'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {empty ? <div style={quiet}>Nothing to preview for this one yet.</div> : <>{renderLeaders()}{renderMeetings()}</>}
    </div>
  )
}
