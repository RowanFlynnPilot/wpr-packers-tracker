// The contest client — the only file that talks to the contest API (worker/). Same rules as
// the ESPN client: fail fast (a non-2xx throws, carrying the server's message and status), no
// caching, the calling component owns its error state. The entry token is the reader's
// contest identity in THIS browser; picks themselves stay in src/pickem.js's store and are
// mirrored to the server on every change.
import { CONTEST, SEASON } from './config.js'

const KEY = `packersContest:${SEASON}`

export const contestOn = () => !!CONTEST.api

export const readEntry = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null }
}
export const writeEntry = (entry) => {
  try { entry ? localStorage.setItem(KEY, JSON.stringify(entry)) : localStorage.removeItem(KEY) } catch {}
}

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(`${CONTEST.api}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `The contest server answered ${res.status}.`)
    err.status = res.status
    throw err
  }
  return data
}

export const enter = (form) => call('/entries', { method: 'POST', body: { ...form, season: SEASON } })
export const resume = (email, pin) => call('/resume', { method: 'POST', body: { email, pin, season: SEASON } })
export const fetchServerPicks = (token, week) => call(`/picks?season=${SEASON}&week=${week}`, { token })
export const savePicks = (token, week, picks, tiebreak) => call('/picks', { method: 'POST', token, body: { season: SEASON, week, picks, tiebreak } })
export const fetchLeaderboard = (scope, week, token) => call(`/leaderboard?season=${SEASON}&scope=${scope}&week=${week}`, { token })
