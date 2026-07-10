import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, DIVISION, SEASON } from '../config.js'
import { fetchStatsSeason, fetchTeamSchedule } from '../api.js'
import { vsDivision } from '../games.js'
import TeamLogo from './TeamLogo.jsx'

// Head-to-head vs each division rival — a slim strip under the standings table, from the cached
// Packers schedule (zero extra fetches in season). Fail-soft: renders nothing without results.
export default function VsNorth() {
  const [records, setRecords] = useState(null)
  const [season, setSeason] = useState(null)

  useEffect(() => {
    let alive = true
    fetchStatsSeason().then(async (s) => {
      const { games } = await fetchTeamSchedule(TEAM_ID, s, 2)
      if (!alive) return
      setSeason(s)
      setRecords(vsDivision(games))
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!records || !Object.keys(records).length) return null

  const rivals = Object.keys(DIVISION).map(Number).filter((id) => id !== TEAM_ID && records[id])
  const stale = season && season < SEASON
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, marginBottom: 8 }}>
        Packers vs the North{stale ? ` · ${season}` : ' this season'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {rivals.map((id) => {
          const r = records[id]
          const up = r.w > r.l
          return (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${theme.rule}`, borderRadius: 6, padding: '5px 10px', background: up ? theme.wash : '#fff' }}>
              <TeamLogo id={id} size={16} />
              <span style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.ink }}>
                <span style={{ fontWeight: 700, color: up ? theme.green : r.w < r.l ? theme.red : theme.ink }}>{r.w}–{r.l}{r.t ? `–${r.t}` : ''}</span>
                {' '}vs {DIVISION[id]}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
