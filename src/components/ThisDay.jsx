import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { fetchThisDayGames } from '../api.js'
import { rankThisDay } from '../games.js'
import { Loading } from './Status.jsx'
import Section from './Section.jsx'

// "This day in Packers history" — a single highlight: the most fun game the Packers played on
// today's date across past seasons (ESPN's archive runs solidly back to 1999). Self-contained
// and fail-soft: it owns its Section chrome, so a failed fan-out hides the heading too (no
// orphaned title) — and in the long football offseason, most dates simply have no games, so the
// section quietly sits out until the calendar comes back around. The per-season fan-out only
// fires once the section nears the viewport.
const FROM_YEAR = 1999

export default function ThisDay() {
  const ref = useRef(null)
  const [armed, setArmed] = useState(false)
  const [items, setItems] = useState(null)
  const [error, setError] = useState(false)

  // NFL games only happen August–February; from March through July the ~27-season fan-out is
  // guaranteed to come back empty, so skip the whole section (no requests, no heading flash).
  const offMonth = new Date().getMonth() + 1
  const darkSeason = offMonth >= 3 && offMonth <= 7

  // Arm the fetch when the section approaches the viewport. Attach the observer only after a beat,
  // so the still-loading (short) page doesn't report the section as visible at the very top.
  useEffect(() => {
    if (darkSeason || armed || !ref.current) return
    // No IntersectionObserver (rare webviews/readers) → load immediately rather than never.
    if (typeof IntersectionObserver === 'undefined') { setArmed(true); return }
    const el = ref.current
    let io
    const t = setTimeout(() => {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { setArmed(true); io.disconnect() }
      }, { rootMargin: '300px' })
      io.observe(el)
    }, 1200)
    return () => { clearTimeout(t); if (io) io.disconnect() }
  }, [armed, darkSeason])

  useEffect(() => {
    if (!armed) return
    const now = new Date()
    fetchThisDayGames(now.getMonth() + 1, now.getDate(), FROM_YEAR, now.getFullYear() - 1)
      .then((g) => setItems(rankThisDay(g)))
      .catch(() => setError(true))
  }, [armed])

  if (darkSeason || error) return null
  if (!items) {
    return <Section kicker="From the vault" title="This day in Packers history"><div ref={ref}><Loading lines={2} /></div></Section>
  }
  if (!items.length) return null // no games ever on this date (most of the offseason) — sit out

  const top = items[0]

  return (
    <Section kicker="From the vault" title="This day in Packers history">
      <div style={{ border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 8, background: theme.wash, padding: '20px 22px' }}>
        <div style={{ fontFamily: theme.serif, fontSize: 21, color: theme.ink, lineHeight: 1.4, maxWidth: 660 }}>
          On this day in {top.year}, {top.text}.
        </div>
      </div>
    </Section>
  )
}
