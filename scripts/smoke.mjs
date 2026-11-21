// The pre-deploy smoke test: load every page of the BUILT site in headless Chromium — each tab,
// the minis, the bar TV board, the media kit and rules pages — in the state the season is really
// in AND in mocked states that only happen for a few hours a year (a live game, a fresh final, a
// clinched playoff spot, a clinched division), and fail if any of them throws, lands on the
// error boundary, renders nothing, or runs wider than its screen.
//
//   npm run build && npm run smoke
//
// It runs in deploy.yml before a push is published (not on the twice-daily image refresh), so a
// change that crashes a page stops there instead of reaching readers. What it deliberately does
// NOT assert is anything about the data: with ESPN unreachable every section fails soft, the
// pages still render, and the test still passes — an outage at ESPN must not block a deploy.
// ESPN is proxied through Node because its edge refuses CORS to headless browsers (the same
// trick as render-digest.mjs); the mocks rewrite those proxied responses.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4319
const BASE = `http://127.0.0.1:${PORT}/wpr-packers-tracker/`
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'
const PHONE = { width: 351, height: 800 } // the WPR embed's width on a phone
const DESK = { width: 1280, height: 900 }
const TV = { width: 1280, height: 720 }

// ── Mocks: rewrite one proxied ESPN response ──────────────────────────────────────────────
const SCHEDULE = /teams\/9\/schedule\?season=\d+&seasontype=2/
const STANDINGS = /apis\/v2\/sports\/football\/nfl\/standings/
// The most recent final, replayed as a game in progress (its summary supplies the play-by-play).
const live = { match: SCHEDULE, fn: (d) => {
  const ev = (d.events || []).filter((e) => e.competitions?.[0]?.status?.type?.state === 'post').at(-1)
  if (ev) ev.competitions[0].status.type = { ...ev.competitions[0].status.type, state: 'in', completed: false, shortDetail: '8:12 - 4th' }
  return d
} }
const clinch = (mark) => ({ match: STANDINGS, fn: (d) => {
  for (const c of d.children || []) for (const dv of c.children || []) for (const e of dv.standings?.entries || []) {
    if (e.team?.abbreviation !== 'GB') continue
    e.stats = (e.stats || []).filter((s) => s.name !== 'clincher')
    e.stats.push({ name: 'clincher', displayValue: mark })
  }
  return d
} })

// When the last final ended, so one visit can stand a few hours after it (the hero's final state).
async function lastFinal() {
  try {
    const d = await (await fetch(`${SITE}/teams/9/schedule?seasontype=2`)).json()
    const ev = (d.events || []).filter((e) => e.competitions?.[0]?.status?.type?.completed).at(-1)
    return ev ? new Date(new Date(ev.date).getTime() + 5 * 3600000).toISOString() : null
  } catch { return null }
}

const tab = (t) => (t ? `?tab=${t}` : '')
async function visits() {
  const afterFinal = await lastFinal()
  return [
    // The season as it stands, every tab, at the embed's phone width.
    ...['', 'race', 'schedule', 'leaders', 'film', 'guess'].map((t) => ({ name: `tab:${t || 'season'}`, url: tab(t), view: PHONE, expect: '[role=tabpanel]' })),
    { name: 'tab:season (desktop)', url: '', view: DESK, expect: '[role=tabpanel]' },
    { name: 'tab:race (desktop)', url: tab('race'), view: DESK, expect: '[role=tabpanel]' },
    { name: 'demo', url: '?demo', view: PHONE, expect: '[role=tabpanel]' },
    { name: 'demo pick’em', url: '?demo&tab=pickem', view: PHONE, expect: '[role=tabpanel]' },
    { name: 'shared path', url: '?path=12w13l', view: PHONE, expect: '#panel-race' },
    // The other entries.
    { name: 'mini', url: 'mini.html', view: { width: 320, height: 500 }, expect: '#root > *' },
    { name: 'mini-standings', url: 'mini-standings.html', view: { width: 320, height: 500 }, expect: '#root > *' },
    { name: 'mini-digest', url: 'mini-digest.html', view: { width: 480, height: 1100 }, expect: '#root > *' },
    { name: 'mini-digest (email image)', url: 'mini-digest.html?image=1', view: { width: 480, height: 1100 }, expect: '#root > *' },
    { name: 'sponsors', url: 'sponsors.html', view: PHONE, expect: '#root > *' },
    { name: 'rules', url: 'rules.html', view: PHONE, expect: '#root > *' },
    { name: 'tv', url: 'tv.html', view: TV, expect: '#root > *', fixed: true },
    // States that exist for a few hours a year.
    { name: 'live: season', url: '', view: PHONE, expect: '[role=tabpanel]', mocks: [live] },
    { name: 'live: race', url: tab('race'), view: PHONE, expect: '[role=tabpanel]', mocks: [live] },
    { name: 'live: mini', url: 'mini.html', view: { width: 320, height: 500 }, expect: '#root > *', mocks: [live] },
    { name: 'live: tv', url: 'tv.html', view: TV, expect: '#root > *', mocks: [live], fixed: true },
    ...(afterFinal ? [{ name: 'final: season', url: '', view: PHONE, expect: '[role=tabpanel]', clock: afterFinal }] : []),
    { name: 'clinched spot: season', url: '', view: PHONE, expect: '[role=tabpanel]', mocks: [clinch('y')] },
    { name: 'clinched spot: race', url: tab('race'), view: PHONE, expect: '[role=tabpanel]', mocks: [clinch('y')] },
    { name: 'clinched division: race', url: tab('race'), view: PHONE, expect: '[role=tabpanel]', mocks: [clinch('z')] },
    { name: 'eliminated: race', url: tab('race'), view: PHONE, expect: '[role=tabpanel]', mocks: [clinch('e')] },
  ]
}

// ── One visit ─────────────────────────────────────────────────────────────────────────────
async function check(browser, v) {
  const ctx = await browser.newContext({ viewport: v.view, serviceWorkers: 'block', locale: 'en-US', timezoneId: 'America/Chicago' })
  const problems = []
  try {
    await ctx.route('**/plausible.io/**', (r) => r.abort())
    await ctx.route('**://*.espn.com/**', async (route) => {
      const url = route.request().url()
      try {
        const res = await fetch(url)
        let body = Buffer.from(await res.arrayBuffer())
        const mock = (v.mocks || []).find((m) => m.match.test(url))
        if (mock && res.ok) body = Buffer.from(JSON.stringify(mock.fn(JSON.parse(body.toString()))))
        await route.fulfill({ status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body })
      } catch { await route.abort() }
    })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => problems.push(`uncaught error: ${String(e).slice(0, 200)}`))
    if (v.clock) await page.clock.setFixedTime(new Date(v.clock))
    await page.goto(BASE + v.url, { waitUntil: 'networkidle', timeout: 45000 })
    // Walk the page so sections that wait for the viewport load too.
    if (!v.fixed) {
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)) } window.scrollTo(0, 0) })
    }
    await page.waitForTimeout(2500)
    if (!(await page.locator(v.expect).count())) problems.push(`nothing rendered at ${v.expect}`)
    if (await page.getByText('The tracker hit a snag').count()) problems.push('landed on the error boundary')
    const wide = v.fixed
      // A fixed screen: nothing may hang off its edges.
      ? await page.evaluate(() => [...document.querySelectorAll('#root *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.bottom > innerHeight + 1) }).length)
      : await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (wide > 1) problems.push(v.fixed ? `${wide} elements run off the screen` : `page is ${wide}px wider than its ${v.view.width}px screen`)
  } catch (e) {
    problems.push(`could not load: ${String(e).slice(0, 200)}`)
  } finally {
    await ctx.close()
  }
  return problems
}

// ── Run ───────────────────────────────────────────────────────────────────────────────────
const server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
let browser
let failed = 0
try {
  let up = false
  for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch(BASE)).ok } catch { /* not yet */ } if (!up) await new Promise((r) => setTimeout(r, 500)) }
  if (!up) throw new Error('the preview server did not start — run `npm run build` first')
  browser = await chromium.launch()
  const list = await visits()
  const results = new Array(list.length)
  let next = 0
  // Four at a time; a visit that fails gets one more try (a slow feed is not a broken page).
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < list.length) {
      const i = next++
      let problems = await check(browser, list[i])
      if (problems.length) problems = await check(browser, list[i])
      results[i] = problems
    }
  }))
  list.forEach((v, i) => {
    const ok = !results[i].length
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${v.name}${ok ? '' : `\n       ${results[i].join('\n       ')}`}`)
  })
  console.log(failed ? `\n${failed} of ${list.length} checks failed` : `\nall ${list.length} checks passed`)
} finally {
  if (browser) await browser.close()
  server.kill()
}
process.exit(failed ? 1 : 0)
