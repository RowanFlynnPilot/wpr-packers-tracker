// Kickoff forecast via Open-Meteo — free, keyless, CORS-open, fetched straight from the
// browser exactly like the ESPN API, so it fits the no-backend architecture. One job:
// the hourly forecast nearest kickoff at Lambeau Field, mapped to a short label.
// (Weather is half the story of December football in Green Bay.)
const LAT = 44.5013 // Lambeau Field, Green Bay
const LON = -88.0622
const TZ = 'America/Chicago'

// WMO weather codes → reader-friendly labels.
const label = (code) =>
  code === 0 ? 'clear skies' :
  code <= 2 ? 'partly cloudy' :
  code === 3 ? 'overcast' :
  code <= 48 ? 'foggy' :
  code <= 57 ? 'drizzle' :
  code <= 67 ? 'rain' :
  code <= 77 ? 'snow' :
  code <= 82 ? 'rain showers' :
  code <= 86 ? 'snow showers' :
  'thunderstorms'

// Returns { tempF, precipPct, windMph, label } for the kickoff hour, or null when the game is
// beyond Open-Meteo's 16-day range. Throws on a bad response (fail fast, like api.js).
export async function fetchKickoffForecast(gameDateISO) {
  // The stadium's local hour, formatted to match Open-Meteo's local-time strings.
  const local = new Date(gameDateISO).toLocaleString('sv-SE', { timeZone: TZ }) // "2026-11-15 12:00:00"
  const hour = `${local.slice(0, 10)}T${local.slice(11, 13)}:00`
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    '&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m' +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(TZ)}&forecast_days=16`
  )
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const { hourly } = await res.json()
  const i = hourly.time.indexOf(hour)
  if (i === -1) return null
  const temp = hourly.temperature_2m[i]
  const precip = hourly.precipitation_probability[i]
  const wind = hourly.wind_speed_10m[i]
  const code = hourly.weather_code[i]
  // Hours at the edge of the 16-day window can come back null — no forecast beats a confident
  // "0°F · % precip".
  if (temp == null || precip == null || wind == null || code == null) return null
  return {
    tempF: Math.round(temp),
    precipPct: precip,
    windMph: Math.round(wind),
    label: label(code),
  }
}

// Estimated temperatures at the kickoff of games ALREADY PLAYED at Lambeau this season, for the
// cold ledger — one read of Open-Meteo's historical archive (same provider, same rules: keyless,
// CORS-open, fail fast) spanning the given kickoffs. Returns °F per ISO date, interpolated
// between the two hourly readings around the kickoff minute (the rule scripts/lambeau-history.mjs
// used for the baked seasons); a game the archive hasn't caught up with yet comes back null.
export async function fetchKickoffTemps(isoDates) {
  if (!isoDates.length) return {}
  const days = isoDates.map((d) => new Date(d)).sort((a, b) => a - b)
  const day = (d) => d.toISOString().slice(0, 10)
  const end = new Date(days[days.length - 1].getTime() + 86400000) // the hour after a late kickoff
  const res = await fetch(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}` +
    `&start_date=${day(days[0])}&end_date=${day(end)}&hourly=temperature_2m&temperature_unit=fahrenheit&timezone=GMT`
  )
  if (!res.ok) throw new Error(`Open-Meteo archive ${res.status}`)
  const { hourly } = await res.json()
  const out = {}
  isoDates.forEach((iso) => {
    const d = new Date(iso)
    const i = hourly.time.indexOf(d.toISOString().slice(0, 13) + ':00')
    const a = hourly.temperature_2m[i], b = hourly.temperature_2m[i + 1]
    const f = d.getUTCMinutes() / 60
    out[iso] = i === -1 || a == null ? null : Math.round(f && b != null ? a + (b - a) * f : a)
  })
  return out
}
