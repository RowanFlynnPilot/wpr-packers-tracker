// "Add to calendar": Packers games as an .ics file built in the browser — no feed to host, no
// service to sign up for. Each event carries kickoff, the stadium, how to watch (a streaming
// game says so), the title sponsor, and each sold game-day venue by name and address (no claim
// about what's on their TVs). A one-time file: if the league flexes a kickoff later, the entry
// on the reader's phone doesn't move — the page says so beside the button. Games whose kickoff
// isn't set yet (timeValid false) are left out rather than given a fake time.
import { SPONSORS, WATCH_VENUES, WPR_EMBED_URL, SITE_URL, TEAM_NAMES, STREAMING_ONLY } from './config.js'
import { track } from './analytics.js'

const GAME_MS = 3.25 * 3600 * 1000 // a broadcast window, kickoff to final gun

const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
// RFC 5545: content lines fold at 75 octets, continuation lines start with a space.
function fold(line) {
  const out = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length
    if (bytes + n > 74) { out.push(cur); cur = ' '; bytes = 1 }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n')
}

// How to watch, in words. A streaming game says what the data supports — no national TV channel
// — and stops there: whether a local station also carries it differs by market.
export const isStreaming = (tv) => STREAMING_ONLY.includes(tv)
export const howToWatch = (tv) => (!tv ? null : isStreaming(tv) ? `Streaming on ${tv} — no national TV channel` : `TV: ${tv}`)

function eventLines(g) {
  const opp = TEAM_NAMES[g.oppId] || g.oppName
  const desc = [
    howToWatch(g.tv),
    ...WATCH_VENUES.filter((v) => v.address).map((v) => `Game-day partner: ${v.name}, ${v.address}`),
    SPONSORS.header ? `Packers tracker presented by ${SPONSORS.header.name}` : null,
    `Live score, odds and stats: ${WPR_EMBED_URL || SITE_URL}`,
  ].filter(Boolean).join('\n')
  return [
    'BEGIN:VEVENT',
    `UID:packers-${g.id}@wausaupilotandreview.com`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(g.date)}`,
    `DTEND:${stamp(new Date(g.date).getTime() + GAME_MS)}`,
    `SUMMARY:${esc(`Packers ${g.home ? 'vs' : 'at'} ${opp}${g.tv ? ` (${g.tv})` : ''}`)}`,
    `LOCATION:${esc([g.venue, g.city].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${esc(desc)}`,
    `URL:${WPR_EMBED_URL || SITE_URL}`,
    'END:VEVENT',
  ]
}

// The file's text — exported for tests; `games` are normalized games (api.js normalizeEvent).
export function buildCalendar(games) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wausau Pilot & Review//Packers tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Green Bay Packers',
    ...games.filter((g) => g.timeValid && g.state === 'pre').flatMap(eventLines),
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

// Hand the file to the reader: an .ics download, which phones open straight into "add to
// calendar". Returns how many games went in (0 = nothing to add, no download).
export function downloadCalendar(games, scope) {
  const list = games.filter((g) => g.timeValid && g.state === 'pre')
  if (!list.length) return 0
  const blob = new Blob([buildCalendar(list)], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = list.length === 1 ? `packers-${(TEAM_NAMES[list[0].oppId] || 'game').toLowerCase().replace(/\W+/g, '-')}.ics` : 'packers-schedule.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  track('Calendar', { scope, games: list.length })
  return list.length
}
