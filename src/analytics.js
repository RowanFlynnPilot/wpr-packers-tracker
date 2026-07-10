// Privacy-light analytics. One job: load Plausible if (and only if) a domain is configured,
// and expose a tracker for sponsor click-throughs. Disabled config => every function is a no-op,
// so the widget carries zero analytics dependency until WPR opts in via config.js.
import { ANALYTICS } from './config.js'

let started = false

// Inject the (cookieless) Plausible script once. Idempotent so React StrictMode's
// double-effect in dev can't load it twice.
export function initAnalytics() {
  if (started || !ANALYTICS.domain) return
  started = true
  // Queue stub so a click fired before the script finishes loading is not lost.
  window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments) }
  const s = document.createElement('script')
  s.defer = true
  s.src = ANALYTICS.src
  s.setAttribute('data-domain', ANALYTICS.domain)
  document.head.appendChild(s)
}

// Fire a custom event (e.g. a sponsor click). No-op until analytics is enabled.
export function track(event, props) {
  if (typeof window !== 'undefined' && window.plausible) {
    window.plausible(event, props ? { props } : undefined)
  }
}

// Fire an event that must survive the page unloading — a click on a target=_top link navigates
// the host page away while track()'s request is still in flight, so it gets aborted and the
// click undercounts. keepalive hands the request to the browser to finish after the document is
// gone. Posts straight to the Plausible events API (same payload the script would send).
// localhost is skipped to mirror the script's own dev exclusion.
export function trackBeacon(event, props) {
  if (typeof window === 'undefined' || !ANALYTICS.domain) return
  if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return
  try {
    fetch(new URL('/api/event', ANALYTICS.src), {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: event,
        url: window.location.href,
        domain: ANALYTICS.domain,
        referrer: document.referrer || null,
        props,
      }),
    }).catch(() => {})
  } catch { /* no fetch/URL support — the click still navigates, only the count is lost */ }
}
