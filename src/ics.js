// Build an iCalendar (.ics) feed of the Packers' remaining regular-season games — client-side,
// from the normalized schedule. Importable into Apple/Google/Outlook calendars.
import { SPONSORS, SITE_URL, TEAM_NAMES } from './config.js'

const pad = (n) => String(n).padStart(2, '0')
const toICS = (iso) => {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
}
const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')

export function buildICS(games, nowISO) {
  const stamp = toICS(nowISO)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wausau Pilot & Review//Packers Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Green Bay Packers',
  ]
  games.forEach((g) => {
    if (g.state !== 'pre' || !g.date) return
    const opp = TEAM_NAMES[g.oppId] || g.oppName
    const start = toICS(g.date)
    const end = toICS(new Date(new Date(g.date).getTime() + 3.5 * 3600 * 1000).toISOString())
    const summary = g.home ? `Packers vs ${opp}` : `Packers @ ${opp}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${g.id}@wpr-packers-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${esc(summary)}${g.week ? esc(` (Week ${g.week})`) : ''}`,
      `LOCATION:${esc(g.venue)}`,
      // A sponsor credit that lives inside the reader's calendar for the rest of the season.
      `DESCRIPTION:${esc(`Live Packers tracker from Wausau Pilot & Review${SPONSORS.header ? `, presented by ${SPONSORS.header.name}` : ''}: ${SITE_URL}`)}`,
      // 30-minute heads-up so imported games actually nudge the reader on game day.
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Kickoff in 30 minutes',
      'TRIGGER:-PT30M',
      'END:VALARM',
      'END:VEVENT'
    )
  })
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
