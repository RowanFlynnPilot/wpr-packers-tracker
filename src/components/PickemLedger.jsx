import { useEffect, useRef } from 'react'
import { theme } from '../theme.js'
import { REGULAR_SEASON_WEEKS } from '../config.js'
import Figures from './Figures.jsx'

// The reader's season at a glance, above the sheet: a week rail — one chip per regular-season
// week carrying that week's record, tap to open it — and the headline figures under it once
// anything has been decided. The rail is the season ledger and the navigation in one element:
// eighteen chips read as a season, and the week you want is one tap away (past weeks to
// review, the next to call early). `tally` is seasonTally's output; `store` supplies pick
// counts for weeks not yet decided.

const rec = (r) => `${r.correct}–${r.total - r.correct}`

export default function PickemLedger({ tally, store, liveWeek, view, onView }) {
  const rail = useRef(null)

  // Keep the open week centered in the rail (scrollTo on the rail itself — scrollIntoView
  // would also scroll the host page when embedded).
  useEffect(() => {
    const r = rail.current
    const el = r?.querySelector(`[data-week="${view}"]`)
    if (!r || !el) return
    const left = el.offsetLeft - r.clientWidth / 2 + el.clientWidth / 2
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    r.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' })
  }, [view])

  const weeks = Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => i + 1)
  const m = tally.model
  const diff = m.mine - m.correct
  const decidedWeeks = Object.keys(tally.weeks).length
  const figures = tally.total > 0 ? [
    { value: rec(tally), label: 'Season' },
    { value: `${Math.round((tally.correct / tally.total) * 100)}%`, label: 'Accuracy' },
    m.total > 0 && { value: `${m.correct}–${m.total - m.correct}`, label: "ESPN's FPI" },
    tally.best && decidedWeeks > 1 && { value: rec(tally.best), label: `Best week · Wk ${tally.best.week}` },
    tally.packGames > 0 && { value: `${tally.backed} of ${tally.packGames}`, label: 'Backed the Pack' },
  ] : []

  return (
    <div>
      <div ref={rail} role="group" aria-label="Weeks"
        style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 2px 8px', margin: '0 -2px', scrollbarWidth: 'thin' }}>
        {weeks.map((wk) => {
          const r = tally.weeks[wk]
          const on = wk === view
          const picked = Object.keys(store[wk]?.picks || {}).length
          const net = r ? r.correct * 2 - r.total : 0
          const sub = r ? rec(r) : picked ? `${picked} picked` : '—'
          const subColor = on ? '#fff' : !r ? theme.muted : r.pending || net === 0 ? theme.ink : net > 0 ? theme.green : theme.red
          const said = r ? `, ${r.correct} and ${r.total - r.correct}` : picked ? `, ${picked} picked` : ''
          return (
            <button key={wk} data-week={wk} onClick={() => onView(wk)} aria-pressed={on}
              aria-label={`Week ${wk}${said}${wk === liveWeek ? ', this week' : ''}`}
              style={{
                flex: '0 0 auto', minWidth: 60, cursor: 'pointer',
                border: `1px solid ${on ? theme.green : theme.rule}`, borderRadius: 8, padding: '6px 8px 7px',
                background: on ? theme.green : '#fff', fontFamily: theme.sans, textAlign: 'center',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, color: on ? theme.gold : theme.muted }}>
                {wk === liveWeek && <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: theme.gold, flexShrink: 0 }} />}
                Wk {wk}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: r ? 700 : 400, color: subColor, marginTop: 2, whiteSpace: 'nowrap' }}>{sub}</span>
            </button>
          )
        })}
      </div>

      {figures.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Figures items={figures} size="sm" />
          {m.total > 0 && (
            <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 9 }}>
              {diff > 0
                ? `You're ${diff} call${diff === 1 ? '' : 's'} up on ESPN's FPI model across the same games.`
                : diff < 0
                ? `ESPN's FPI model is ${-diff} call${diff === -1 ? '' : 's'} up on you across the same games — the board's still open.`
                : "Dead level with ESPN's FPI model across the same games."}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
