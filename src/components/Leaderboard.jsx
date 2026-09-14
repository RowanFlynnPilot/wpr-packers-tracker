import { useEffect, useState, useCallback } from 'react'
import { theme } from '../theme.js'
import { fetchLeaderboard } from '../contest.js'
import Section from './Section.jsx'

// The contest standings — the one thing a browser-only pick'em could never have. Two scopes
// (this week / the season), the top 25 plus the reader's own row wherever it sits, and the
// week's winner once every game is final. Refreshes on the page's cadence. Fail-soft: owns
// its Section chrome and renders nothing until a first board arrives; an error after that
// keeps the last board and says so. `onYou(you, playing)` hands the reader's weekly rank up
// for the share card.

const rec = (r) => `${r.correct}–${r.wrong}`

// `saves` ticks up each time the reader's sheet lands on the server, so the board refetches
// right after a pick instead of waiting for the next interval.
export default function Leaderboard({ week, token, saves = 0, onYou }) {
  const [scope, setScope] = useState('week')
  const [board, setBoard] = useState(null)
  const [stale, setStale] = useState(false)

  const load = useCallback(() => {
    fetchLeaderboard(scope, week, token)
      .then((b) => {
        setBoard(b)
        setStale(false)
        if (scope === 'week') onYou?.(b.you, b.playing)
      })
      .catch(() => setStale(true))
  }, [scope, week, token, onYou])

  useEffect(() => {
    setBoard(null)
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 120000)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => { if (saves) load() }, [saves]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!board) return null

  const rows = board.rows
  const inTop = board.you && rows.some((r) => r.rank === board.you.rank && r.name === board.you.name)
  const tiedAtTop = rows.length > 1 && rows[1].rank === 1
  const weekly = scope === 'week'
  const scopeLabel = weekly ? `Week ${board.week}` : 'The season'

  const toggle = (id, text) => (
    <button onClick={() => setScope(id)} aria-pressed={scope === id}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0', marginRight: 18,
        fontFamily: theme.sans, fontSize: 13, fontWeight: scope === id ? 700 : 400, color: scope === id ? theme.green : theme.muted,
        borderBottom: `3px solid ${scope === id ? theme.gold : 'transparent'}`, transition: 'color 0.15s ease, border-color 0.15s ease',
      }}>
      {text}
    </button>
  )

  const row = (r, you) => (
    <tr key={`${r.rank}-${r.name}`} style={{ background: you ? theme.wash : 'transparent' }}>
      <td style={{ padding: '7px 8px', fontFamily: theme.sans, fontSize: 13, color: theme.muted, width: 40 }}>{r.rank}</td>
      <td style={{ padding: '7px 8px', fontFamily: theme.sans, fontSize: 13.5, fontWeight: you ? 700 : 400, color: theme.ink }}>
        {r.name}{you ? <span style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700, marginLeft: 8 }}>You</span> : null}
      </td>
      <td style={{ padding: '7px 8px', fontFamily: theme.sans, fontSize: 13.5, fontWeight: 700, color: theme.ink, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {rec(r)}{r.pending ? <span style={{ fontSize: 11, fontWeight: 400, color: theme.muted }}> · {r.pending} to play</span> : null}
      </td>
      <td style={{ padding: '7px 8px', fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {r.diff == null ? '—' : `±${r.diff}`}
      </td>
    </tr>
  )

  return (
    <Section kicker="The contest" title="Leaderboard">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${theme.rule}`, marginBottom: 12 }}>
        <div>{toggle('week', 'This week')}{toggle('season', 'Season')}</div>
        <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted }}>
          {board.playing} playing{weekly ? '' : ` · ${board.weeks} week${board.weeks === 1 ? '' : 's'}`}
          {stale && <span style={{ color: theme.red }}> · couldn’t refresh</span>}
        </div>
      </div>

      {board.complete && rows.length > 0 && (
        <div style={{ border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`, borderRadius: 8, background: theme.wash, padding: '12px 16px', marginBottom: 14, fontFamily: theme.sans }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>{scopeLabel} · final</div>
          <div style={{ fontFamily: theme.serif, fontSize: 19, color: theme.ink, marginTop: 4 }}>
            {tiedAtTop
              ? <>Tied at the top on {rec(rows[0])} — the tiebreaker and the rules settle it.</>
              : <><strong>{rows[0].name}</strong> takes {weekly ? `Week ${board.week}` : 'the season'} at {rec(rows[0])}{rows[0].diff != null ? `, tiebreaker off by ${rows[0].diff}` : ''}.</>}
          </div>
          <div style={{ fontSize: 11.5, color: theme.muted, marginTop: 4 }}>Prizes go to verified entrants — winners are contacted by email. See the rules.</div>
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ fontFamily: theme.sans, fontSize: 13.5, color: theme.muted }}>No picks are in yet {weekly ? 'this week' : 'this season'} — be the first on the board.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 360 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${theme.green}` }}>
                {['#', 'Entrant', 'Record', 'Tiebreak'].map((h, i) => (
                  <th key={h} scope="col" style={{ padding: '6px 8px', fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => row(r, board.you && r.rank === board.you.rank && r.name === board.you.name))}
              {board.you && !inTop && (
                <>
                  <tr><td colSpan={4} style={{ padding: '2px 8px', fontFamily: theme.sans, fontSize: 12, color: theme.muted, textAlign: 'center' }}>···</td></tr>
                  {row(board.you, true)}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 10, lineHeight: 1.5 }}>
        Most correct calls wins; ties go to the closest tiebreaker{weekly ? '' : ' (fewest total points off across the season)'}, then the earlier entry. Picks lock at each kickoff.
      </div>
    </Section>
  )
}
