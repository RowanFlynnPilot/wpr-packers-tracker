import { lazy } from 'react'

// A tab's code, loaded when the tab is first opened (the default Season tab stays in the main
// bundle). One hazard comes with that: a reader who has the page open across a deploy asks for
// a chunk the new release has replaced, and the import 404s. That reader gets one automatic
// reload onto the new build instead of the "hit a snag" card — once a minute at most, so a real
// outage can't loop.
const KEY = 'packersChunkReload'
export const lazyTab = (load) => lazy(() => load().catch((err) => {
  try {
    const last = Number(sessionStorage.getItem(KEY)) || 0
    if (Date.now() - last > 60000) {
      sessionStorage.setItem(KEY, String(Date.now()))
      window.location.reload()
      return new Promise(() => {}) // hold the fallback on screen until the reload lands
    }
  } catch { /* no storage: fall through to the error boundary */ }
  throw err
}))
