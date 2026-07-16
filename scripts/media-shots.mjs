// Regenerates docs/media/*.png — the placement screenshots the sponsor deck and proposals
// embed. Serves the built site (run `npm run build` first), shoots each surface in demo mode
// at 2x, and writes over the existing files:  node scripts/media-shots.mjs
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MEDIA = (f) => path.join(ROOT, 'docs', 'media', f)
const PORT = 4189
const BASE = `http://127.0.0.1:${PORT}/wpr-packers-tracker/`

// Serve dist with vite's preview server, spawned directly so kill() actually ends it.
const server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' })

const waitForServer = async () => {
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(BASE); if (r.ok) return } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('preview server never came up')
}

const settle = async (page) => {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1200) // logos + late fetches paint
}

let browser
try {
  await waitForServer()
  browser = await chromium.launch()

  // ---- Full-page surfaces (demo mode: open slots show "Your Brand Here") ----
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 2 })
  await page.goto(`${BASE}?demo`, { waitUntil: 'networkidle' })
  await settle(page)

  // Masthead + green banner + title-sponsor lockup.
  const bannerBottom = await page.evaluate(() => Math.ceil(document.querySelector('h1').closest('div[style*="rgb(32, 55, 49)"]').getBoundingClientRect().bottom))
  await page.screenshot({ path: MEDIA('banner-demo.png'), clip: { x: 0, y: 0, width: 1200, height: bannerBottom + 6 } })

  // The featured-game hero card.
  await page.locator('#panel-season > div').first().screenshot({ path: MEDIA('hero.png') })

  // Film room: tab bar through the turning-point callout (which only exists when the game had
  // a ≥4% win-probability swing — fall back to the chart's bottom edge otherwise).
  await page.goto(`${BASE}?demo&tab=film`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.recharts-surface')
  await page.getByText('The turning point', { exact: false }).waitFor({ timeout: 5000 }).catch(() => {})
  await settle(page)
  const filmClip = await page.evaluate(() => {
    const top = document.querySelector('[role="tablist"]').getBoundingClientRect().top
    // Deepest div starting with the callout kicker is the kicker line; its parent is the card.
    const matches = [...document.querySelectorAll('#panel-film div')].filter((d) => d.textContent.startsWith('The turning point'))
    const card = matches.length ? matches[matches.length - 1].parentElement : document.querySelector('.recharts-surface').closest('div')
    return { top: Math.floor(top) - 6, bottom: Math.ceil(card.getBoundingClientRect().bottom) + 10 }
  })
  await page.screenshot({ path: MEDIA('film-room.png'), clip: { x: 0, y: filmClip.top, width: 1200, height: filmClip.bottom - filmClip.top } })
  await page.close()

  // ---- Minis (demo mode shows the sponsor line) ----
  const shootMini = async (file, out, waitSel) => {
    const p = await browser.newPage({ viewport: { width: 470, height: 1000 }, deviceScaleFactor: 2 })
    await p.goto(`${BASE}${file}?demo`, { waitUntil: 'networkidle' })
    await p.waitForSelector(waitSel)
    await settle(p)
    await p.locator('.mini-card').screenshot({ path: MEDIA(out) })
    await p.close()
  }
  await shootMini('mini.html', 'mini-scoreboard.png', '.mini-card')
  await shootMini('mini-standings.html', 'mini-standings.png', '.mini-card table tbody tr')
  await shootMini('mini-digest.html', 'mini-digest.png', '.mini-card table tbody tr')

  console.log('docs/media refreshed')
} finally {
  if (browser) await browser.close().catch(() => {})
  server.kill()
}
