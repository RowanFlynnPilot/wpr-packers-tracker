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
