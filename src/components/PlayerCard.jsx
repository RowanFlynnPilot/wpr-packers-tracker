import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { headshot } from '../config.js'
import { fetchRoster, fetchAthlete, fetchAthleteOverview, fetchGamelog } from '../api.js'
import { track } from '../analytics.js'
import { useModalFocus } from '../useModalFocus.js'
import { Loading } from './Status.jsx'

// Tap-any-player modal. One host mounts in App; every roster surface (leader tables,
// injuries, spotlights) calls openPlayerCard(id) — a module-level hook so callers don't
// thread props through the tree. The card is a small player profile: green header band with
// the headshot and bio, "season at a glance" stat tiles + a career line (overview feed), and
// the game log — last five by default, expandable to the full season (regular + playoffs;
// preseason is excluded at the API layer). Fail-soft: a failed fetch just closes the card.
let listener = null
export function openPlayerCard(id) {
  if (listener) listener(id)
}

const label = { fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700 }

// The log's columns are ordered primary-category-first (a back's carries before his catches),
// so the first few non-noise columns ARE the story of the player's game. Rate/derived columns
// are noise here — a card line should spend its four slots on counting stats (yards, TDs).
const NOISE = new Set(['LNG', 'AVG', 'CMP%', 'QBR', 'RTG'])
function statLine(stats) {
  return stats
    .filter((s) => s.value != null && s.value !== '' && !NOISE.has(s.label))
    .slice(0, 4)
    .map((s) => `${s.value} ${s.label.toLowerCase()}`)
    .join(' · ')
}

// Curated picks for the stat tiles, in priority order. Each position's overview feed only
// carries its own categories, so one list serves quarterbacks, backs, receivers and
// defenders alike; zero lines are skipped ("0 forced fumbles" is nobody's headline).
const STAT_PICKS = [
  ['Passing Yards', 'Pass yds'],
  ['Passing Touchdowns', 'Pass TD'],
  ['Completion Percentage', 'Cmp %'],
  ['Passer Rating', 'Rating'],
  ['Interceptions', 'INT'],
  ['Rushing Yards', 'Rush yds'],
  ['Rushing Touchdowns', 'Rush TD'],
  ['Rushing Attempts', 'Carries'],
  ['Receptions', 'Catches'],
  ['Receiving Yards', 'Rec yds'],
  ['Receiving Touchdowns', 'Rec TD'],
  ['Receiving Targets', 'Targets'],
  ['Total Tackles', 'Tackles'],
  ['Solo Tackles', 'Solo'],
  ['Sacks', 'Sacks'],
  ['Passes Defended', 'Passes def.'],
  ['Forced Fumbles', 'Forced fum.'],
]
function pickStats(overview, splitName, n) {
  const stats = overview?.splits?.[splitName]
  if (!stats) return []
  // 'Interceptions' is thrown (a QB's headline mistake) but also taken (a defender's prize),
  // under one feed label. For defenders, rank it with the other takeaway stats instead of up
  // in the passing block — otherwise a linebacker's card leads with "1 INT".
  const picks = [...STAT_PICKS]
  if (overview.displayNames.includes('Total Tackles')) {
    const [int] = picks.splice(picks.findIndex(([d]) => d === 'Interceptions'), 1)
    picks.splice(picks.findIndex(([d]) => d === 'Sacks') + 1, 0, int)
  }
  const out = []
  for (const [displayName, short] of picks) {
    const i = overview.displayNames.indexOf(displayName)
    if (i === -1) continue
    const v = stats[i]
    if (v == null || v === '' || !parseFloat(String(v).replace(/,/g, ''))) continue
    out.push({ label: short, value: v })
    if (out.length === n) break
  }
  return out
}

export default function PlayerCardHost() {
  const [id, setId] = useState(null)
  const [bio, setBio] = useState(null)
  const [log, setLog] = useState(null)
  const [overview, setOverview] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const dialogRef = useRef(null)
  useModalFocus(dialogRef, !!id)

  useEffect(() => {
    listener = (pid) => { setId(pid); track('Player Card') }
    return () => { listener = null }
  }, [])

  useEffect(() => {
    setBio(null)
    setLog(null)
    setOverview(null)
    setShowAll(false)
    if (!id) return
    let alive = true
    // Roster first; a player who has left the club (the norm on offseason leader boards)
    // resolves through the pooled athlete read instead of opening an empty "Player" card.
    fetchRoster()
      .then(({ byId }) => byId[id] || fetchAthlete(id))
      .then((p) => { if (alive) setBio(p) })
      .catch(() => { if (alive) setId(null) })
    fetchGamelog(id).then((g) => { if (alive) setLog(g) }).catch(() => { if (alive) setLog({ rows: [] }) })
    fetchAthleteOverview(id).then((o) => { if (alive) setOverview(o) }).catch(() => {})
    return () => { alive = false }
  }, [id])

  useEffect(() => {
    if (!id) return
    const onKey = (e) => { if (e.key === 'Escape') setId(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [id])

  if (!id) return null

  const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const rows = log?.rows || []
  const shown = showAll ? rows : rows.slice(0, 5)
  const season = pickStats(overview, 'Regular Season', 6)
  const career = pickStats(overview, 'Career', 3)
  const resultColor = (r) => (r === 'W' ? theme.green : r === 'L' ? theme.red : theme.muted)

  return (
    <div ref={dialogRef} onClick={() => setId(null)} role="dialog" aria-modal="true" aria-label="Player card"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(32,55,49,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, borderTop: `4px solid ${theme.gold}`, maxWidth: 460, width: '100%', maxHeight: '86vh', overflowY: 'auto', fontFamily: theme.sans, position: 'relative' }}>

        {!bio ? (
          <div style={{ padding: '20px 22px' }}>
            <button onClick={() => setId(null)} aria-label="Close" style={{ position: 'absolute', top: 10, right: 12, cursor: 'pointer', background: 'transparent', border: 'none', fontSize: 22, color: theme.muted, lineHeight: 1 }}>×</button>
            <Loading lines={3} />
          </div>
        ) : (
          <>
            {/* Header band: the profile's face — headshot on Packers green, jersey number as a
                watermark, name in the serif. */}
            <div style={{ position: 'relative', background: theme.green, padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 16, overflow: 'hidden' }}>
              {bio.jersey && (
                <div aria-hidden="true" style={{ position: 'absolute', right: 12, bottom: -14, fontFamily: theme.serif, fontStyle: 'italic', fontWeight: 600, fontSize: 84, lineHeight: 1, color: theme.gold, opacity: 0.18, pointerEvents: 'none' }}>
                  {bio.jersey}
                </div>
              )}
              <img src={headshot(id)} alt="" width={76} height={76} decoding="async"
                style={{ borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0, boxShadow: `0 0 0 3px ${theme.gold}` }}
                onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
              <div style={{ minWidth: 0, position: 'relative' }}>
                <div style={{ fontFamily: theme.serif, fontSize: 24, color: '#fff', lineHeight: 1.1 }}>{bio.name || 'Player'}</div>
                <div style={{ fontSize: 12, color: '#cfd8d3', marginTop: 4 }}>
                  {[bio.pos, bio.jersey && `#${bio.jersey}`, bio.age && `Age ${bio.age}`,
                    bio.exp != null && (bio.exp === 0 ? 'Rookie' : `Year ${bio.exp + 1}`)].filter(Boolean).join(' · ')}
                </div>
                {(bio.college || bio.height) && (
                  <div style={{ fontSize: 11.5, color: '#cfd8d3', marginTop: 2, opacity: 0.85 }}>
                    {[bio.college, bio.height && `${bio.height}, ${bio.weight}`].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <button onClick={() => setId(null)} aria-label="Close" style={{ position: 'absolute', top: 8, right: 10, cursor: 'pointer', background: 'transparent', border: 'none', fontSize: 22, color: 'rgba(255,255,255,0.75)', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '16px 20px 20px' }}>
              {/* Season at a glance — stat tiles from the overview feed. */}
              {season.length > 0 && (
                <div>
                  <div style={{ ...label, color: theme.goldText }}>Season at a glance</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                    {season.map((s) => (
                      <div key={s.label} style={{ border: `1px solid ${theme.rule}`, borderRadius: 6, padding: '8px 10px', background: theme.wash }}>
                        <div style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                        <div style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, marginTop: 4, whiteSpace: 'nowrap' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {career.length > 0 && (
                    <div style={{ fontSize: 11, color: theme.muted, marginTop: 8 }}>
                      Career: {career.map((c) => `${c.value} ${c.label.toLowerCase()}`).join(' · ')}
                    </div>
                  )}
                </div>
              )}

              {/* Game log: last five by default, the whole season on demand. */}
              {!log ? <div style={{ marginTop: 14 }}><Loading lines={2} /></div> : rows.length > 0 && (
                <div style={{ marginTop: season.length ? 18 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                    <div style={label}>
                      {showAll ? 'Game log' : `Last ${shown.length} games`}{log.season ? ` · ${log.season}` : ''}
                    </div>
                    {rows.length > 5 && (
                      <button onClick={() => setShowAll((v) => !v)} className="link-hover"
                        style={{ cursor: 'pointer', background: 'transparent', border: 'none', fontFamily: theme.sans, fontSize: 11, fontWeight: 700, color: theme.green, padding: 0 }}>
                        {showAll ? 'Show recent' : `Full season — all ${rows.length} games →`}
                      </button>
                    )}
                  </div>
                  {shown.map((g, i) => (
                    <div key={g.eventId} style={{ padding: '7px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11.5 }}>
                        <span style={{ color: theme.goldText, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', width: 46, flexShrink: 0 }}>{day(g.date)}</span>
                        <span style={{ color: theme.ink }}>{g.atVs === '@' ? '@' : 'vs'} {g.oppAbbr}</span>
                        <span style={{ color: resultColor(g.result), fontWeight: 700 }}>{g.result}</span>
                        {g.score && <span style={{ color: theme.muted }}>{g.score}</span>}
                        <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
                          {g.playoff
                            ? <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.green, background: theme.gold, borderRadius: 3, padding: '1px 6px' }}>Playoffs</span>
                            : g.week ? <span style={{ fontSize: 10, color: theme.muted }}>Wk {g.week}</span> : null}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: theme.ink, marginTop: 2, paddingLeft: 54 }}>{statLine(g.stats) || '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
