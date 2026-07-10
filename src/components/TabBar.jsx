import { theme } from '../theme.js'

// Section navigation for the tracker. Tabs flex to equal shares of the full width (no scroll,
// no dead space); the active tab gets a gold underline. Render the tabs + report clicks.
export default function TabBar({ tabs, active, onChange }) {
  return (
    <div role="tablist" aria-label="Sections" style={{ display: 'flex', borderBottom: `1px solid ${theme.rule}`, margin: '4px 0 22px' }}>
      {tabs.map((t) => {
        const on = t.id === active
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            style={{
              flex: 1, minWidth: 0, cursor: 'pointer', background: 'transparent', border: 'none',
              padding: '10px 6px', marginBottom: -1,
              fontFamily: theme.sans, fontSize: 14, fontWeight: on ? 700 : 400, letterSpacing: '0.02em',
              color: on ? theme.green : theme.muted,
              borderBottom: `3px solid ${on ? theme.gold : 'transparent'}`,
              textAlign: 'center', whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
