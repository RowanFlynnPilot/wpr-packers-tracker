// Branded 1200×630 stat cards drawn on a canvas — pure typography and brand shapes (no
// remote images, so the canvas never taints) — shared through the native sheet where file
// sharing exists, downloaded as a PNG otherwise. Every share carries the tracker's name,
// URL and (when sold) the title sponsor into the reader's feed.
import { theme } from './theme.js'
import { SPONSORS, SITE_URL } from './config.js'
import { track } from './analytics.js'

const W = 1200
const H = 630

// Greedy word wrap for the headline; the serif sits large, so two lines is the ceiling.
function wrap(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  words.forEach((w) => {
    const probe = line ? `${line} ${w}` : w
    if (ctx.measureText(probe).width > maxWidth && line) { lines.push(line); line = w }
    else line = probe
  })
  if (line) lines.push(line)
  return lines.slice(0, 2)
}

// Rounded-rect path by arcs — CanvasRenderingContext2D.roundRect is too new for the older
// iPhones still in the readership.
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// `chips` (optional): short labels set in a wrapped row of outlined pills between the headline
// and the figures — the pick'em's card, sixteen abbreviations at a glance. { text, accent? };
// an accented chip outlines in gold (the Packers pick). With chips the headline is one line.
async function draw({ kicker, headline, stats, footnote, chips }) {
  await document.fonts.ready
  await Promise.all([
    document.fonts.load('600 68px Fraunces'),
    document.fonts.load('700 26px "Public Sans"'),
  ]).catch(() => {})

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Field + gold bar — the banner, at card scale.
  ctx.fillStyle = theme.green
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = theme.gold
  ctx.fillRect(0, 0, W, 14)

  // Masthead line.
  ctx.fillStyle = theme.gold
  ctx.font = '700 24px "Public Sans", sans-serif'
  ctx.textBaseline = 'alphabetic'
  const masthead = 'WAUSAU PILOT & REVIEW  ·  THE PACKERS, BY THE NUMBERS'
  ctx.fillText(masthead.split('').join(' '), 70, 92) // hair-spaced for letterspacing

  // Kicker.
  if (kicker) {
    ctx.fillStyle = '#cfd8d3'
    ctx.font = '700 26px "Public Sans", sans-serif'
    ctx.fillText(kicker.toUpperCase().split('').join(' '), 70, 150)
  }

  // Headline in the serif.
  ctx.fillStyle = '#ffffff'
  ctx.font = '600 68px Fraunces, Georgia, serif'
  const lines = wrap(ctx, headline, W - 140).slice(0, chips?.length ? 1 : 2)
  lines.forEach((l, i) => ctx.fillText(l, 70, 238 + i * 80))
  let y = 238 + (lines.length - 1) * 80

  // Pick chips — wrapped pills, two rows at most for a full sixteen-game slate.
  if (chips?.length) {
    ctx.font = '700 24px "Public Sans", sans-serif'
    const padX = 18, h = 44, gap = 12
    let x = 70
    y += 42
    chips.slice(0, 16).forEach((c) => {
      const w = Math.ceil(ctx.measureText(c.text).width) + padX * 2
      if (x + w > W - 70) { x = 70; y += h + gap }
      ctx.strokeStyle = c.accent ? theme.gold : 'rgba(255,255,255,0.45)'
      ctx.lineWidth = c.accent ? 3 : 1.5
      roundRect(ctx, x, y, w, h, 8)
      ctx.stroke()
      ctx.fillStyle = c.accent ? theme.gold : '#ffffff'
      ctx.fillText(c.text, x + padX, y + 30)
      x += w + gap
    })
    y += h
  }

  // Stat tiles — up to four, evenly spread, below whatever came before and clear of the footer.
  const shown = (stats || []).slice(0, 4)
  if (shown.length) {
    const top = chips?.length ? Math.min(y + 84, 476) : 400
    const colW = (W - 140) / shown.length
    shown.forEach((s, i) => {
      const x = 70 + i * colW
      if (i) {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x - 18, top - 44)
        ctx.lineTo(x - 18, top + 46)
        ctx.stroke()
      }
      ctx.fillStyle = '#ffffff'
      ctx.font = '600 62px Fraunces, Georgia, serif'
      ctx.fillText(String(s.value), x, top)
      ctx.fillStyle = '#cfd8d3'
      ctx.font = '700 20px "Public Sans", sans-serif'
      ctx.fillText(String(s.label).toUpperCase().split('').join(' '), x, top + 38)
    })
  }

  // Footer rule + lines: footnote left, sponsor or URL right.
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(70, 542)
  ctx.lineTo(W - 70, 542)
  ctx.stroke()
  const right = SPONSORS.header ? `PRESENTED BY ${SPONSORS.header.name.toUpperCase()}` : SITE_URL.replace(/^https:\/\//, '').replace(/\/$/, '')
  ctx.font = '700 22px "Public Sans", sans-serif'
  const rightW = ctx.measureText(right).width
  ctx.fillStyle = SPONSORS.header ? theme.gold : '#cfd8d3'
  ctx.fillText(right, W - 70 - rightW, 584)
  if (footnote) {
    // The sponsor line has right of way: a footnote that would run into it yields (ellipsis)
    // rather than overprinting a paid name.
    ctx.fillStyle = '#cfd8d3'
    ctx.font = '400 22px "Public Sans", sans-serif'
    const max = W - 140 - rightW - 28
    let text = footnote
    while (text.length > 1 && ctx.measureText(text).width > max) text = text.slice(0, -1)
    ctx.fillText(text === footnote ? text : `${text.slice(0, -1).trimEnd()}…`, 70, 584)
  }

  return canvas
}

// The drawn canvas, for previews and dev checks (the share path below is what readers use).
export const renderStatCard = draw

// Render + hand off. Returns true if a share/download actually happened (callers flip a
// "shared" confirmation). Fail-soft: any error just returns false.
export async function shareStatCard({ card, kicker, headline, stats, footnote, chips }) {
  try {
    const canvas = await draw({ kicker, headline, stats, footnote, chips })
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
    if (!blob) return false
    track('Stat Card', { card })
    const file = new File([blob], `packers-${card}.png`, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Packers tracker — Wausau Pilot & Review' })
      return true
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    return true
  } catch {
    return false // an aborted share sheet lands here too — quiet either way
  }
}
