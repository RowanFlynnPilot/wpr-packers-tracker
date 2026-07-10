import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { headshot } from '../config.js'
import { fetchRoster, fetchGamelog } from '../api.js'
import { track } from '../analytics.js'
import { Loading } from './Status.jsx'

// Tap-any-player modal. One host mounts in App; every roster surface (leader tables,
// injuries, spotlights) calls openPlayerCard(id) — a module-level hook so callers don't
// thread props through the tree. Card: bio + the last five game lines from the game log.
// Fail-soft: a failed fetch just closes the card.
let listener = null
export function openPlayerCard(id) {
  if (listener) listener(id)
}

const label = { fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b6b6b', fontWeight: 700 }

// The log's columns are ordered primary-category-first (a back's carries before his catches),
// so the first few non-noise columns ARE the story of the player's game.
const NOISE = new Set(['LNG', 'AVG'])
function statLine(stats) {
  return stats
    .filter((s) => s.value != null && s.value !== '' && !NOISE.has(s.label))
    .slice(0, 4)
    .map((s) => `${s.value} ${s.label.toLowerCase()}`)
    .join(' · ')
}

export default function PlayerCardHost() {
  const [id, setId] = useState(null)
  const [bio, setBio] = useState(null)
  const [log, setLog] = useState(null)

  useEffect(() => {
    listener = (pid) => { setId(pid); track('Player Card') }
    return () => { listener = null }
  }, [])

  useEffect(() => {
    setBio(null)
    setLog(null)
    if (!id) return
    let alive = true
    fetchRoster().then(({ byId }) => { if (alive) setBio(byId[id] || {}) }).catch(() => { if (alive) setId(null) })
    fetchGamelog(id).then((g) => { if (alive) setLog(g) }).catch(() => { if (alive) setLog({ rows: [] }) })
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
  const rows = (log?.rows || []).slice(0, 5)

  return (
    <div onClick={() => setId(null)} role="dialog" aria-modal="true" aria-label="Player card"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(32,55,49,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, borderTop: `4px solid ${theme.gold}`, maxWidth: 440, width: '100%', maxHeight: '86vh', overflowY: 'auto', padding: '20px 22px', fontFamily: theme.sans, position: 'relative' }}>
        <button onClick={() => setId(null)} aria-label="Close" style={{ position: 'absolute', top: 10, right: 12, cursor: 'pointer', background: 'transparent', border: 'none', fontSize: 22, color: theme.muted, lineHeight: 1 }}>×</button>

        {!bio ? <Loading lines={3} /> : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img src={headshot(id)} alt="" width={64} height={64} style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: theme.serif, fontSize: 22, color: theme.ink, lineHeight: 1.1 }}>{bio.name || 'Player'}</div>
                <div style={{ fontSize: 12, color: theme.muted, marginTop: 3 }}>
                  {[bio.pos, bio.jersey && `#${bio.jersey}`, bio.age && `Age ${bio.age}`,
                    bio.exp != null && (bio.exp === 0 ? 'Rookie' : `Year ${bio.exp + 1}`)].filter(Boolean).join(' · ')}
                </div>
                {(bio.college || bio.height) && (
                  <div style={{ fontSize: 11.5, color: theme.muted, marginTop: 2 }}>
                    {[bio.college, bio.height && `${bio.height}, ${bio.weight}`].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </div>

            {!log ? <div style={{ marginTop: 14 }}><Loading lines={2} /></div> : rows.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ ...label, marginBottom: 4 }}>Last {rows.length} games{log.season ? ` · ${log.season}` : ''}</div>
                {rows.map((g, i) => (
                  <div key={g.eventId} style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '5px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none' }}>
                    <span style={{ color: theme.goldText, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', width: 50, flexShrink: 0, paddingTop: 1 }}>{day(g.date)}</span>
                    <span style={{ color: theme.muted, width: 78, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {g.atVs === '@' ? '@' : 'vs'} {g.oppAbbr}
                      <span style={{ color: g.result === 'W' ? theme.green : g.result === 'L' ? theme.red : theme.muted, fontWeight: 700 }}> {g.result}</span>
                    </span>
                    <span style={{ color: theme.ink }}>{statLine(g.stats) || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
