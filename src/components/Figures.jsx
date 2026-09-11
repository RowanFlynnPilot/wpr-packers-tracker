import { theme } from '../theme.js'
import { useIsNarrow } from '../useIsNarrow.js'

// A rule-framed strip of headline figures — the house treatment for "here are the numbers".
//
// The pattern it replaces was a row of identically bordered tiles, which is the dashboard
// default and read as one: five boxes of equal weight, and on a phone a ragged grid with an
// orphan in the last row. A newspaper sets the same numbers in a band between two rules and
// lets the space do the separating, so the figures read as one statement instead of five
// widgets. It also wraps correctly at any width, because nothing has to line up.
//
// `items`: { value (node — a string, or Pulse's CountUp), label, color? }. Falsy entries are
// dropped, so callers can build the list conditionally.
export default function Figures({ items, size = 'lg' }) {
  const narrow = useIsNarrow()
  const list = items.filter(Boolean)
  if (!list.length) return null
  const big = size === 'lg'
  const valueSize = narrow ? (big ? 30 : 24) : (big ? 36 : 27)
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap',
      gap: narrow ? '16px 26px' : '18px 40px',
      borderTop: `2px solid ${theme.green}`,
      borderBottom: `1px solid ${theme.rule}`,
      padding: narrow ? '13px 0 14px' : '15px 0 16px',
    }}>
      {list.map((f) => (
        <div key={f.label}>
          <div style={{ fontFamily: theme.serif, fontSize: valueSize, lineHeight: 1, color: f.color || theme.ink, fontVariantNumeric: 'tabular-nums' }}>
            {f.value}
          </div>
          <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, marginTop: 7 }}>
            {f.label}
          </div>
        </div>
      ))}
    </div>
  )
}
