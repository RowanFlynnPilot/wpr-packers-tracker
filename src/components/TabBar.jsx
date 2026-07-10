import { theme } from '../theme.js'

// Section navigation for the tracker. Tabs flex to equal shares of the full width (no scroll,
// no dead space); the active tab gets a gold underline. Full ARIA tabs contract: roving
// tabindex (one Tab stop for the whole bar), arrow keys move + select, Home/End jump, and each
// tab points at its panel (App wraps tab content in the matching role="tabpanel").
export default function TabBar({ tabs, active, onChange }) {
  const select = (id) => {
    onChange(id)
    document.getElementById(`tab-${id}`)?.focus()
  }
  const onKeyDown = (e) => {
    const idx = tabs.findIndex((t) => t.id === active)
    let next = null
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next == null) return
    e.preventDefault()
    select(tabs[next].id)
  }
  return (
    <div role="tablist" aria-label="Sections" style={{ display: 'flex', borderBottom: `1px solid ${theme.rule}`, margin: '4px 0 22px' }}>
      {tabs.map((t) => {
        const on = t.id === active
        return (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={on}
            aria-controls={`panel-${t.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={onKeyDown}
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
