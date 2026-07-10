import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID } from '../config.js'
import { fetchGameSummary } from '../api.js'
import { track } from '../analytics.js'
import { Loading } from './Status.jsx'

// Box-score modal for a completed (or live) game, from one cached summary read: the quarter
// linescore, the team-stat comparison, and each side's passing/rushing/receiving lines.
// Fail-soft: a failed fetch just closes the modal.

const label = { fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700 }

// The team stats worth comparing, in reading order (ESPN's list is longer than a modal wants).
const TEAM_STATS = [
  ['totalYards', 'Total yards'],
  ['netPassingYards', 'Passing yards'],
  ['rushingYards', 'Rushing yards'],
  ['firstDowns', 'First downs'],
  ['thirdDownEff', 'Third downs'],
  ['turnovers', 'Turnovers'],
  ['sacksYardsLost', 'Sacks-yards'],
  ['totalPenaltiesYards', 'Penalties'],
  ['possessionTime', 'Possession'],
]

function Linescore({ summary }) {
  const comps = summary?.header?.competitions?.[0]?.competitors || []
  const homeC = comps.find((c) => c.homeAway === 'home')
  const awayC = comps.find((c) => c.homeAway === 'away')
  if (!homeC?.linescores?.length) return null
  const periods = Math.max(homeC.linescores.length, awayC.linescores.length)
  const cell = { padding: '3px 8px', fontFamily: theme.sans, fontSize: 12.5, textAlign: 'center', color: theme.ink }
  const head = { ...cell, fontSize: 10, color: theme.muted, fontWeight: 700 }
  return (
    <table style={{ width: 'auto', margin: '14px auto 0' }}>
      <thead>
        <tr>
          <th style={{ ...head, textAlign: 'left' }} />
          {Array.from({ length: periods }).map((_, i) => <th key={i} style={head}>{i < 4 ? i + 1 : 'OT'}</th>)}
          <th style={{ ...head, borderLeft: `1px solid ${theme.rule}` }}>T</th>
        </tr>
      </thead>
      <tbody>
        {[awayC, homeC].map((c) => {
          const isMe = Number(c.team.id) === TEAM_ID
          return (
            <tr key={c.team.id}>
              <td style={{ ...cell, textAlign: 'left', fontFamily: theme.serif, fontWeight: isMe ? 700 : 400, color: isMe ? theme.green : theme.ink }}>{c.team.abbreviation}</td>
              {Array.from({ length: periods }).map((_, i) => <td key={i} style={cell}>{c.linescores?.[i]?.displayValue ?? ''}</td>)}
              <td style={{ ...cell, fontWeight: 700, borderLeft: `1px solid ${theme.rule}` }}>{c.score}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function TeamCompare({ summary }) {
  const teams = summary?.boxscore?.teams || []
  if (teams.length !== 2) return null
  const mine = teams.find((t) => Number(t.team.id) === TEAM_ID)
  const other = teams.find((t) => Number(t.team.id) !== TEAM_ID)
  if (!mine || !other) return null
  const get = (t, name) => (t.statistics || []).find((s) => s.name === name)?.displayValue ?? null
  const rows = TEAM_STATS.map(([name, lab]) => {
    const a = get(mine, name)
    const b = get(other, name)
    return a != null && b != null ? { lab, a, b } : null
  }).filter(Boolean)
  if (!rows.length) return null
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ ...label, color: theme.green }}>Packers</span>
        <span style={label}>{other.team.abbreviation}</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.lab} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '6px 0', borderTop: i ? `1px solid ${theme.rule}` : `1px solid ${theme.rule}` }}>
          <span style={{ fontFamily: theme.sans, fontSize: 13, fontWeight: 700, color: theme.ink, width: 84 }}>{r.a}</span>
          <span style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.muted, textAlign: 'center', flex: 1 }}>{r.lab}</span>
          <span style={{ fontFamily: theme.sans, fontSize: 13, color: theme.ink, width: 84, textAlign: 'right' }}>{r.b}</span>
        </div>
      ))}
    </div>
  )
}

// One stat group ("passing") for one team: a small table of player lines.
function PlayerGroup({ group }) {
  const athletes = (group.athletes || []).filter((a) => a.stats?.length)
  if (!athletes.length) return null
  const labels = group.labels || []
  // Keep tables phone-friendly: the first 5 stat columns carry the story (YDS, TD, …).
  const keep = Math.min(5, labels.length)
  const th = { fontFamily: theme.sans, fontSize: 9.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, textAlign: 'right', padding: '4px 6px' }
  const td = { fontFamily: theme.sans, fontSize: 12, color: theme.ink, textAlign: 'right', padding: '5px 6px', borderTop: `1px solid ${theme.rule}`, whiteSpace: 'nowrap' }
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...label, marginBottom: 4 }}>{group.text || group.name}</div>
      <table>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Player</th>
            {labels.slice(0, keep).map((l) => <th key={l} style={th}>{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {athletes.map((a) => (
            <tr key={a.athlete?.id || a.athlete?.displayName}>
              <td style={{ ...td, textAlign: 'left', fontFamily: theme.serif, fontSize: 13 }}>{a.athlete?.shortName || a.athlete?.displayName}</td>
              {a.stats.slice(0, keep).map((v, i) => <td key={i} style={td}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function BoxScore({ eventId, dateLabel, onClose }) {
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    track('Box Score')
    let alive = true
    fetchGameSummary(eventId).then((s) => { if (alive) setSummary(s) }).catch(() => { if (alive) onClose() })
    return () => { alive = false }
  }, [eventId, onClose])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const packersSide = (summary?.boxscore?.players || []).find((p) => Number(p.team?.id) === TEAM_ID)
  const groups = (packersSide?.statistics || []).filter((g) => ['passing', 'rushing', 'receiving'].includes(g.name))

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Box score"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(32,55,49,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, borderTop: `4px solid ${theme.gold}`, maxWidth: 480, width: '100%', maxHeight: '86vh', overflowY: 'auto', padding: '20px 22px', fontFamily: theme.sans, position: 'relative' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 10, right: 12, cursor: 'pointer', background: 'transparent', border: 'none', fontSize: 22, color: theme.muted, lineHeight: 1 }}>×</button>

        <div style={{ fontFamily: theme.serif, fontSize: 20, color: theme.ink }}>Box score</div>
        <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 2 }}>{dateLabel}</div>

        {!summary ? <Loading lines={3} /> : (
          <>
            <Linescore summary={summary} />
            <TeamCompare summary={summary} />
            {groups.map((g) => <PlayerGroup key={g.name} group={g} />)}
          </>
        )}
      </div>
    </div>
  )
}
