#!/usr/bin/env node
// Feeds the contest Worker (worker/) its copy of the NFL schedule and results. Runs on a
// GitHub Actions schedule (.github/workflows/sync-contest.yml) and on demand. The Worker
// never reads ESPN itself: ESPN's edge refuses requests from the Workers runtime (403 whatever
// the headers — verified Sep 2026), and a contest's locks and grading can't hang on that. This
// is the contest ledger's feed, not the widget's — the tracker still reads ESPN live.
//
//   CONTEST_API=https://…workers.dev CONTEST_ADMIN_KEY=… node scripts/sync-contest.mjs
//
// Syncs the league clock plus the current week, the one before it (its finals) and the one
// after (so picks can open early); in the postseason, Week 18's finals. Exits 0 with a note
// when CONTEST_API is unset, so the schedule is harmless before the contest is configured.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

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

async function main() {
  if (!API || !KEY) { console.log('Contest not configured (CONTEST_API / CONTEST_ADMIN_KEY unset) — nothing to sync.'); return }
  if (!SEASON) throw new Error('SEASON not found in src/config.js')
  const clock = await getJSON(`${SITE}/scoreboard`)
  const thisSeason = clock.season?.year === SEASON
  const current = !thisSeason ? null : clock.season.type === 1 ? 1 : clock.season.type === 3 ? null : clock.week?.number || 1
  const weeks = (current != null ? [current - 1, current, current + 1] : thisSeason ? [WEEKS] : [])
    .filter((w) => w >= 1 && w <= WEEKS)
  if (!weeks.length) { console.log(`League clock is not on the ${SEASON} regular season — nothing to sync.`); return }
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
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
