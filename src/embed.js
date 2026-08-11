// Shared helpers for the embeddable mini widgets (mini.html, mini-standings.html, etc.).
import { SITE_URL, WPR_EMBED_URL } from './config.js'

// Where a tap on a mini lands: the embed can pass ?to=<any page on the news site>; the
// default is the tracker's own WPR page. http(s) only — never a script URL.
export function destination() {
  const to = new URLSearchParams(window.location.search).get('to')
  return to && /^https?:\/\//i.test(to) ? to : WPR_EMBED_URL || SITE_URL
}
