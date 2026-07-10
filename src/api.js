// ESPN NFL API client. One job: fetch and return JSON. Fail fast (throw on non-200); the
// calling component renders its own error state. The API is keyless and CORS-open
// (access-control-allow-origin: *), so this runs in the browser — same architecture as the
// Brewers tracker's MLB client. Live feeds are NOT cached; the heavier season-wide reads
// memoize for a short TTL so flipping between tabs doesn't refetch them.
import { SEASON, TEAM_ID, DIVISION, DIVISION_NAME, CONFERENCE } from './config.js'

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'
const SITE_V2 = 'https://site.api.espn.com/apis/v2/sports/football/nfl'
const CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl'
const WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl'

// Fail fast: a bad response throws, the calling component shows its error state.
async function getJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN API ${res.status} for ${url}`)
  return res.json()
}

// Session memo with a TTL — shares one in-flight promise across concurrent callers (several
// sections read the same schedule/standings at once) and avoids refetching the heavier reads
// when a reader returns to a tab. Failures aren't cached.
const _memo = new Map()
function cached(key, ttl, fn) {
  const hit = _memo.get(key)
  if (hit && Date.now() - hit.t < ttl) return hit.p
  const p = fn().catch((e) => { _memo.delete(key); throw e })
  _memo.set(key, { t: Date.now(), p })
  return p
}

// Run async `worker` over `items` with at most `size` in flight; failures resolve to null.
async function pooled(items, size, worker) {
  const out = new Array(items.length)
  let next = 0
  const run = async () => {
    while (next < items.length) {
      const i = next++
      try { out[i] = await worker(items[i], i) } catch { out[i] = null }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run))
  return out
}

// The schedule feed's score is { value, displayValue }; the scoreboard's is a bare string.
const scoreOf = (s) => {
  if (s == null) return null
  if (typeof s === 'object') return s.value ?? null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// One schedule/scoreboard event, seen from `teamId`'s perspective. The shape every component
// consumes — nothing downstream touches raw ESPN payloads for games.
export function normalizeEvent(e, teamId = TEAM_ID) {
  const comp = e.competitions?.[0]
  if (!comp) return null
  const homeC = comp.competitors.find((c) => c.homeAway === 'home')
  const awayC = comp.competitors.find((c) => c.homeAway === 'away')
  if (!homeC || !awayC) return null
  const home = Number(homeC.team.id) === teamId
  const meC = home ? homeC : awayC
  const oppC = home ? awayC : homeC
  const st = comp.status?.type || {}
  const meScore = scoreOf(meC.score)
  const oppScore = scoreOf(oppC.score)
  return {
    id: e.id,
    date: e.date,
    week: e.week?.number ?? null,
    seasonType: e.seasonType?.type ?? null, // 1 preseason, 2 regular, 3 postseason
    home,
    oppId: Number(oppC.team.id),
    oppAbbr: oppC.team.abbreviation,
    oppName: oppC.team.shortDisplayName || oppC.team.displayName,
    state: st.state || 'pre',       // 'pre' | 'in' | 'post'
    detail: st.shortDetail || '',   // e.g. "10:27 - 1st", "Final/OT", "9/13 - 3:25 PM EDT"
    timeValid: e.timeValid !== false, // false = the league hasn't set kickoff yet (e.g. Week 18)
    completed: !!st.completed,
    meScore,
    oppScore,
    won: st.completed && meScore != null && oppScore != null ? meScore > oppScore : null,
    tied: st.completed && meScore != null && meScore === oppScore,
    venue: comp.venue?.fullName || '',
    city: comp.venue?.address?.city || '',
    tv: comp.broadcasts?.[0]?.media?.shortName || '',
    note: comp.notes?.[0]?.headline || '', // e.g. "NFC Divisional Round"
  }
}

// One team's schedule for a season/type, normalized + date-sorted. Cached: every consumer of a
// season's games (hero, schedule, race, film room, this-day) shares the fetch.
export function fetchTeamSchedule(teamId, season, type = 2) {
  return cached(`sched:${teamId}:${season}:${type}`, 60000, async () => {
    const data = await getJSON(`${SITE}/teams/${teamId}/schedule?season=${season}&seasontype=${type}`)
    return {
      byeWeek: data.byeWeek ?? null,
      games: (data.events || [])
        .map((e) => normalizeEvent(e, teamId))
        .filter(Boolean)
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    }
  })
}

// Every Packers game this season — preseason + regular + postseason, one sorted list. The
// regular season is the source of truth and fails fast; pre/postseason legitimately don't
// exist for parts of the year (the playoff bracket isn't published in September), so an error
// there means "no such games yet", not a failure.
export function fetchSeasonGames() {
  return cached(`allGames:${SEASON}`, 60000, async () => {
    const [reg, pre, post] = await Promise.all([
      fetchTeamSchedule(TEAM_ID, SEASON, 2),
      fetchTeamSchedule(TEAM_ID, SEASON, 1).catch(() => ({ games: [] })),
      fetchTeamSchedule(TEAM_ID, SEASON, 3).catch(() => ({ games: [] })),
    ])
    return {
      byeWeek: reg.byeWeek,
      games: [...pre.games, ...reg.games, ...post.games].sort((a, b) => new Date(a.date) - new Date(b.date)),
    }
  })
}

// The season the numbers should describe: SEASON once it has kicked off (any completed
// regular-season game), else the one before it — in the offseason the standings, leaders and
// film room show last season's final figures, clearly labeled, and flip over automatically
// after Week 1. This is phase-awareness, not a fallback: each phase has one correct source.
export function fetchStatsSeason() {
  return cached('statsSeason', 300000, async () => {
    const { games } = await fetchTeamSchedule(TEAM_ID, SEASON, 2)
    return games.some((g) => g.state === 'post') ? SEASON : SEASON - 1
  })
}

// League standings for a season at division level, flattened into plain rows. Throws if the
// season's table isn't published yet (ESPN omits `standings` until the season exists) — callers
// asking for the current season before kickoff treat that as "not yet".
export function fetchStandings(season) {
  return cached(`standings:${season}`, 60000, async () => {
    const data = await getJSON(`${SITE_V2}/standings?season=${season}&level=3`)
    const rows = []
    ;(data.children || []).forEach((conf) => {
      ;(conf.children || []).forEach((div) => {
        ;(div.standings?.entries || []).forEach((e) => {
          const s = {}
          ;(e.stats || []).forEach((x) => { s[x.name || x.displayName] = x })
          rows.push({
            id: Number(e.team.id),
            name: e.team.shortDisplayName || e.team.displayName,
            abbr: e.team.abbreviation,
            conf: conf.abbreviation,
            divName: div.name,
            wins: s.wins?.value ?? 0,
            losses: s.losses?.value ?? 0,
            ties: s.ties?.value ?? 0,
            winPercent: s.winPercent?.value ?? 0,
            pct: s.winPercent?.displayValue ?? '—',
            gamesBehind: s.gamesBehind?.value ?? 0,
            streak: s.streak?.displayValue ?? '',
            pointsFor: s.pointsFor?.value ?? 0,
            pointsAgainst: s.pointsAgainst?.value ?? 0,
            pointDiff: s.pointDifferential?.value ?? 0,
            seed: s.playoffSeed?.value ?? null,
            divRecord: s.divisionRecord?.displayValue ?? '',
            homeRecord: s.Home?.displayValue ?? '',
            roadRecord: s.Road?.displayValue ?? '',
          })
        })
      })
    })
    if (!rows.length) throw new Error(`standings for ${season} not published`)
    return rows
  })
}

// One standings call feeds the division table, the pulse, and the Packers' league-wide
// points-for / points-against ranks — plus which season the figures describe.
export async function fetchStandingsBundle() {
  const season = await fetchStatsSeason()
  const rows = await fetchStandings(season)
  const division = rows
    .filter((r) => DIVISION[r.id])
    .sort((a, b) => b.winPercent - a.winPercent || (a.seed ?? 99) - (b.seed ?? 99))
  if (!division.length) throw new Error('Division not found in standings response')
  const rankBy = (cmp) => {
    const sorted = [...rows].sort(cmp)
    return { rank: sorted.findIndex((t) => t.id === TEAM_ID) + 1, of: rows.length }
  }
  return {
    season,
    standings: division,
    league: rows,
    ranks: {
      pointsFor: rankBy((a, b) => b.pointsFor - a.pointsFor),
      pointsAgainst: rankBy((a, b) => a.pointsAgainst - b.pointsAgainst),
    },
  }
}

// Season schedules for every division team — the race chart derives games-back week by week
// client-side, and the standings form strips read recent results. Four small fetches.
export function fetchDivisionSchedules(season) {
  return cached(`divSched:${season}`, 120000, async () => {
    const ids = Object.keys(DIVISION).map(Number)
    return Promise.all(ids.map(async (id) => {
      const { games } = await fetchTeamSchedule(id, season, 2)
      return { id, games }
    }))
  })
}

// The single "featured" game for the hero: live now; else a just-finished final (held for 36
// hours so a Monday reader still sees Sunday's result); else the next kickoff; else the last
// final. Considers preseason + regular + postseason.
export async function fetchFeaturedGame() {
  const { games } = await fetchSeasonGames()
  if (!games.length) return null
  const live = games.find((g) => g.state === 'in')
  if (live) return live
  const finals = games.filter((g) => g.state === 'post')
  const lastFinal = finals[finals.length - 1]
  if (lastFinal && Date.now() - new Date(lastFinal.date) < 36 * 3600 * 1000) return lastFinal
  const next = games.find((g) => g.state === 'pre')
  return next || lastFinal || games[games.length - 1]
}

// Full game summary — box score, drives, win probability, scoring plays, leaders, linescores.
// Cached: a completed game's summary is static, and the film room + box score + minis all read
// the same events. Live callers use fetchLiveSummary (no cache) instead.
export function fetchGameSummary(eventId) {
  return cached(`summary:${eventId}`, 600000, () => getJSON(`${SITE}/summary?event=${eventId}`))
}
export function fetchLiveSummary(eventId) {
  return getJSON(`${SITE}/summary?event=${eventId}`)
}

// The pieces of a summary the LIVE hero/mini need, distilled: the score, the Packers' win
// probability, the current situation (down & distance), and the last few plays. The score
// comes from here too so the live surfaces tick on the summary's fast cadence — the schedule
// feed behind fetchFeaturedGame sits in a 60s memo and would lag the win-prob bar beside it.
export function liveExtras(summary, packersHome) {
  const comps = summary.header?.competitions?.[0]?.competitors || []
  const homeC = comps.find((c) => c.homeAway === 'home')
  const awayC = comps.find((c) => c.homeAway === 'away')
  const wp = summary.winprobability || []
  const lastWp = wp[wp.length - 1]
  const homePct = lastWp ? lastWp.homeWinPercentage * 100 : null
  const drives = summary.drives || {}
  const allPlays = [...(drives.previous || []), ...(drives.current ? [drives.current] : [])]
    .flatMap((d) => d.plays || [])
  const last = allPlays[allPlays.length - 1]
  return {
    meScore: scoreOf((packersHome ? homeC : awayC)?.score),
    oppScore: scoreOf((packersHome ? awayC : homeC)?.score),
    mePct: homePct == null ? null : Math.round(packersHome ? homePct : 100 - homePct),
    situation: last?.end?.downDistanceText || last?.end?.possessionText || null,
    plays: allPlays.slice(-3).reverse().map((p) => ({
      period: p.period?.number,
      clock: p.clock?.displayValue,
      scoring: !!p.scoringPlay,
      text: p.text || '',
    })),
  }
}

// Active roster, flattened, with a byId map — bios, headshots and (in season) injury tags all
// ride along, so one fetch feeds the leader tables, the injury report and the player cards.
export function fetchRoster() {
  return cached('roster', 600000, async () => {
    const data = await getJSON(`${SITE}/teams/${TEAM_ID}/roster`)
    const list = []
    ;(data.athletes || []).forEach((group) => {
      ;(group.items || []).forEach((a) => {
        list.push({
          id: Number(a.id),
          name: a.displayName,
          jersey: a.jersey || '',
          pos: a.position?.abbreviation || '',
          group: group.position,
          age: a.age || null,
          exp: a.experience?.years ?? null,
          college: a.college?.name || '',
          height: a.displayHeight || '',
          weight: a.displayWeight || '',
          injuries: a.injuries || [],
        })
      })
    })
    const byId = {}
    list.forEach((p) => { byId[p.id] = p })
    return { list, byId }
  })
}

const athleteIdFromRef = (ref) => {
  const m = /athletes\/(\d+)/.exec(ref || '')
  return m ? Number(m[1]) : null
}

// One athlete's bio from the core feed — the player-card fallback for players no longer on
// the roster (the offseason leader boards are full of them). Same shape as a roster entry;
// fields the core feed doesn't carry stay blank and the card omits them.
export function fetchAthlete(athleteId) {
  return cached(`athlete:${athleteId}`, 600000, async () => {
    const season = await fetchStatsSeason()
    const a = await getJSON(`${CORE}/seasons/${season}/athletes/${athleteId}`)
    return {
      id: athleteId,
      name: a.displayName,
      jersey: a.jersey || '',
      pos: a.position?.abbreviation || '',
      age: a.age || null,
      exp: a.experience?.years ?? null,
      college: '',
      height: a.displayHeight || '',
      weight: a.displayWeight || '',
      injuries: [],
    }
  })
}

// Team statistical leaders for the stats season → { category: [{ id, value, display }] }.
// Names/headshots resolve through the roster; leaders who've since left the club resolve
// through one small athlete read each (pooled, tolerated).
export function fetchTeamLeaders() {
  return cached('teamLeaders', 300000, async () => {
    const season = await fetchStatsSeason()
    const [data, roster] = await Promise.all([
      getJSON(`${CORE}/seasons/${season}/types/2/teams/${TEAM_ID}/leaders`),
      fetchRoster(),
    ])
    const cats = {}
    const missing = new Set()
    ;(data.categories || []).forEach((c) => {
      cats[c.name] = (c.leaders || []).map((l) => {
        const id = athleteIdFromRef(l.athlete?.$ref)
        if (id && !roster.byId[id]) missing.add(id)
        return { id, value: l.value, display: l.displayValue }
      }).filter((l) => l.id)
    })
    const names = {}
    if (missing.size) {
      const fetched = await pooled([...missing], 6, (id) =>
        getJSON(`${CORE}/seasons/${season}/athletes/${id}`).then((a) => ({ id, name: a.displayName, pos: a.position?.abbreviation || '' }))
      )
      fetched.forEach((a) => { if (a) names[a.id] = a })
    }
    const resolve = (id) => roster.byId[id] || names[id] || null
    Object.values(cats).forEach((list) => list.forEach((l) => {
      const p = resolve(l.id)
      l.name = p?.name || null
      l.pos = p?.pos || ''
    }))
    return { season, categories: cats }
  })
}

// League-wide leaders (top 5 per category) → { category: { athleteId: rank } }. Lets the
// leader tables chip NFL top-5 ranks under names — same trick as the Brewers' MLB chips.
export function fetchLeagueLeaders() {
  return cached('leagueLeaders', 300000, async () => {
    const season = await fetchStatsSeason()
    const data = await getJSON(`${CORE}/seasons/${season}/types/2/leaders?limit=5`)
    const map = {}
    ;(data.categories || []).forEach((c) => {
      const byId = {}
      ;(c.leaders || []).forEach((l, i) => {
        const id = athleteIdFromRef(l.athlete?.$ref)
        if (id && byId[id] == null) byId[id] = i + 1
      })
      map[c.name] = byId
    })
    return map
  })
}

// One team's season statistics — every category, each stat with its value, display and NFL
// rank. Feeds the team profile tiles and the matchup comparison.
export function fetchTeamStats(teamId) {
  return cached(`teamStats:${teamId}`, 300000, async () => {
    const season = await fetchStatsSeason()
    const data = await getJSON(`${CORE}/seasons/${season}/types/2/teams/${teamId}/statistics`)
    const out = { season, cats: {} }
    ;(data.splits?.categories || []).forEach((c) => {
      const stats = {}
      ;(c.stats || []).forEach((s) => {
        stats[s.name] = { value: s.value, display: s.displayValue, rank: s.rank ?? null }
      })
      out.cats[c.name] = stats
    })
    return out
  })
}

// One player's game-by-game log for the stats season, newest first. The feed keys stat columns
// by parallel `names`/`labels` arrays; rows zip them back together.
export function fetchGamelog(athleteId) {
  return cached(`gamelog:${athleteId}`, 300000, async () => {
    const season = await fetchStatsSeason()
    const data = await getJSON(`${WEB}/athletes/${athleteId}/gamelog?season=${season}`)
    const labels = data.labels || []
    const eventsMeta = data.events || {}
    const rows = []
    ;(data.seasonTypes || []).forEach((st) => {
      ;(st.categories || []).forEach((cat) => {
        if (cat.type !== 'event') return
        ;(cat.events || []).forEach((ev) => {
          const meta = eventsMeta[ev.eventId]
          if (!meta) return
          rows.push({
            eventId: ev.eventId,
            date: meta.gameDate,
            week: meta.week,
            oppAbbr: meta.opponent?.abbreviation || '',
            atVs: meta.atVs || 'vs',
            result: meta.gameResult || '',
            score: meta.score || '',
            stats: (ev.stats || []).map((v, i) => ({ label: labels[i] || '', value: v })),
          })
        })
      })
    })
    rows.sort((a, b) => new Date(b.date) - new Date(a.date))
    return { season, rows }
  })
}

// Packers Final games played on today's month/day across past seasons — "this day in history".
// One small schedule request per season (ESPN's NFL archive is solid back to 1999), pooled and
// failure-tolerant; January/February dates also sweep the playoffs. Kept client-side per the
// project architecture — no scraper, no committed history file.
export function fetchThisDayGames(month, day, fromYear, toYear) {
  const years = []
  for (let y = fromYear; y <= toYear; y++) years.push(y)
  const wantPost = month <= 2 // postseason games land in Jan/Feb of season year + 1
  return cached(`thisDay:${month}-${day}`, 3600000, async () => {
    const results = await pooled(years, 6, async (y) => {
      const reg = await fetchTeamSchedule(TEAM_ID, y, 2)
      const post = wantPost ? await fetchTeamSchedule(TEAM_ID, y, 3).catch(() => ({ games: [] })) : { games: [] }
      return { year: y, games: [...reg.games, ...post.games] }
    })
    const out = []
    results.forEach((r) => {
      if (!r) return
      r.games.forEach((g) => {
        const d = new Date(g.date)
        if (g.state === 'post' && d.getMonth() + 1 === month && d.getDate() === day) {
          out.push({ year: r.year, game: g })
        }
      })
    })
    return out
  })
}
