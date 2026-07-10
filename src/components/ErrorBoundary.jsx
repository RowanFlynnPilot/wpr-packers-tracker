import { Component } from 'react'
import { theme } from '../theme.js'
import { track } from '../analytics.js'

// The one place a render throw is allowed to land. Everything below the banner renders inside
// this boundary, so a single unexpected payload shows a graceful note instead of blanking the
// whole widget out of WPR's page. Feed failures are handled per-section (fail-soft); this only
// catches what nothing else expected.
export default class ErrorBoundary extends Component {
  state = { broken: false }
  static getDerivedStateFromError() { return { broken: true } }
  componentDidCatch(err) { track('Widget Error', { message: String(err?.message || err).slice(0, 120) }) }
  render() {
    if (!this.state.broken) return this.props.children
    return (
      <div style={{ margin: '28px 0', padding: '24px 20px', background: theme.wash, border: `1px solid ${theme.rule}`, borderTop: `4px solid ${theme.gold}`, borderRadius: 10, textAlign: 'center' }}>
        <div style={{ fontFamily: theme.serif, fontSize: 19, color: theme.ink }}>The tracker hit a snag.</div>
        <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 6, lineHeight: 1.6 }}>
          The stats feeds are fine — this one's on us. Reloading usually clears it.
        </div>
        <button
          onClick={() => window.location.reload()}
          className="link-hover"
          style={{ marginTop: 12, cursor: 'pointer', background: theme.green, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontFamily: theme.sans, fontSize: 12.5, fontWeight: 700 }}
        >
          Reload the tracker
        </button>
      </div>
    )
  }
}
