import { useEffect, useState, lazy, Suspense } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, TEAM_NAMES, SEASON } from '../config.js'
import { fetchStatsSeason, fetchTeamSchedule, fetchGameSummary } from '../api.js'
import { finals, gameFlow, bigPlays, teamGameLeaders } from '../games.js'
import { headshot } from '../config.js'
import Section from './Section.jsx'
import ScoringPlays from './ScoringPlays.jsx'
import BigPlays from './BigPlays.jsx'
import { Loading, ErrorState } from './Status.jsx'

// Recharts is the heaviest dependency — the win-probability chart loads in its own chunk.
const GameFlow = lazy(() => import('./GameFlow.jsx'))

// The film room: pick any completed game, get the win-probability flow, the scoring plays, the
// chunk plays, and the top performers — all from one cached summary read per game. Before Week 1
// it replays last season's games (labeled), so there's film on the wall year-round.
export default function FilmRoom() {
  const [games, setGames] = useState(null)
  const [season, setSeason] = useState(null)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState('')
  const [summary, setSummary] = useState(null)
  const [summaryError, setSummaryError] = useState(false)

  useEffect(() => {
    let alive = true
    fetchStatsSeason().then(async (s) => {
      const [reg, post] = await Promise.all([
        fetchTeamSchedule(TEAM_ID, s, 2),
        fetchTeamSchedule(TEAM_ID, s, 3).catch(() => ({ games: [] })),
      ])
      if (!alive) return
      const done = [...finals(reg.games), ...finals(post.games)]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
      setSeason(s)
      setGames(done)
      if (done.length) setSelected(done[0].id)
    }).catch(() => setError(true))
    return () => { alive = false }
  }, [])

  // A failed summary resolves to an error state, never an eternal skeleton — picking any game
  // (including re-picking this one via the dropdown) retries it.
  useEffect(() => {
    setSummary(null)
    setSummaryError(false)
    if (!selected) return
    let alive = true
    fetchGameSummary(selected).then((s) => { if (alive) setSummary(s) }).catch(() => { if (alive) setSummaryError(true) })
    return () => { alive = false }
  }, [selected])

  if (error) return <Section kicker="The film room" title="How it unfolded"><ErrorState /></Section>
  if (!games) return <Section kicker="The film room" title="How it unfolded"><Loading /></Section>
  if (!games.length) {
    return (
      <Section kicker="The film room" title="How it unfolded">
        <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>The film room opens after the first game.</div>
      </Section>
    )
  }

  const game = games.find((g) => g.id === selected)
  const flow = summary && game ? gameFlow(summary, game.home) : null
  const chunks = summary ? bigPlays(summary) : null
  const leaders = summary ? teamGameLeaders(summary, TEAM_ID, ['passingYards', 'rushingYards', 'receivingYards', 'sacks', 'totalTackles']) : []
  const oppName = game ? (TEAM_NAMES[game.oppId] || game.oppName) : ''

  const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const optionLabel = (g) =>
    `${g.seasonType === 3 ? (g.note || 'Playoffs') : `Wk ${g.week}`} · ${g.home ? 'vs' : '@'} ${g.oppName} · ${g.tied ? 'T' : g.won ? 'W' : 'L'} ${g.meScore}–${g.oppScore} · ${fmtDay(g.date)}`

  return (
    <>
      <Section kicker="The film room" title="How it unfolded">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <label htmlFor="film-game" style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700 }}>Game</label>
          <select
            id="film-game"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            style={{ fontFamily: theme.sans, fontSize: 13, color: theme.ink, background: '#fff', border: `1px solid ${theme.rule}`, borderRadius: 6, padding: '7px 10px', maxWidth: '100%' }}
          >
            {games.map((g) => <option key={g.id} value={g.id}>{optionLabel(g)}</option>)}
          </select>
          {season < SEASON && (
            <span style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>Replaying {season} until the new season kicks off.</span>
          )}
        </div>

        {summaryError ? <ErrorState /> : !summary ? <Loading block /> : (
          <>
            <Suspense fallback={<Loading block />}>
              <GameFlow flow={flow} oppName={oppName} />
            </Suspense>

            {leaders.length > 0 && (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 22 }}>
                {leaders.map((l) => (
                  <div key={l.cat} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 170px' }}>
                    <img src={headshot(l.id)} alt="" width={32} height={32} loading="lazy" decoding="async" style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: theme.sans, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>{l.cat}</div>
                      <div style={{ fontFamily: theme.sans, fontSize: 11.5, color: theme.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <strong>{l.name}</strong> <span style={{ color: theme.muted }}>· {l.line}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      {summary && game && (
        <Section kicker="Play by play" title="How the points went up">
          <ScoringPlays summary={summary} packersHome={game.home} />
        </Section>
      )}

      {chunks?.length > 0 && (
        <Section kicker="Explosives" title="The chunk plays">
          <BigPlays plays={chunks} />
        </Section>
      )}
    </>
  )
}
