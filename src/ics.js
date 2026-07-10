// Build an iCalendar (.ics) feed of the Packers' remaining regular-season games — client-side,
// from the normalized schedule. Importable into Apple/Google/Outlook calendars.
import { SPONSORS, SITE_URL, TEAM_NAMES } from './config.js'

const pad = (n) => String(n).padStart(2, '0')
const toICS = (iso) => {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
}
// Local calendar date (VALUE=DATE) — matches the day the schedule UI shows the reader.
const toICSDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
// RFC 5545 content lines fold at 75 octets (continuation lines start with a space).
const fold = (line) => {
  let out = ''
  while (line.length > 74) { out += line.slice(0, 74) + '\r\n '; line = line.slice(74) }
  return out + line
}

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
    const summary = g.home ? `Packers vs ${opp}` : `Packers @ ${opp}`
    const credit = `Live Packers tracker from Wausau Pilot & Review${SPONSORS.header ? `, presented by ${SPONSORS.header.name}` : ''}: ${SITE_URL}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${g.id}@wpr-packers-tracker`,
      `DTSTAMP:${stamp}`
    )
    if (g.timeValid === false) {
      // The league hasn't set kickoff (late-season flex): an all-day event on the right date,
      // no alarm — never a hard time the feed's placeholder made up. The UI shows "TBD" for
      // these; this is the .ics spelling of the same honesty.
      const day = new Date(g.date)
      const next = new Date(day)
      next.setDate(next.getDate() + 1)
      lines.push(
        `DTSTART;VALUE=DATE:${toICSDate(day)}`,
        `DTEND;VALUE=DATE:${toICSDate(next)}`,
        `SUMMARY:${esc(summary)}${g.week ? esc(` (Week ${g.week})`) : ''}${esc(' — kickoff TBD')}`,
        `LOCATION:${esc(g.venue)}`,
        `DESCRIPTION:${esc(`Kickoff time not yet set by the league. ${credit}`)}`,
        'END:VEVENT'
      )
      return
    }
    lines.push(
      `DTSTART:${toICS(g.date)}`,
      `DTEND:${toICS(new Date(new Date(g.date).getTime() + 3.5 * 3600 * 1000).toISOString())}`,
      `SUMMARY:${esc(summary)}${g.week ? esc(` (Week ${g.week})`) : ''}`,
      `LOCATION:${esc(g.venue)}`,
      // A sponsor credit that lives inside the reader's calendar for the rest of the season.
      `DESCRIPTION:${esc(credit)}`,
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
  return lines.map(fold).join('\r\n')
}
