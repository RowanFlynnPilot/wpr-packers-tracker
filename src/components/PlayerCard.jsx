import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { headshot } from '../config.js'
import { fetchRoster, fetchAthlete, fetchAthleteOverview, fetchAthleteSeasonStats, fetchGamelog } from '../api.js'
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

// Curated picks for the season tiles, in priority order, keyed `category.stat` on the
// season-pinned stats feed. Every player carries every category (a receiver has a passing
// block full of zeros), so the order IS the position logic: the first non-zero stats a player
// owns are the ones worth six tiles. Zero lines are skipped — "0 forced fumbles" is nobody's
// headline — which is also what keeps a receiver's empty passing block off the card.
const SEASON_PICKS = [
  ['passing.passingYards', 'Pass yds'],
  ['passing.passingTouchdowns', 'Pass TD'],
  ['passing.completionPct', 'Cmp %'],
  ['passing.QBRating', 'Rating'],
  // Interceptions THROWN sit in the passing block, interceptions TAKEN in the defensive one —
  // two different stats under one label. Both are listed, each in its own position; the
  // zero-guard means only the relevant one ever surfaces on a given player's card.
  ['passing.interceptions', 'INT'],
  ['rushing.rushingYards', 'Rush yds'],
  ['rushing.rushingTouchdowns', 'Rush TD'],
  ['rushing.rushingAttempts', 'Carries'],
  ['receiving.receptions', 'Catches'],
  ['receiving.receivingYards', 'Rec yds'],
  ['receiving.receivingTouchdowns', 'Rec TD'],
  ['receiving.receivingTargets', 'Targets'],
  ['defensive.totalTackles', 'Tackles'],
  ['defensive.soloTackles', 'Solo'],
  ['defensive.sacks', 'Sacks'],
  ['defensiveInterceptions.interceptions', 'INT'],
  ['defensive.passesDefended', 'Passes def.'],
  ['general.fumblesForced', 'Forced fum.'],
]
function pickSeason(stats, n) {
  if (!stats) return []
  const out = []
  for (const [key, short] of SEASON_PICKS) {
    const v = stats[key]
    if (v == null || v === '') continue
    const num = parseFloat(String(v).replace(/,/g, ''))
    if (!Number.isFinite(num) || !num) continue
    out.push({ label: short, value: v })
    if (out.length === n) break
  }
  return out
}

// The career line still comes from the overview feed — its Career split is genuinely career,
// and one read covers every position's own categories.
const CAREER_PICKS = [
  ['Passing Yards', 'Pass yds'], ['Passing Touchdowns', 'Pass TD'],
  ['Rushing Yards', 'Rush yds'], ['Rushing Touchdowns', 'Rush TD'],
  ['Receptions', 'Catches'], ['Receiving Yards', 'Rec yds'], ['Receiving Touchdowns', 'Rec TD'],
  ['Total Tackles', 'Tackles'], ['Sacks', 'Sacks'], ['Interceptions', 'INT'],
]
function pickCareer(overview, n) {
  const stats = overview?.splits?.Career
  if (!stats) return []
  const out = []
  for (const [displayName, short] of CAREER_PICKS) {
    const i = overview.displayNames.indexOf(displayName)
    if (i === -1) continue
    const v = stats[i]
    if (v == null || v === '') continue
    const num = parseFloat(String(v).replace(/,/g, ''))
    if (!Number.isFinite(num) || !num) continue
    out.push({ label: short, value: v })
    if (out.length === n) break
  }
  return out
}

// Game-by-game bars for the player's signature counting stat (the log's columns are
// primary-category-first, so the first matching label IS the story: a QB's passing yards, a
// back's rushing yards, a linebacker's tackles). Gold marks the season high. Pure SVG — the
// card stays recharts-free.
const SPARK_LABELS = { YDS: 'Yards', TOT: 'Tackles', TCKL: 'Tackles', SOLO: 'Solo tackles', SACK: 'Sacks', REC: 'Catches' }
function SparkBars({ rows }) {
  const series = [...rows].reverse() // oldest → newest reads like a season
  // Take the first column that actually PLOTS, not the first that merely appears. A defender's
  // log carries a YDS column (interception and fumble returns) that is zero almost every week;
  // stopping at it because it exists left every defensive card without its bars.
  const read = (l) => series.map((g) => {
    const s = g.stats.find((x) => x.label === l)
    const v = parseFloat(String(s?.value ?? '').replace(/,/g, ''))
    return Number.isFinite(v) ? v : 0
  })
  let pick = null
  let vals = null
  for (const l of Object.keys(SPARK_LABELS)) {
    const v = read(l)
    if (v.filter((x) => x > 0).length >= 3) { pick = l; vals = v; break }
  }
  if (!pick) return null
  const max = Math.max(...vals)
  const BAR = 9, GAP = 3, H = 42
  const width = vals.length * (BAR + GAP) - GAP
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ ...label, marginBottom: 6 }}>{SPARK_LABELS[pick]} by game</div>
      <svg width={width} height={H} role="img" aria-label={`${SPARK_LABELS[pick]} per game across the season`} style={{ display: 'block', maxWidth: '100%' }}>
        {vals.map((v, i) => {
          const h = Math.max(2, (v / max) * (H - 4))
          return <rect key={i} x={i * (BAR + GAP)} y={H - h} width={BAR} height={h} rx={1.5}
            fill={v === max ? theme.gold : theme.green} />
        })}
      </svg>
      <div style={{ fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 4 }}>
        Season high {max.toLocaleString('en-US')} · {vals.length} games, oldest to newest
      </div>
    </div>
  )
}

export default function PlayerCardHost() {
  const [id, setId] = useState(null)
  const [bio, setBio] = useState(null)
  const [log, setLog] = useState(null)
  const [overview, setOverview] = useState(null)
  const [seasonStats, setSeasonStats] = useState(null)
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
    setSeasonStats(null)
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
    fetchAthleteSeasonStats(id).then((s) => { if (alive) setSeasonStats(s) }).catch(() => {})
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
  const season = pickSeason(seasonStats, 6)
  const career = pickCareer(overview, 3)
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
              <img src={headshot(id, 76)} alt="" width={76} height={76} decoding="async"
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
              {/* Season at a glance — tiles pinned to the season the tracker is describing, so
                  the header names the year rather than leaving the reader to guess. */}
              {season.length > 0 && (
                <div>
                  <div style={{ ...label, color: theme.goldText }}>{log?.season ? `${log.season} season` : 'Season'} at a glance</div>
                  {/* Column count follows the tile count so the last row is never one orphan
                      beside two empty cells — four stats read as 2×2, not 3+1. */}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${season.length <= 2 ? season.length : season.length % 3 === 0 ? 3 : season.length % 2 === 0 ? 2 : 3}, 1fr)`, gap: 8, marginTop: 8 }}>
                    {season.map((s) => (
                      <div key={s.label} style={{ border: `1px solid ${theme.rule}`, borderRadius: 6, padding: '8px 10px', background: theme.wash }}>
                        <div style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                        <div style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, marginTop: 4, whiteSpace: 'nowrap' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Career reads on its own: a rookie with no season tiles yet still has a line,
                  and a veteran's career total is the fact that outlives any one season. */}
              {career.length > 0 && (
                <div style={{ fontSize: 11, color: theme.muted, marginTop: season.length ? 8 : 0 }}>
                  Career: {career.map((c) => `${c.value} ${c.label.toLowerCase()}`).join(' · ')}
                </div>
              )}

              {/* Game-by-game shape of the season, then the log itself. */}
              {rows.length > 0 && <SparkBars rows={rows} />}

              {/* Game log: last five by default, the whole season on demand. */}
              {!log ? <div style={{ marginTop: 14 }}><Loading lines={2} /></div> : rows.length > 0 && (
                <div style={{ marginTop: season.length || career.length ? 18 : 0 }}>
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
