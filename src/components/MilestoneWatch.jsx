import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SEASON, GAMES_IN_SEASON, headshot } from '../config.js'
import { fetchTeamLeaders, fetchTeamSchedule } from '../api.js'
import { openPlayerCard } from './PlayerCard.jsx'
import Section from './Section.jsx'

// "Milestone watch" — who's tracking toward the numbers fans actually talk about (a 4,000-yard
// passer, a 1,000-yard back), from the leader totals we already fetch: pace = total / games
// played × 17. Live-season only — a finished season has results, not paces — so this section
// builds now and switches itself on after Week 1. Owns its Section; fail-soft.
const MILESTONES = {
  passingYards: { targets: [4000, 5000], label: 'pass yds' },
  rushingYards: { targets: [1000, 1500], label: 'rush yds' },
  receivingYards: { targets: [1000, 1500], label: 'rec yds' },
  receptions: { targets: [100], label: 'catches' },
  sacks: { targets: [10, 15], label: 'sacks' },
  totalTackles: { targets: [150], label: 'tackles' },
  interceptions: { targets: [5], label: 'INTs' },
}
const fmt = (n) => n.toLocaleString('en-US')

export default function MilestoneWatch() {
  const [items, setItems] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const data = await fetchTeamLeaders()
      if (data.season < SEASON) return // offseason replay — no paces on a finished season
      const { games } = await fetchTeamSchedule(TEAM_ID, data.season, 2)
      const played = games.filter((g) => g.state === 'post').length
      if (!played || played >= GAMES_IN_SEASON) return
      const out = []
      Object.entries(MILESTONES).forEach(([cat, m]) => {
        ;(data.categories[cat] || []).slice(0, 2).forEach((l) => {
          if (!l.name || !l.value) return
          const pace = (l.value / played) * GAMES_IN_SEASON
          m.targets.forEach((target) => {
            if (l.value >= target) {
              out.push({ id: l.id, name: l.name, target, label: m.label, value: l.value, reached: true, progress: 1 })
            } else if (pace >= target) {
              out.push({ id: l.id, name: l.name, target, label: m.label, value: l.value, reached: false, progress: l.value / target, pace: Math.round(pace) })
            }
          })
        })
      })
      // One line per player: their highest live target (a reached 1,000 gives way to a chased 1,500).
      const byPlayer = {}
      out.sort((a, b) => b.target - a.target).forEach((i) => { if (!byPlayer[i.id]) byPlayer[i.id] = i })
      const items = Object.values(byPlayer).sort((a, b) => b.progress - a.progress).slice(0, 4)
      if (alive && items.length) setItems(items)
    })().catch(() => {})
    return () => { alive = false }
  }, [])

  if (!items) return null

  return (
    <Section kicker="Milestone watch" title="Chasing the numbers">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
        {items.map((m) => (
          <div key={`${m.id}-${m.target}`} role="button" tabIndex={0}
            onClick={() => openPlayerCard(m.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlayerCard(m.id) } }}
            className="card-hover"
            style={{ border: `1px solid ${theme.rule}`, borderRadius: 8, padding: '12px 14px', background: '#fff', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={headshot(m.id)} alt="" width={34} height={34} loading="lazy" decoding="async"
                style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }}
                onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: theme.serif, fontSize: 15, color: theme.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>
                  {m.reached
                    ? <><span style={{ color: theme.goldText, fontWeight: 700 }}>✓</span> {fmt(m.value)} {m.label} — milestone reached</>
                    : <><strong style={{ color: theme.ink }}>{fmt(m.value)}</strong> of {fmt(m.target)} {m.label} · on pace for {fmt(m.pace)}</>}
                </div>
              </div>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: theme.wash, marginTop: 9, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, m.progress * 100)}%`, height: '100%', borderRadius: 2, background: m.reached ? theme.gold : theme.green }} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
