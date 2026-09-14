// The pick'em contest API — the ONE server in this repo, and small on purpose: a Cloudflare
// Worker over a D1 (SQLite) database holding entries, picks, and the contest's own copy of
// the NFL schedule and results. The tracker itself stays client-side (CLAUDE.md); this exists
// only because a PRIZE contest needs identity, server-enforced locks and a shared leaderboard.
// Readers hit it keyless (CORS-limited to WPR's origins); WPR's exports and the schedule sync
// sit behind ADMIN_KEY.
//
// The Worker never calls ESPN. ESPN's edge (Akamai) refuses requests from the Workers runtime
// (403 whatever the headers — verified Sep 2026), and a contest's locks and grading must not
// hang on a feed that may refuse the server. scripts/sync-contest.mjs (a GitHub Actions
// schedule) reads ESPN and POSTs each week's games here; locks use the kickoff times it
// stored, grading uses the finals it stored.
//
// Routes (JSON in/out; auth = `Authorization: Bearer <entry token>`):
//   GET  /                                      → { ok, season, clock }
//   POST /entries    { season, first, last, email, zip?, pin, agree }   → { token, name }   (201)
//   POST /resume     { season, email, pin }                             → { token, name }
//   GET  /picks?season&week                (auth)                       → { picks, tiebreak }
//   POST /picks      (auth) { season, week, picks, tiebreak }           → { saved, locked, tiebreak }
//   GET  /leaderboard?season&week&scope=week|season   (auth optional)   → { rows, you, complete, … }
//   POST /admin/games        (ADMIN_KEY) { season, week, current, games[] }   ← the sync
//   GET  /admin/export?season&key=ADMIN_KEY            CSV of entrants
//   GET  /admin/standings?season&week&scope&key=…      CSV: ranked entrants WITH emails (winner pick)
//
// Bindings: DB (D1). Vars: SEASON, ALLOWED_ORIGINS. Secrets: PIN_SALT, ADMIN_KEY.

const PACKERS = 9
const TOP = 25              // rows a leaderboard response carries (the reader's own row rides along)
const WEEKS = 18
const BOARD_TTL = 30        // seconds a computed leaderboard is reused across readers

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
const fail = (status, message) => { throw new HttpError(status, message) }

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })

// CORS: WPR's origins from config, plus localhost for `npm run dev`. Anything else gets the
// first allowed origin, which the browser then refuses.
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || ''
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
  const ok = allowed.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin)
  return {
    'access-control-allow-origin': ok ? origin : allowed[0] || 'null',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

// ---------------------------------------------------------------------------------------------
// The schedule and results, from the contest's own copy (see the header note).

// Where the league clock stood at the last sync: a week number, or null when no regular-season
// week of this season is on the clock (postseason, or another season). Undefined before the
// first sync ever runs.
async function currentWeek(env, season) {
  const row = await env.DB.prepare('SELECT value FROM meta WHERE key = ?').bind(`clock:${season}`).first()
  if (!row) return undefined
  return row.value === 'null' ? null : Number(row.value)
}

async function weekGames(env, season, week) {
  const { results } = await env.DB.prepare('SELECT * FROM games WHERE season = ? AND week = ? ORDER BY kickoff').bind(season, week).all()
  return results.map((r) => ({
    id: r.game_id, kickoff: r.kickoff, state: r.state, completed: !!r.completed,
    homeId: r.home_id, awayId: r.away_id, winnerId: r.winner_id, total: r.total,
  }))
}

// A week counts as complete when every game is final — or, two weeks behind the clock, once
// anything has finished: a postponed game never holds a week's winner open forever.
const weekComplete = (games, week, current) =>
  games.length > 0 && (games.every((g) => g.completed) || (current != null && week < current - 1 && games.some((g) => g.completed)))

const tiebreakGame = (games) => games.find((g) => g.homeId === PACKERS || g.awayId === PACKERS) || games[games.length - 1]

// One entry's week: correct/decided/pending, and how far the tiebreaker call was off once its
// game is final. Same rules as the tracker's own grading (a tie is a miss).
function grade(games, picks, tiebreak) {
  const byId = new Map(games.map((g) => [g.id, g]))
  let correct = 0, decided = 0, pending = 0
  for (const [gid, team] of Object.entries(picks)) {
    const g = byId.get(gid)
    if (!g) continue
    if (!g.completed) { pending++; continue }
    decided++
    if (g.winnerId === team) correct++
  }
  const tb = tiebreakGame(games)
  const diff = tb?.completed && tiebreak != null ? Math.abs(tb.total - tiebreak) : null
  return { correct, decided, pending, diff }
}

// ---------------------------------------------------------------------------------------------
// Entries.

const clean = (s, max) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const displayName = (first, last) => `${first} ${last[0].toUpperCase()}.`

async function pinHash(email, pin, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${email}\n${pin}\n${salt}`))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function createEntry(env, body) {
  const season = Number(body.season)
  if (season !== Number(env.SEASON)) fail(400, 'That contest season is closed.')
  const first = clean(body.first, 40), last = clean(body.last, 40)
  const email = clean(body.email, 120).toLowerCase(), zip = clean(body.zip, 10), pin = String(body.pin ?? '').trim()
  if (!first || !last) fail(400, 'First and last name, please.')
  if (!EMAIL.test(email)) fail(400, 'That email doesn’t look right.')
  if (!/^\d{4}$/.test(pin)) fail(400, 'The PIN is four digits.')
  if (body.agree !== true) fail(400, 'Please accept the official rules.')
  const id = crypto.randomUUID()
  const name = displayName(first, last)
  try {
    await env.DB.prepare('INSERT INTO entries (id, season, email, first, last, name, zip, pin_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, season, email, first, last, name, zip || null, await pinHash(email, pin, env.PIN_SALT), new Date().toISOString()).run()
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) fail(409, 'That email is already entered — resume with your PIN.')
    throw e
  }
  return { token: id, name }
}

// Email + PIN → token. Five misses lock the entry for 15 minutes (a four-digit PIN is a
// convenience, not a vault — the lockout is what keeps it honest).
async function resume(env, body) {
  const season = Number(body.season), email = clean(body.email, 120).toLowerCase(), pin = String(body.pin ?? '').trim()
  const row = await env.DB.prepare('SELECT id, name, pin_hash, fail_count, locked_until FROM entries WHERE season = ? AND email = ?').bind(season, email).first()
  if (!row) fail(404, 'No entry under that email this season.')
  const now = Date.now()
  if (row.locked_until && Date.parse(row.locked_until) > now) fail(429, 'Too many tries — wait 15 minutes and try again.')
  if (row.pin_hash !== await pinHash(email, pin, env.PIN_SALT)) {
    const fails = (row.fail_count || 0) + 1
    const lock = fails >= 5 ? new Date(now + 15 * 60000).toISOString() : null
    await env.DB.prepare('UPDATE entries SET fail_count = ?, locked_until = ? WHERE id = ?').bind(lock ? 0 : fails, lock, row.id).run()
    fail(401, lock ? 'Too many tries — wait 15 minutes and try again.' : 'That PIN didn’t match.')
  }
  if (row.fail_count) await env.DB.prepare('UPDATE entries SET fail_count = 0, locked_until = NULL WHERE id = ?').bind(row.id).run()
  return { token: row.id, name: row.name }
}

async function entryFromAuth(req, env, season) {
  const m = /^Bearer\s+([\w-]{20,})$/.exec(req.headers.get('Authorization') || '')
  if (!m) return null
  return env.DB.prepare('SELECT id, name FROM entries WHERE id = ? AND season = ?').bind(m[1], season).first()
}
const requireEntry = async (req, env, season) =>
  (await entryFromAuth(req, env, season)) || fail(401, 'Not entered — enter the contest, or resume with your email and PIN.')

// ---------------------------------------------------------------------------------------------
// Picks.

async function readPicks(env, entry, season, week) {
  const { results } = await env.DB.prepare('SELECT game_id, team_id FROM picks WHERE entry_id = ? AND season = ? AND week = ?').bind(entry.id, season, week).all()
  const tb = await env.DB.prepare('SELECT points FROM tiebreaks WHERE entry_id = ? AND season = ? AND week = ?').bind(entry.id, season, week).first()
  return { picks: Object.fromEntries(results.map((r) => [r.game_id, r.team_id])), tiebreak: tb?.points ?? null }
}

// The full sheet for one week, every save. Games that have kicked off are locked: their picks
// are neither written nor deleted, and their ids come back in `locked` so the reader can see
// what didn't count. Open games mirror the payload exactly (absent = unpicked). The
// tiebreaker locks with its game.
async function writePicks(env, entry, body) {
  const season = Number(body.season), week = Number(body.week)
  if (season !== Number(env.SEASON) || !(week >= 1 && week <= WEEKS)) fail(400, 'That isn’t a contest week.')
  const games = await weekGames(env, season, week)
  if (!games.length) fail(404, 'That week’s slate isn’t in the contest yet.')
  const now = Date.now()
  const openIds = new Set(games.filter((g) => g.state === 'pre' && Date.parse(g.kickoff) > now).map((g) => g.id))
  const picks = body.picks && typeof body.picks === 'object' ? body.picks : {}
  const stamp = new Date().toISOString()
  const stmts = [], saved = [], locked = []
  for (const g of games) {
    const team = picks[g.id] != null ? Number(picks[g.id]) : null
    if (!openIds.has(g.id)) { if (team != null) locked.push(g.id); continue }
    if (team == null) {
      stmts.push(env.DB.prepare('DELETE FROM picks WHERE entry_id = ? AND season = ? AND week = ? AND game_id = ?').bind(entry.id, season, week, g.id))
      continue
    }
    if (team !== g.homeId && team !== g.awayId) fail(400, 'That team isn’t in that game.')
    stmts.push(env.DB.prepare(
      'INSERT INTO picks (entry_id, season, week, game_id, team_id, updated_at) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT (entry_id, season, week, game_id) DO UPDATE SET team_id = excluded.team_id, updated_at = excluded.updated_at',
    ).bind(entry.id, season, week, g.id, team, stamp))
    saved.push(g.id)
  }
  const tbGame = tiebreakGame(games)
  let tiebreak = null
  if (openIds.has(tbGame.id)) {
    const n = body.tiebreak == null || body.tiebreak === '' ? null : Number(body.tiebreak)
    if (n == null) stmts.push(env.DB.prepare('DELETE FROM tiebreaks WHERE entry_id = ? AND season = ? AND week = ?').bind(entry.id, season, week))
    else if (Number.isInteger(n) && n >= 0 && n <= 200) {
      stmts.push(env.DB.prepare(
        'INSERT INTO tiebreaks (entry_id, season, week, points, updated_at) VALUES (?, ?, ?, ?, ?) ' +
        'ON CONFLICT (entry_id, season, week) DO UPDATE SET points = excluded.points, updated_at = excluded.updated_at',
      ).bind(entry.id, season, week, n, stamp))
      tiebreak = n
    } else fail(400, 'The tiebreaker is a whole number of points.')
  } else {
    tiebreak = (await env.DB.prepare('SELECT points FROM tiebreaks WHERE entry_id = ? AND season = ? AND week = ?').bind(entry.id, season, week).first())?.points ?? null
  }
  if (stmts.length) {
    await env.DB.batch(stmts)
    // The reader should see themselves on the board right away, not after the cache turns.
    await Promise.all([boardKey(season, 'week', week), boardKey(season, 'season', 0)].map((k) => caches.default.delete(k)))
  }
  return { saved, locked, tiebreak }
}

// ---------------------------------------------------------------------------------------------
// Leaderboard. Rank order: most correct, then the closest tiebreaker (season: fewest total
// points off across weeks), then the earlier entry. Ties on both share a rank. The ranked
// list is computed once per BOARD_TTL and shared (and dropped when the sync writes new
// results); the requester's own row is picked out per request.

const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0)
const tbKey = (r) => (r.diffs ? r.diff : Number.POSITIVE_INFINITY)
const boardKey = (season, scope, week) => `https://board.internal/${season}/${scope}/${scope === 'season' ? 0 : week}`

async function rankAll(env, season, scope, week, current) {
  const weeks = scope === 'season'
    ? Array.from({ length: current ?? WEEKS }, (_, i) => i + 1)
    : [week]
  const { results: entries } = await env.DB.prepare('SELECT id, name, created_at FROM entries WHERE season = ?').bind(season).all()
  const rows = new Map(entries.map((e) => [e.id, { id: e.id, name: e.name, created: e.created_at, correct: 0, decided: 0, pending: 0, diff: 0, diffs: 0, weeks: 0 }]))
  let complete = true
  for (const wk of weeks) {
    const games = await weekGames(env, season, wk)
    if (!weekComplete(games, wk, current)) complete = false
    if (!games.length) continue
    const { results: picks } = await env.DB.prepare('SELECT entry_id, game_id, team_id FROM picks WHERE season = ? AND week = ?').bind(season, wk).all()
    const { results: tbs } = await env.DB.prepare('SELECT entry_id, points FROM tiebreaks WHERE season = ? AND week = ?').bind(season, wk).all()
    const byEntry = new Map()
    for (const p of picks) {
      if (!byEntry.has(p.entry_id)) byEntry.set(p.entry_id, {})
      byEntry.get(p.entry_id)[p.game_id] = p.team_id
    }
    const tbByEntry = new Map(tbs.map((t) => [t.entry_id, t.points]))
    for (const [id, ps] of byEntry) {
      const r = rows.get(id)
      if (!r) continue
      const g = grade(games, ps, tbByEntry.get(id) ?? null)
      r.correct += g.correct; r.decided += g.decided; r.pending += g.pending; r.weeks++
      if (g.diff != null) { r.diff += g.diff; r.diffs++ }
    }
  }
  const played = [...rows.values()].filter((r) => r.decided + r.pending > 0)
  played.sort((a, b) => (b.correct - a.correct) || cmp(tbKey(a), tbKey(b)) || a.created.localeCompare(b.created))
  let rank = 0
  const ranked = played.map((r, i) => {
    const prev = played[i - 1]
    if (!prev || prev.correct !== r.correct || tbKey(prev) !== tbKey(r)) rank = i + 1
    return { rank, id: r.id, name: r.name, correct: r.correct, wrong: r.decided - r.correct, pending: r.pending, diff: r.diffs ? r.diff : null, weeks: r.weeks }
  })
  return { scope, week, weeks: weeks.length, entrants: entries.length, playing: ranked.length, complete, updated: new Date().toISOString(), ranked }
}

async function cachedBoard(env, season, scope, week, current) {
  const key = boardKey(season, scope, week)
  const cache = caches.default
  const hit = await cache.match(key)
  if (hit) return hit.json()
  const board = await rankAll(env, season, scope, week, current)
  await cache.put(key, new Response(JSON.stringify(board), { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${BOARD_TTL}` } }))
  return board
}

async function leaderboard(env, season, scope, week, current, me) {
  const { ranked, ...board } = await cachedBoard(env, season, scope, week, current)
  const strip = ({ id, ...r }) => r
  const you = me ? ranked.find((r) => r.id === me.id) : null
  return { ...board, rows: ranked.slice(0, TOP).map(strip), you: you ? strip(you) : null }
}

// ---------------------------------------------------------------------------------------------
// Admin. The sync writes a week's games + the league clock; the CSVs are for WPR — the entrant
// list, and a ranked week/season WITH emails for picking and contacting winners. `?key=` so a
// staffer can open the link in a browser; treat the link as a password.

async function adminGames(env, body) {
  const season = Number(body.season), week = Number(body.week)
  if (season !== Number(env.SEASON) || !(week >= 1 && week <= WEEKS)) fail(400, 'That isn’t a contest week.')
  if (!Array.isArray(body.games)) fail(400, 'games[] required.')
  const stamp = new Date().toISOString()
  const ins = env.DB.prepare(
    'INSERT INTO games (season, week, game_id, kickoff, home_id, away_id, state, completed, winner_id, total, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT (season, week, game_id) DO UPDATE SET kickoff = excluded.kickoff, home_id = excluded.home_id, away_id = excluded.away_id, ' +
    'state = excluded.state, completed = excluded.completed, winner_id = excluded.winner_id, total = excluded.total, updated_at = excluded.updated_at',
  )
  const stmts = body.games.map((g) => {
    if (!g.id || !g.kickoff || !g.homeId || !g.awayId || !g.state) fail(400, 'Each game needs id, kickoff, homeId, awayId, state.')
    return ins.bind(season, week, String(g.id), g.kickoff, Number(g.homeId), Number(g.awayId), g.state, g.completed ? 1 : 0, g.winnerId ?? null, g.total ?? null, stamp)
  })
  if ('current' in body) {
    stmts.push(env.DB.prepare('INSERT INTO meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
      .bind(`clock:${season}`, body.current == null ? 'null' : String(body.current), stamp))
  }
  if (stmts.length) await env.DB.batch(stmts)
  // Anything ranked from this week is stale now.
  await Promise.all([boardKey(season, 'week', week), boardKey(season, 'season', 0)].map((k) => caches.default.delete(k)))
  return { week, games: body.games.length, current: body.current ?? null }
}

const csv = (name, header, rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const body = [header.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n')
  return new Response(body, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"` } })
}

async function adminExport(env, season) {
  const { results } = await env.DB.prepare('SELECT first, last, email, zip, created_at FROM entries WHERE season = ? ORDER BY created_at').bind(season).all()
  return csv(`packers-pickem-${season}-entries.csv`, ['first', 'last', 'email', 'zip', 'entered_at'], results.map((r) => [r.first, r.last, r.email, r.zip, r.created_at]))
}

async function adminStandings(env, season, scope, week, current) {
  const { ranked, complete } = await rankAll(env, season, scope, week, current)
  const { results } = await env.DB.prepare('SELECT id, email, first, last FROM entries WHERE season = ?').bind(season).all()
  const byId = new Map(results.map((r) => [r.id, r]))
  const label = scope === 'season' ? 'season' : `week-${week}`
  return csv(`packers-pickem-${season}-${label}${complete ? '' : '-in-progress'}.csv`,
    ['rank', 'first', 'last', 'email', 'correct', 'wrong', 'pending', 'tiebreak_off_by', 'weeks_played'],
    ranked.map((r) => { const e = byId.get(r.id) || {}; return [r.rank, e.first, e.last, e.email, r.correct, r.wrong, r.pending, r.diff, r.weeks] }))
}

// ---------------------------------------------------------------------------------------------

async function route(req, env) {
  const url = new URL(req.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const q = (k) => url.searchParams.get(k)
  const season = Number(q('season') || env.SEASON)
  const body = req.method === 'POST' ? await req.json().catch(() => fail(400, 'Bad JSON.')) : null

  if (path === '/' && req.method === 'GET') return json({ ok: true, season: Number(env.SEASON), clock: (await currentWeek(env, Number(env.SEASON))) ?? null })
  if (path === '/entries' && req.method === 'POST') return json(await createEntry(env, body), 201)
  if (path === '/resume' && req.method === 'POST') return json(await resume(env, body))
  if (path === '/picks' && req.method === 'GET') {
    const me = await requireEntry(req, env, season)
    return json(await readPicks(env, me, season, Number(q('week'))))
  }
  if (path === '/picks' && req.method === 'POST') {
    const me = await requireEntry(req, env, Number(body.season))
    return json(await writePicks(env, me, body))
  }
  if (path === '/leaderboard' && req.method === 'GET') {
    const current = (await currentWeek(env, season)) ?? null
    const scope = q('scope') === 'season' ? 'season' : 'week'
    const week = Number(q('week')) || current || 1
    const me = await entryFromAuth(req, env, season)
    return json(await leaderboard(env, season, scope, week, current, me))
  }
  if (path.startsWith('/admin/')) {
    const key = q('key') || (/^Bearer\s+(.+)$/.exec(req.headers.get('Authorization') || '') || [])[1]
    if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) fail(401, 'Admin key required.')
    if (path === '/admin/games' && req.method === 'POST') return json(await adminGames(env, body))
    if (path === '/admin/export' && req.method === 'GET') return adminExport(env, season)
    if (path === '/admin/standings' && req.method === 'GET') {
      const current = (await currentWeek(env, season)) ?? null
      const scope = q('scope') === 'season' ? 'season' : 'week'
      return adminStandings(env, season, scope, Number(q('week')) || current || 1, current)
    }
  }
  fail(404, 'No such route.')
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    try {
      const res = await route(req, env)
      Object.entries(cors).forEach(([k, v]) => res.headers.set(k, v))
      return res
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500
      if (status === 500) console.error(e)
      return json({ error: status === 500 ? 'Something broke on our end — try again in a moment.' : e.message }, status, cors)
    }
  },
}
