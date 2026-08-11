import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { SEASON, TEAM_NAMES } from '../config.js'
import { fetchSeasonGames, fetchStatsSeason } from '../api.js'
import TeamLogo from './TeamLogo.jsx'
import Section from './Section.jsx'

const REFRESH_MS = 120000

const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

// "The tune-ups" — the exhibition slate on the Season tab, shown only while it's the live
// story: after the preseason schedule exists and before the new season's first real final
// (the same window the digest mini uses to stand in for the standings). Results fill in game
// by game; at Week 1 the section retires and the tab's regular sections carry the season.
// Owns its Section; fail-soft — no preseason schedule, no section.
export default function PreseasonSlate() {
  const [data, setData] = useState(null) // { slate, opener }

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (await fetchStatsSeason() === SEASON) return // the real season has begun — sit out
      const { games } = await fetchSeasonGames()
      const slate = games.filter((g) => g.seasonType === 1)
      if (alive && slate.length) {
        setData({ slate, opener: games.find((g) => g.seasonType === 2 && g.state === 'pre') || null })
      }
    }
    load().catch(() => {})
    const id = setInterval(() => { if (!document.hidden) load().catch(() => {}) }, REFRESH_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  if (!data) return null
  const { slate, opener } = data
  const nextId = slate.find((g) => g.state === 'pre')?.id ?? null

  return (
    <Section kicker="The tune-ups" title="The preseason slate">
      {slate.map((g, i) => {
        const right = g.state === 'post' ? (
          <span style={{ fontFamily: theme.serif, fontSize: 18, fontWeight: 700, color: g.won ? theme.green : g.tied ? theme.muted : theme.red, whiteSpace: 'nowrap' }}>
            {g.won ? 'W' : g.tied ? 'T' : 'L'} {g.won ? `${g.meScore}–${g.oppScore}` : `${g.oppScore}–${g.meScore}`}
          </span>
        ) : g.state === 'in' ? (
          <span style={{ fontFamily: theme.serif, fontSize: 18, fontWeight: 700, color: theme.red, whiteSpace: 'nowrap' }}>
            {g.meScore}–{g.oppScore} <span style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live</span>
          </span>
        ) : (
          <span style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, whiteSpace: 'nowrap' }}>
            {g.timeValid ? `${fmtTime(g.date)}${g.tv ? ` · ${g.tv}` : ''}` : 'Time TBD'}
          </span>
        )
        return (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px', borderTop: i ? `1px solid ${theme.rule}` : 'none' }}>
            <span style={{ width: 62, flexShrink: 0, fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700 }}>
              Wk {g.week}
              <span style={{ display: 'block', fontWeight: 400, marginTop: 2 }}>{fmtDay(g.date)}</span>
              {g.id === nextId && (
                <span style={{ display: 'inline-block', background: theme.gold, color: theme.green, borderRadius: 8, padding: '1px 7px', fontSize: 8.5, letterSpacing: '0.1em', marginTop: 3 }}>Next</span>
              )}
            </span>
            <TeamLogo id={g.oppId} size={26} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: theme.serif, fontSize: 16, color: theme.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {g.home ? 'vs' : 'at'} {TEAM_NAMES[g.oppId] || g.oppName}
              </div>
              <div style={{ fontFamily: theme.sans, fontSize: 11.5, color: theme.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {g.venue}
              </div>
            </div>
            {right}
          </div>
        )
      })}
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 12 }}>
        Tune-ups only — nothing carries over.
        {opener && <> The games that count start {fmtDate(opener.date)} {opener.home ? 'against' : 'at'} the {TEAM_NAMES[opener.oppId] || opener.oppName}.</>}
      </div>
    </Section>
  )
}
