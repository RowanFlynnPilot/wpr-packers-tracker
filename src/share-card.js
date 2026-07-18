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

async function draw({ kicker, headline, stats, footnote }) {
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
  ctx.fillText(masthead.split('').join(' '), 70, 92) // hair-spaced for letterspacing

  // Kicker.
  if (kicker) {
    ctx.fillStyle = '#cfd8d3'
    ctx.font = '700 26px "Public Sans", sans-serif'
    ctx.fillText(kicker.toUpperCase().split('').join(' '), 70, 150)
  }

  // Headline in the serif.
  ctx.fillStyle = '#ffffff'
  ctx.font = '600 68px Fraunces, Georgia, serif'
  const lines = wrap(ctx, headline, W - 140)
  lines.forEach((l, i) => ctx.fillText(l, 70, 238 + i * 80))

  // Stat tiles — up to four, evenly spread.
  const shown = (stats || []).slice(0, 4)
  if (shown.length) {
    const top = 400
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
      ctx.fillText(String(s.label).toUpperCase().split('').join(' '), x, top + 38)
    })
  }

  // Footer rule + lines: footnote left, sponsor or URL right.
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.beginPath()
  ctx.moveTo(70, 542)
  ctx.lineTo(W - 70, 542)
  ctx.stroke()
  ctx.fillStyle = '#cfd8d3'
  ctx.font = '400 22px "Public Sans", sans-serif'
  if (footnote) ctx.fillText(footnote, 70, 584)
  const right = SPONSORS.header ? `PRESENTED BY ${SPONSORS.header.name.toUpperCase()}` : SITE_URL.replace(/^https:\/\//, '').replace(/\/$/, '')
  ctx.font = '700 22px "Public Sans", sans-serif'
  ctx.fillStyle = SPONSORS.header ? theme.gold : '#cfd8d3'
  ctx.fillText(right, W - 70 - ctx.measureText(right).width, 584)

  return canvas
}

// Render + hand off. Returns true if a share/download actually happened (callers flip a
// "shared" confirmation). Fail-soft: any error just returns false.
export async function shareStatCard({ card, kicker, headline, stats, footnote }) {
  try {
    const canvas = await draw({ kicker, headline, stats, footnote })
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
