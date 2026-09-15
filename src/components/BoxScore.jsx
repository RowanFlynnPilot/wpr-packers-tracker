import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, TEAM_NAMES, teamLogo, headshot } from '../config.js'
import { fetchGameSummary } from '../api.js'
import { track } from '../analytics.js'
import { useModalFocus } from '../useModalFocus.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { Loading } from './Status.jsx'

// Box-score modal for a completed (or live) game, from one cached summary read: the quarter
// linescore, the team-stat comparison, and both teams' passing/rushing/receiving lines with
// headshots. Fail-soft: a failed fetch just closes the modal.

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
  if (!homeC?.linescores?.length || !awayC?.linescores?.length) return null
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
        <div key={r.lab} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '6px 0', borderTop: `1px solid ${theme.rule}` }}>
          <span style={{ fontFamily: theme.sans, fontSize: 13, fontWeight: 700, color: theme.ink, width: 84 }}>{r.a}</span>
          <span style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.muted, textAlign: 'center', flex: 1 }}>{r.lab}</span>
          <span style={{ fontFamily: theme.sans, fontSize: 13, color: theme.ink, width: 84, textAlign: 'right' }}>{r.b}</span>
        </div>
      ))}
    </div>
  )
}

// "J. Love" on phones, where a headshot plus a full name would push the numbers off-screen.
const playerName = (athlete, narrow) =>
  narrow && athlete.firstName && athlete.lastName ? `${athlete.firstName[0]}. ${athlete.lastName}` : athlete.displayName

// One stat group ("passing") for both teams: one table, so the columns line up QB against QB,
// with the Packers' rows first under a team label and the opponent's beneath. `sides` is
// [{ team, group }] in that order. Columns come from the first side's keys and are matched by
// key on the other, so the table can't misalign if the feed ever orders them differently.
function PlayerGroup({ sides, narrow }) {
  const rows = sides
    .map((s) => ({ ...s, athletes: (s.group?.athletes || []).filter((a) => a.stats?.length) }))
    .filter((s) => s.athletes.length)
  if (!rows.length) return null
  const lead = rows[0].group
  // Keep tables phone-friendly: the first 5 stat columns carry the story (YDS, TD, …).
  const keys = (lead.keys || []).slice(0, 5)
  const labels = (lead.labels || []).slice(0, keys.length)
  const avatar = narrow ? 22 : 26
  const pad = narrow ? '5px 4px' : '5px 6px'
  const th = { fontFamily: theme.sans, fontSize: 9.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, textAlign: 'right', padding: narrow ? '4px 4px' : '4px 6px' }
  const td = { fontFamily: theme.sans, fontSize: 12, color: theme.ink, textAlign: 'right', padding: pad, borderTop: `1px solid ${theme.rule}`, whiteSpace: 'nowrap', verticalAlign: 'middle' }
  return (
    <div style={{ marginTop: 16 }}>
      {/* The feed's own `text` is per team ("Green Bay Passing"); this table holds both. */}
      <div style={{ ...label, marginBottom: 4 }}>{lead.name.charAt(0).toUpperCase() + lead.name.slice(1)}</div>
      {/* The table scrolls inside its own wrapper on narrow phones — otherwise the whole
          modal pans sideways and drags the linescore with it. */}
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Player</th>
              {labels.map((l) => <th key={l} style={th}>{l}</th>)}
            </tr>
          </thead>
          {rows.map(({ team, group, athletes }, t) => {
            const id = Number(team.id)
            const isMe = id === TEAM_ID
            const col = keys.map((k) => (group.keys || []).indexOf(k))
            return (
              <tbody key={id}>
                <tr>
                  <th colSpan={keys.length + 1} scope="rowgroup"
                    style={{ ...label, textAlign: 'left', padding: `${t ? 12 : 6}px 0 4px`, color: isMe ? theme.green : theme.ink }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <img src={teamLogo(id)} alt="" width={14} height={14} loading="lazy" decoding="async" style={{ objectFit: 'contain' }}
                        onError={(e) => { e.currentTarget.style.display = 'none' }} />
                      {TEAM_NAMES[id] || team.abbreviation}
                    </span>
                  </th>
                </tr>
                {athletes.map((a) => (
                  <tr key={a.athlete?.id || a.athlete?.displayName}>
                    <td style={{ ...td, textAlign: 'left' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: narrow ? 6 : 8 }}>
                        {/* The wash circle holds the row's shape when a player has no photo. */}
                        <span style={{ width: avatar, height: avatar, borderRadius: '50%', background: theme.wash, overflow: 'hidden', flexShrink: 0, display: 'inline-block' }}>
                          {a.athlete?.id && a.athlete?.headshot && (
                            <img src={headshot(a.athlete.id, avatar)} alt="" width={avatar} height={avatar} loading="lazy" decoding="async"
                              style={{ display: 'block', width: avatar, height: avatar, objectFit: 'cover' }}
                              onError={(e) => { e.currentTarget.style.display = 'none' }} />
                          )}
                        </span>
                        <span style={{ fontFamily: theme.serif, fontSize: 13, fontWeight: isMe ? 600 : 400 }}>{playerName(a.athlete || {}, narrow)}</span>
                      </span>
                    </td>
                    {col.map((i, c) => <td key={keys[c]} style={td}>{i >= 0 ? a.stats[i] : ''}</td>)}
                  </tr>
                ))}
              </tbody>
            )
          })}
        </table>
      </div>
    </div>
  )
}

export default function BoxScore({ eventId, dateLabel, onClose }) {
  const [summary, setSummary] = useState(null)
  const dialogRef = useRef(null)
  const narrow = useIsNarrow()
  useModalFocus(dialogRef)

  // Keyed on eventId ONLY: `onClose` is an inline closure in the caller, so including it would
  // re-run this effect (and re-fire the Box Score analytics event) on every refresh tick of the
  // page behind the modal — inflating the engagement numbers sponsors are shown.
  useEffect(() => {
    track('Box Score')
    let alive = true
    fetchGameSummary(eventId).then((s) => { if (alive) setSummary(s) }).catch(() => { if (alive) onClose() })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- eventId pins the fetch + the one tracking event
  }, [eventId])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Both teams, Packers first — the tracker's side leads every comparison in the modal.
  const teamsPlayers = [...(summary?.boxscore?.players || [])]
    .sort((a, b) => (Number(b.team?.id) === TEAM_ID) - (Number(a.team?.id) === TEAM_ID))
  const groups = ['passing', 'rushing', 'receiving'].map((name) => ({
    name,
    sides: teamsPlayers.map((p) => ({ team: p.team, group: (p.statistics || []).find((g) => g.name === name) })),
  }))

  return (
    <div ref={dialogRef} onClick={onClose} role="dialog" aria-modal="true" aria-label="Box score"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(32,55,49,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, borderTop: `4px solid ${theme.gold}`, maxWidth: 480, width: '100%', maxHeight: '86vh', overflowY: 'auto', padding: '20px 22px', fontFamily: theme.sans, position: 'relative' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 10, right: 12, cursor: 'pointer', background: 'transparent', border: 'none', fontSize: 22, color: theme.muted, lineHeight: 1 }}>×</button>

        <div style={{ fontFamily: theme.serif, fontSize: 20, color: theme.ink }}>Box score</div>
        <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 2 }}>{dateLabel}</div>

        {!summary ? <Loading lines={3} /> : (
          <>
            <Linescore summary={summary} />
            <TeamCompare summary={summary} />
            {groups.map((g) => <PlayerGroup key={g.name} sides={g.sides} narrow={narrow} />)}
          </>
        )}
      </div>
    </div>
  )
}
