import { theme } from '../theme.js'
import { useIsNarrow } from '../useIsNarrow.js'

// A rule-framed strip of headline figures — the house treatment for "here are the numbers".
//
// The pattern it replaces was a row of identically bordered tiles, which is the dashboard
// default and read as one: five boxes of equal weight, and on a phone a ragged grid with an
// orphan in the last row. A newspaper sets the same numbers in a band between two rules and
// lets the space do the separating, so the figures read as one statement instead of five
// widgets. On a wide screen it's a free-wrapping row. On a phone it's a BALANCED grid — the
// free wrap left the Pulse's fifth figure ("1–2 In the division") alone on a row of its own and
// Drive DNA's third ("Own 31") the same (Oct 2026): five go 3 + 2, four go 2 + 2, three go 3.
//
// `items`: { value (node — a string, or Pulse's CountUp), label, color? }. Falsy entries are
// dropped, so callers can build the list conditionally.
export default function Figures({ items, size = 'lg' }) {
  const narrow = useIsNarrow()
  const list = items.filter(Boolean)
  if (!list.length) return null
  const big = size === 'lg'
  const valueSize = narrow ? (big ? 30 : 24) : (big ? 36 : 27)
  const cols = list.length === 4 ? 2 : Math.min(list.length, 3)
  return (
    <div style={{
      ...(narrow
        ? { display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
        : { display: 'flex', flexWrap: 'wrap' }),
      gap: narrow ? '16px 18px' : '18px 40px',
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
