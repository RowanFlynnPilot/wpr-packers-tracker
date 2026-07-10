import { theme } from '../theme.js'

// Loading skeleton. `block` renders one tall shimmer (for the chart); otherwise a few bars.
export function Loading({ lines = 3, block = false }) {
  if (block) return <div className="skeleton" style={{ height: 280, borderRadius: 8 }} />
  return (
    <div style={{ padding: '6px 0' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 18, borderRadius: 4, marginBottom: 12, width: `${85 - i * 12}%` }} />
      ))}
    </div>
  )
}

export function ErrorState() {
  return (
    <div style={{ fontFamily: theme.sans, color: theme.red, fontSize: 14, padding: '16px 0' }}>
      Couldn't reach the stats feed. It refreshes live, so try again in a moment.
    </div>
  )
}
