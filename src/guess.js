// "Guess the Packer" — the daily game's rules, pure and storage-light. One mystery player a day
// from the current roster; each guess is answered clue by clue (position, number, age,
// experience, height, college). No backend: the day's player is derived from the date and the
// roster, so every reader gets the same one, and a reader's own game lives in localStorage.
import { SEASON } from './config.js'

export const MAX_GUESSES = 8
const TZ = 'America/Chicago' // the day turns over at midnight in Green Bay
const SPACING = 21 // days before a player can come up again

// 'YYYY-MM-DD' in Green Bay, and that day's number since the season's epoch (Sept 1).
export const dayKey = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: TZ })
const dayNumber = (key) => Math.round((Date.UTC(...key.split('-').map((n, i) => (i === 1 ? n - 1 : Number(n)))) - Date.UTC(SEASON, 8, 1)) / 86400000)
// Milliseconds until the next player (midnight Central), for the "next one in 5h 12m" line.
export function msToNextDay(now = new Date()) {
  const [h, m, s] = now.toLocaleTimeString('en-GB', { timeZone: TZ, hour12: false }).split(':').map(Number)
  return ((23 - h) * 3600 + (59 - m) * 60 + (60 - s)) * 1000
}

const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0 }

// Who can be the answer: anyone on the roster with a full set of clues, practice squad aside
// (a mystery player should be someone a fan has at least seen on the field or the injury report).
export const answerPool = (roster) => roster
  .filter((p) => p.status !== 'Practice Squad' && p.jersey && p.pos && p.age && p.heightIn && p.college && p.exp != null)
  .sort((a, b) => a.id - b.id)

// The day's player. Each day takes the pool member with the lowest hash of (day, player) that
// hasn't come up in the previous SPACING days — walked forward from the season's first day, so
// the sequence is the same for everyone. A roster move can reshuffle it (the walk re-runs on the
// new pool); a reader's game in progress is pinned to the player it started with (the store).
export function answerFor(pool, key) {
  if (!pool.length) return null
  const today = dayNumber(key)
  const spacing = Math.min(SPACING, Math.floor(pool.length / 2))
  const recent = []
  let pick = null
  for (let n = Math.max(0, today - 120); n <= today; n++) {
    let best = Infinity
    for (const p of pool) {
      if (recent.includes(p.id)) continue
      const h = hash(`${SEASON}:${n}:${p.id}`)
      if (h < best) { best = h; pick = p }
    }
    recent.push(pick.id)
    if (recent.length > spacing) recent.shift()
  }
  return pick
}

// One guess against the answer: six clues, each 'hit' | 'near' | 'miss', numbers with the
// direction the answer lies in ('up' = the answer is higher).
const num = (label, g, a, near, show = String) => ({
  label, value: show(g),
  state: g === a ? 'hit' : Math.abs(g - a) <= near ? 'near' : 'miss',
  dir: g === a ? null : a > g ? 'up' : 'down',
})
const feet = (inches) => `${Math.floor(inches / 12)}′${inches % 12}″`
export function clues(guess, answer) {
  return [
    { label: 'Pos', value: guess.pos, state: guess.pos === answer.pos ? 'hit' : guess.group === answer.group ? 'near' : 'miss', dir: null },
    num('No.', Number(guess.jersey), Number(answer.jersey), 5),
    num('Age', guess.age, answer.age, 2),
    num('Exp', guess.exp, answer.exp, 2, (y) => (y === 0 ? 'R' : String(y))),
    num('Ht', guess.heightIn, answer.heightIn, 2, feet),
    { label: 'College', value: guess.college, state: guess.college === answer.college ? 'hit' : 'miss', dir: null },
  ]
}

// The reader's game and record, in localStorage (per device, by design — no accounts). Every
// access is guarded: with storage blocked the game still plays, it just doesn't remember.
const KEY = `packersGuess:${SEASON}`
const blank = { day: null, answerId: null, guesses: [], done: null, played: 0, wins: 0, streak: 0, best: 0, lastWin: null }
export function loadStore() {
  try { return { ...blank, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { ...blank } }
}
export function saveStore(s) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* plays on, unremembered */ } }

// Today's game for this reader: yesterday's board cleared, the streak broken if a day was missed.
export function todayGame(store, key, answerId) {
  if (store.day === key && store.answerId) return store
  const yesterday = dayKey(new Date(Date.now() - 86400000))
  return { ...store, day: key, answerId, guesses: [], done: null, streak: store.lastWin === yesterday ? store.streak : 0 }
}

export function applyGuess(game, guessId, key) {
  const guesses = [...game.guesses, guessId]
  const won = guessId === game.answerId
  const lost = !won && guesses.length >= MAX_GUESSES
  if (!won && !lost) return { ...game, guesses }
  const streak = won ? game.streak + 1 : 0
  return { ...game, guesses, done: won ? 'won' : 'lost', played: game.played + 1, wins: game.wins + (won ? 1 : 0), streak, best: Math.max(game.best, streak), lastWin: won ? key : game.lastWin }
}

// The result as a grid a reader can post — the genre's convention — with no names in it.
const SQUARE = { hit: '🟩', near: '🟨', miss: '⬛' }
export function shareText(game, byId, key) {
  const answer = byId[game.answerId]
  const rows = game.guesses.map((id) => clues(byId[id], answer).map((c) => SQUARE[c.state]).join(''))
  const date = new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `Guess the Packer · ${date} · ${game.done === 'won' ? game.guesses.length : 'X'}/${MAX_GUESSES}\n${rows.join('\n')}`
}
