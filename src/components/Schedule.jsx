import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { fetchSeasonGames } from '../api.js'
import { scheduleNotes } from '../games.js'
import { Loading, ErrorState } from './Status.jsx'
import TeamLogo from './TeamLogo.jsx'
import BoxScore from './BoxScore.jsx'
import CalendarButton from './CalendarButton.jsx'

const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// The full season, one row per week — an NFL schedule is 17 games and reads best as a list.
// Completed games open the box score; upcoming games show kickoff + TV; the bye week sits in
// its own quiet row. Preseason and postseason get their own groups when they exist.
export default function Schedule() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [openGame, setOpenGame] = useState(null) // { id, label } for the box-score modal

  // Initial fetch + a gentle refresh so a live score on the row stays current (the hero polls
  // faster on its own). Refresh failures keep the prior data rather than blanking the list.
  useEffect(() => {
    fetchSeasonGames().then(setData).catch(() => setError(true))
    const id = setInterval(() => {
      if (!document.hidden) fetchSeasonGames().then(setData).catch(() => {})
    }, 120000)
    return () => clearInterval(id)
  }, [])

  if (error) return <ErrorState />
  if (!data) return <Loading />

  const groups = [
    { key: 1, label: 'Preseason', games: data.games.filter((g) => g.seasonType === 1) },
    { key: 2, label: null, games: data.games.filter((g) => g.seasonType === 2) },
    { key: 3, label: 'Playoffs', games: data.games.filter((g) => g.seasonType === 3) },
  ].filter((grp) => grp.games.length)

  const notes = scheduleNotes(data.games.filter((g) => g.seasonType === 2))

  const Row = ({ g }) => {
    const final = g.state === 'post'
    const live = g.state === 'in'
    const openable = final || live
    const label = `${g.seasonType === 1 ? 'Pre ' : g.seasonType === 3 ? '' : 'Wk '}${g.seasonType === 3 ? (g.note || 'Playoff') : g.week ?? ''}`
    const open = () => openable && setOpenGame({ id: g.id, label: `${g.home ? 'vs' : '@'} ${g.oppName} · ${fmtDay(g.date)}` })
    return (
      <div
        className={`game-card${live ? ' is-live' : ''}${openable ? ' is-open' : ''}`}
        onClick={open}
        onKeyDown={(e) => { if (openable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open() } }}
        role={openable ? 'button' : undefined}
        tabIndex={openable ? 0 : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
      >
        <span style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: live ? theme.goldText : theme.muted, width: 74, flexShrink: 0 }}>
          {label}
          <span style={{ display: 'block', fontWeight: 400, marginTop: 2 }}>{fmtDay(g.date)}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: '1 1 150px', minWidth: 0 }}>
          <TeamLogo id={g.oppId} size={22} />
          <span style={{ fontFamily: theme.serif, fontSize: 17, color: theme.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {g.home ? 'vs' : '@'} {g.oppName}
          </span>
        </span>
        {final || live ? (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, marginLeft: 'auto' }}>
            {live && <span style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: theme.goldText }}>LIVE · {g.detail}</span>}
            <span style={{ fontFamily: theme.serif, fontSize: 19, color: g.tied ? theme.muted : g.won ? theme.green : final ? theme.red : theme.ink }}>
              {final && <span style={{ fontWeight: 700 }}>{g.tied ? 'T' : g.won ? 'W' : 'L'} </span>}
              <span style={{ color: g.won ? theme.green : theme.ink }}>{g.meScore}–{g.oppScore}</span>
            </span>
            {final && <span style={{ fontFamily: theme.sans, fontSize: 11, fontWeight: 700, color: theme.goldText }}>Box score →</span>}
          </span>
        ) : (
          <span style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginLeft: 'auto', textAlign: 'right' }}>
            {g.timeValid ? fmtTime(g.date) : 'Time TBD'}{g.tv ? ` · ${g.tv}` : ''}
            <span style={{ display: 'block', fontSize: 11, marginTop: 1 }}>{g.home ? 'Lambeau Field' : g.venue}</span>
          </span>
        )}
      </div>
    )
  }

  const ByeRow = ({ week }) => (
    <div className="game-card" style={{ display: 'flex', alignItems: 'center', gap: 12, background: theme.wash }}>
      <span style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.muted, width: 74 }}>Wk {week}</span>
      <span style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 15, color: theme.muted }}>Bye week — feet up.</span>
    </div>
  )

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 14.5, color: theme.muted }}>
          {notes.join(' · ')}
        </div>
        <CalendarButton />
      </div>
      {groups.map((grp) => (
        <div key={grp.key} style={{ marginBottom: 18 }}>
          {grp.label && (
            <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700, margin: '6px 0 10px' }}>
              {grp.label}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {grp.games.flatMap((g) => {
              const rows = []
              if (grp.key === 2 && data.byeWeek && g.week === data.byeWeek + 1) rows.push(<ByeRow key="bye" week={data.byeWeek} />)
              rows.push(<Row key={g.id} g={g} />)
              return rows
            })}
          </div>
        </div>
      ))}
      {openGame && <BoxScore eventId={openGame.id} dateLabel={openGame.label} onClose={() => setOpenGame(null)} />}
    </>
  )
}
