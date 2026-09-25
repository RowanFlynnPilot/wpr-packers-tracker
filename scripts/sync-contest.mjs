#!/usr/bin/env node
// Feeds the contest Worker (worker/) its copy of the NFL schedule and results. Runs on a
// GitHub Actions schedule (.github/workflows/sync-contest.yml) and on demand. The Worker
// never reads ESPN itself: ESPN's edge refuses requests from the Workers runtime (403 whatever
// the headers — verified Sep 2026), and a contest's locks and grading can't hang on that. This
// is the contest ledger's feed, not the widget's — the tracker still reads ESPN live.
//
//   CONTEST_API=https://…workers.dev CONTEST_ADMIN_KEY=… node scripts/sync-contest.mjs [--watch]
//
// Syncs the league clock plus the current week, the one before it (its finals) and the one
// after (so picks can open early); in the postseason, Week 18's finals. Exits 0 with a note
// when CONTEST_API is unset, so the schedule is harmless before the contest is configured.
//
// --watch (what the workflow runs) keeps the job alive through a game window. The workflow's
// `*/15` cron does NOT fire every 15 minutes: GitHub throttles scheduled runs, and on game
// days in Sep 2026 they landed every 2–5 hours (worst gap 5h39m) — finals would have reached
// the leaderboard hours late. So any wake-up that finds a game on, or one kicking off within
// LOOKAHEAD, stays and syncs every LIVE_EVERY while games are on (every WAIT_EVERY while it
// waits for kickoff). Before GitHub's 6-hour job limit it hands off: it writes `handoff=true`
// to $GITHUB_OUTPUT and the workflow dispatches a successor run (workflow_dispatch isn't
// throttled). The watch ends when nothing is on and nothing kicks off within LOOKAHEAD.
// Pick LOCKS never depended on any of this — the Worker also locks on the server clock at the
// scheduled kickoff — so the watch only buys fresh grading.
import { readFileSync, appendFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const MIN = 60 * 1000
export const LOOKAHEAD = 8 * 60 * MIN       // wake-up gaps observed up to 5h39m; 8h covers them
export const LIVE_EVERY = 5 * MIN
export const WAIT_EVERY = 30 * MIN          // pre-kickoff: keeps kickoff times fresh, nothing more
export const BUDGET = (5 * 60 + 20) * MIN   // hand off with margin under the job's 6h limit
// A game still unfinished this long after its kickoff (postponed, suspended, cancelled) stops
// counting as "on" — otherwise one stranded game would chain watchers forever.
export const GAME_WINDOW = 6 * 60 * MIN

const API = (process.env.CONTEST_API || '').replace(/\/$/, '')
const KEY = process.env.CONTEST_ADMIN_KEY || ''
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'
const WEEKS = 18

// One dial: SEASON comes from src/config.js.
const config = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/config.js'), 'utf8')
const SEASON = Number(/export const SEASON = (\d{4})/.exec(config)?.[1])

// ESPN's edge rejects an empty User-Agent and bot-shaped ones (anything with "(+http…)"
// answers 403); a plain product token passes.
const getJSON = async (url) => {
  const r = await fetch(url, { headers: { 'user-agent': 'wpr-packers-tracker/1.0' } })
  if (!r.ok) throw new Error(`ESPN ${r.status} for ${url}`)
  return r.json()
}

// One scoreboard event, neutrally — the shape the Worker stores. A tie leaves winnerId null.
function normalize(e) {
  const c = e.competitions?.[0]
  if (!c) return null
  const home = c.competitors.find((x) => x.homeAway === 'home')
  const away = c.competitors.find((x) => x.homeAway === 'away')
  if (!home || !away) return null
  const st = c.status?.type || {}
  const completed = !!st.completed
  const hs = Number(home.score), as = Number(away.score)
  const homeId = Number(home.team.id), awayId = Number(away.team.id)
  return {
    id: String(e.id), kickoff: e.date, state: st.state || 'pre', completed, homeId, awayId,
    winnerId: completed ? (hs > as ? homeId : as > hs ? awayId : null) : null,
    total: completed ? hs + as : null,
  }
}

// One pass: the clock, then each relevant week to the Worker. Returns every game it synced (the
// watch reads them to decide what's on), or null when there's nothing to sync at all.
async function syncOnce() {
  const clock = await getJSON(`${SITE}/scoreboard`)
  const thisSeason = clock.season?.year === SEASON
  const current = !thisSeason ? null : clock.season.type === 1 ? 1 : clock.season.type === 3 ? null : clock.week?.number || 1
  const weeks = (current != null ? [current - 1, current, current + 1] : thisSeason ? [WEEKS] : [])
    .filter((w) => w >= 1 && w <= WEEKS)
  if (!weeks.length) { console.log(`League clock is not on the ${SEASON} regular season — nothing to sync.`); return null }
  const all = []
  for (const week of weeks) {
    const data = await getJSON(`${SITE}/scoreboard?seasontype=2&week=${week}&dates=${SEASON}`)
    const games = (data.events || []).map(normalize).filter(Boolean)
    const res = await fetch(`${API}/admin/games`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ season: SEASON, week, current, games }),
    })
    if (!res.ok) throw new Error(`Worker ${res.status}: ${await res.text()}`)
    console.log(`Week ${week}: ${games.length} games synced, ${games.filter((g) => g.completed).length} final (clock: week ${current ?? 'none'})`)
    all.push(...games)
  }
  return all
}

// The watch policy, pure so it can be checked without a clock or a network: given the games
// the last pass saw, the time, and how long this run has been up — stop, wait, or hand off.
export function nextStep(games, now, elapsed) {
  const on = games.filter((g) => {
    const k = Date.parse(g.kickoff)
    return !g.completed && k <= now && now - k < GAME_WINDOW
  })
  const upcoming = games
    .filter((g) => !g.completed && Date.parse(g.kickoff) > now)
    .map((g) => Date.parse(g.kickoff))
    .sort((a, b) => a - b)
  const next = upcoming[0] ?? null
  if (!on.length && (next == null || next - now > LOOKAHEAD)) {
    return { action: 'stop', reason: next == null ? 'no game left on the synced slate' : `next kickoff is ${Math.round((next - now) / 3600000)}h out` }
  }
  // Waiting on a kickoff: wake a minute after it, but at least every WAIT_EVERY.
  const wait = on.length ? LIVE_EVERY : Math.max(MIN, Math.min(WAIT_EVERY, next - now + MIN))
  if (elapsed + wait > BUDGET) return { action: 'handoff', reason: 'near the 6-hour job limit with games still to finish' }
  return {
    action: 'wait',
    wait,
    reason: on.length ? `${on.length} game${on.length === 1 ? '' : 's'} on` : `next kickoff in ${Math.round((next - now) / MIN)} min`,
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Tell the workflow to dispatch a successor run. Outside Actions there's no one to tell.
function handOff(reason) {
  console.log(`Handing off (${reason}).`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'handoff=true\n')
  else console.log('(not in GitHub Actions — a local run just stops here)')
}

async function main() {
  if (!API || !KEY) { console.log('Contest not configured (CONTEST_API / CONTEST_ADMIN_KEY unset) — nothing to sync.'); return }
  if (!SEASON) throw new Error('SEASON not found in src/config.js')
  const start = Date.now()
  // The first pass fails loudly (a misconfiguration should turn the run red)…
  let games = await syncOnce()
  if (!games || !process.argv.includes('--watch')) return
  for (;;) {
    const step = nextStep(games, Date.now(), Date.now() - start)
    if (step.action === 'stop') { console.log(`Watch ends: ${step.reason}.`); return }
    if (step.action === 'handoff') { handOff(step.reason); return }
    console.log(`Watching: ${step.reason} — next pass in ${Math.round(step.wait / MIN)} min.`)
    await sleep(step.wait)
    // …later passes ride out a blip (ESPN or the Worker hiccuping mid-game), keeping the last
    // good picture; the budget still ends a run that never recovers.
    let fresh
    try { fresh = await syncOnce() } catch (e) { console.error(`Pass failed, will retry: ${e.message}`); continue }
    if (!fresh) { console.log('Watch ends: the league clock left the regular season.'); return }
    games = fresh
  }
}

// Run only when executed directly — importing the module (to check nextStep) syncs nothing.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => { console.error(e.message); process.exit(1) })
}
