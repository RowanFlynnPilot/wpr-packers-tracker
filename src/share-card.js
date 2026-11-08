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

// Canvas → the native share sheet where file sharing exists, a PNG download otherwise. Returns
// true if a share/download actually happened (callers flip a "shared" confirmation). Fail-soft:
// any error — an aborted share sheet included — just returns false.
async function handOff(canvas, card) {
  try {
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
    return false
  }
}

export async function shareStatCard({ card, kicker, headline, stats, footnote, chips }) {
  try {
    return await handOff(await draw({ kicker, headline, stats, footnote, chips }), card)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------------------------
// The FINAL-SCORE card — portrait 1080×1350 (4:5: full-width in the Facebook, Instagram and X
// feeds, and a phone-screen of a group text). Same rules as the stat cards: type and brand
// shapes only, no remote images (team logos would taint the canvas), so each club wears its
// color as a bar beside its name. Top to bottom: the result, what it means ("Packers fall to
// 4–3"), the game's win-probability line, the Packers' top performers, and the sponsor + where
// to find the tracker. Everything comes from the final's summary the hero already holds.
const FW = 1080
const FH = 1350
const spaced = (s) => s.toUpperCase().split('').join(' ') // hair-spaced caps, as on the stat cards

async function drawFinal({ kicker, rows, resultLine, odds, wp, leaders, url }) {
  await document.fonts.ready
  await Promise.all([
    document.fonts.load('600 120px Fraunces'),
    document.fonts.load('italic 400 44px Fraunces'),
    document.fonts.load('700 26px "Public Sans"'),
    document.fonts.load('400 26px "Public Sans"'),
  ]).catch(() => {})

  const canvas = document.createElement('canvas')
  canvas.width = FW
  canvas.height = FH
  const ctx = canvas.getContext('2d')
  const L = 70, R = FW - 70
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = theme.green
  ctx.fillRect(0, 0, FW, FH)
  ctx.fillStyle = theme.gold
  ctx.fillRect(0, 0, FW, 14)

  ctx.fillStyle = theme.gold
  ctx.font = '700 22px "Public Sans", sans-serif'
  ctx.fillText(spaced('Wausau Pilot & Review  ·  The Packers, by the numbers'), L, 84)
  ctx.fillStyle = '#cfd8d3'
  ctx.font = '700 26px "Public Sans", sans-serif'
  ctx.fillText(spaced(kicker), L, 146)

  // The scoreboard: a color bar, the club, its score — the winner in white, the loser dimmed.
  rows.forEach((r, i) => {
    const base = 300 + i * 150
    ctx.fillStyle = r.color
    ctx.fillRect(L, base - 96, 14, 112)
    // Several clubs' colors (Bears navy, Texans) vanish on the green — a hairline keeps the bar.
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 2
    ctx.strokeRect(L, base - 96, 14, 112)
    ctx.fillStyle = r.won === false ? '#93a89d' : '#ffffff'
    ctx.font = '600 84px Fraunces, Georgia, serif'
    ctx.fillText(r.name, L + 40, base)
    ctx.font = '600 128px Fraunces, Georgia, serif'
    const sw = ctx.measureText(String(r.score)).width
    ctx.fillText(String(r.score), R - sw, base + 6)
  })

  // The result line, and under it what the result did to the season ("PLAYOFF ODDS 66% → 79%");
  // with the odds line the result line rises to make room above the rule at 620.
  if (resultLine) {
    ctx.fillStyle = theme.gold
    ctx.font = 'italic 400 46px Fraunces, Georgia, serif'
    ctx.fillText(resultLine, L, odds ? 548 : 572)
  }
  if (odds) {
    ctx.fillStyle = '#cfd8d3'
    ctx.font = '700 20px "Public Sans", sans-serif'
    const label = spaced(odds.label)
    ctx.fillText(label, L, 600)
    const labelW = ctx.measureText(label).width // measured in the label's own font
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 32px Fraunces, Georgia, serif'
    ctx.fillText(`${odds.before}  →  ${odds.after}`, L + labelW + 22, 602)
  }

  // How it unfolded: the Packers' win probability play by play, kickoff → final whistle.
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(L, 620); ctx.lineTo(R, 620); ctx.stroke()
  if (wp?.length >= 4) {
    ctx.fillStyle = '#cfd8d3'
    ctx.font = '700 20px "Public Sans", sans-serif'
    ctx.fillText(spaced('How it unfolded · Packers win probability'), L, 672)
    const top = 704, h = 230
    const yAt = (v) => top + h - (v / 100) * h
    // The plot starts after a gutter for the axis labels, so the line never runs over them.
    const P = L + 52
    const xAt = (i) => P + (i / (wp.length - 1)) * (R - P)
    ctx.setLineDash([8, 8])
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath(); ctx.moveTo(P, yAt(50)); ctx.lineTo(R, yAt(50)); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = '400 18px "Public Sans", sans-serif'
    ctx.textAlign = 'right'
    ;[100, 50, 0].forEach((v) => ctx.fillText(`${v}%`, P - 12, yAt(v) + 6))
    ctx.textAlign = 'left'
    // Area under the line, then the line, then where it ended.
    ctx.beginPath()
    ctx.moveTo(xAt(0), yAt(0))
    wp.forEach((v, i) => ctx.lineTo(xAt(i), yAt(v)))
    ctx.lineTo(xAt(wp.length - 1), yAt(0))
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.07)' // a light wash — gold at low alpha read olive on the green
    ctx.fill()
    ctx.beginPath()
    wp.forEach((v, i) => (i ? ctx.lineTo(xAt(i), yAt(v)) : ctx.moveTo(xAt(i), yAt(v))))
    ctx.strokeStyle = theme.gold
    ctx.lineWidth = 5
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(xAt(wp.length - 1), yAt(wp[wp.length - 1]), 9, 0, Math.PI * 2)
    ctx.fillStyle = theme.gold
    ctx.fill()
  }

  // Top performers: category, name, line — the line yields (ellipsis) rather than overrun.
  if (leaders?.length) {
    ctx.fillStyle = '#cfd8d3'
    ctx.font = '700 20px "Public Sans", sans-serif'
    ctx.fillText(spaced('Top performers'), L, 1012)
    leaders.slice(0, 3).forEach((l, i) => {
      const y = 1064 + i * 52
      ctx.fillStyle = theme.gold
      ctx.font = '700 24px "Public Sans", sans-serif'
      ctx.fillText(l.cat.toUpperCase(), L, y)
      ctx.fillStyle = '#ffffff'
      ctx.font = '600 32px Fraunces, Georgia, serif'
      ctx.fillText(l.name, L + 196, y)
      const nameW = ctx.measureText(l.name).width
      ctx.fillStyle = '#cfd8d3'
      ctx.font = '400 24px "Public Sans", sans-serif'
      const max = R - (L + 196 + nameW + 20)
      let text = l.line
      while (text.length > 1 && ctx.measureText(text).width > max) text = text.slice(0, -1)
      ctx.fillText(text === l.line ? text : `${text.slice(0, -1).trimEnd()}…`, L + 196 + nameW + 20, y)
    })
  }

  // Footer: the title sponsor, then where to follow along.
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(L, 1232); ctx.lineTo(R, 1232); ctx.stroke()
  if (SPONSORS.header) {
    ctx.fillStyle = theme.gold
    ctx.font = '700 22px "Public Sans", sans-serif'
    ctx.fillText(`PRESENTED BY ${SPONSORS.header.name.toUpperCase()}`, L, 1278)
  }
  ctx.fillStyle = '#cfd8d3'
  ctx.font = '400 24px "Public Sans", sans-serif'
  ctx.fillText(`The live Packers tracker · ${url.replace(/^https?:\/\//, '').replace(/\/$/, '')}`, L, SPONSORS.header ? 1316 : 1290)

  return canvas
}

export const renderFinalCard = drawFinal

export async function shareFinalCard(opts) {
  try {
    return await handOff(await drawFinal(opts), 'final')
  } catch {
    return false
  }
}
