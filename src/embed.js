// Shared helpers for the embeddable mini widgets (mini.html, mini-standings.html, etc.).
import { SITE_URL } from './config.js'

// Where a tap on a mini lands: the embed can pass ?to=<full-tracker page on the news site>;
// until that page exists, fall back to the standalone tracker. http(s) only — never a script URL.
export function destination() {
  const to = new URLSearchParams(window.location.search).get('to')
  return to && /^https?:\/\//i.test(to) ? to : SITE_URL
}
