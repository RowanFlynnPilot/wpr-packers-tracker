import { useEffect, useMemo, useState } from 'react'
import { theme } from '../theme.js'
import { SPONSORS, WPR_EMBED_URL, headshot } from '../config.js'
import { fetchRoster } from '../api.js'
import { MAX_GUESSES, dayKey, msToNextDay, answerPool, answerFor, clues, loadStore, saveStore, todayGame, applyGuess, shareText } from '../guess.js'
import { track } from '../analytics.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Section from './Section.jsx'
import { Loading, ErrorState } from './Status.jsx'

// "Guess the Packer" — the daily game (rules in guess.js). One mystery player from the current
// roster each day, eight guesses, six clues a guess: green is right, gold is close (same side of
// the ball, or within a few of the number), an arrow says which way the answer lies. The board,
// the streak and the record live on the reader's device. A silhouette hint unlocks after four
// misses; the result shares as a grid of squares, no names in it.
// The sponsor lockup shows once the slot is sold (or in ?demo); unsold, there is no "available"
// card above the game — it cost a phone 230px before the first guess. The slot sells from
// sponsors.html.
const COLORS = {
  hit: { background: theme.green, color: '#fff', border: theme.green },
  near: { background: theme.gold, color: theme.green, border: theme.gold },
  miss: { background: '#fff', color: theme.ink, border: theme.rule },
}
const WORDS = { hit: 'correct', near: 'close', miss: 'no match' }
const ARROW = { up: '↑', down: '↓' }
const HINT_AFTER = 4

function useCountdown(active) {
  const [ms, setMs] = useState(msToNextDay())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setMs(msToNextDay()), 30000)
    return () => clearInterval(id)
  }, [active])
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function GuessGame() {
  const [roster, setRoster] = useState(null)
  const [error, setError] = useState(false)
  const [game, setGame] = useState(null)
  const [query, setQuery] = useState('')
  const [hint, setHint] = useState(false)
  const [copied, setCopied] = useState(false)
  const narrow = useIsNarrow()
  const key = dayKey()

  useEffect(() => {
    let alive = true
    fetchRoster().then(({ list, byId }) => {
      if (!alive) return
      const answer = answerFor(answerPool(list), key)
      if (!answer) { setError(true); return }
      // A game already under way keeps its player even if a roster move reshuffled the day's.
      let g = todayGame(loadStore(), key, answer.id)
      if (!byId[g.answerId]) g = { ...g, answerId: answer.id, guesses: [], done: null }
      g = { ...g, guesses: g.guesses.filter((id) => byId[id]) }
      saveStore(g)
      setRoster({ list, byId })
      setGame(g)
    }).catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [key])

  const next = useCountdown(!!game?.done)
  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!roster || !game || q.length < 2) return []
    // Match the start of the full name or of any part of it ("love", "jor", "st. brown").
    return roster.list
      .filter((p) => {
        if (game.guesses.includes(p.id)) return false
        const n = p.name.toLowerCase()
        return n.startsWith(q) || n.split(/[\s-]+/).some((w) => w.startsWith(q))
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 6)
  }, [query, roster, game])

  const body = (() => {
    if (error) return <ErrorState />
    if (!roster || !game) return <Loading />
    const answer = roster.byId[game.answerId]
    const left = MAX_GUESSES - game.guesses.length

    const guess = (p) => {
      const g = applyGuess(game, p.id, key)
      saveStore(g)
      setGame(g)
      setQuery('')
      if (game.guesses.length === 0) track('Guess Start')
      if (g.done) track('Guess Game', { result: g.done, guesses: g.guesses.length })
    }
    const share = () => {
      const url = new URL(window.self === window.top ? window.location.href : WPR_EMBED_URL)
      url.searchParams.set('tab', 'guess')
      const text = shareText(game, roster.byId, key)
      track('Guess Share', { result: game.done })
      if (navigator.share) navigator.share({ text, url: url.href }).catch(() => {})
      else if (navigator.clipboard) navigator.clipboard.writeText(`${text}\n${url.href}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
    }

    const cell = (c, i) => (
      <div key={i} role="cell" aria-label={`${c.label} ${c.value}: ${WORDS[c.state]}${c.dir ? `, the answer is ${c.dir === 'up' ? 'higher' : 'lower'}` : ''}`}
        style={{ ...COLORS[c.state], border: `1.5px solid ${COLORS[c.state].border}`, borderRadius: 5, minHeight: 40, padding: '4px 3px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: theme.sans, fontSize: c.label === 'College' ? (narrow ? 10.5 : 11.5) : 13.5, fontWeight: 700, lineHeight: 1.1, overflowWrap: 'anywhere' }}>
        {c.value}{c.dir && <span aria-hidden="true" style={{ marginLeft: 2 }}>{ARROW[c.dir]}</span>}
      </div>
    )
    const cols = narrow ? '38px 40px 40px 36px 46px minmax(0, 1fr)' : '56px 56px 56px 56px 64px minmax(0, 1fr)'
    const labels = ['Pos', 'No.', 'Age', 'Exp', 'Ht', 'College']

    return (
      <div style={{ maxWidth: 560 }}>
        <p style={{ fontFamily: theme.serif, fontSize: narrow ? 15.5 : 17, color: theme.ink, lineHeight: 1.45, margin: '-6px 0 14px', textWrap: 'pretty' }}>
          One player from the current roster, {MAX_GUESSES} guesses. <strong style={{ color: theme.green }}>Green</strong> is right, <strong style={{ color: theme.goldText }}>gold</strong> is close, and an arrow points toward the answer.
        </p>

        {/* The finish: who it was, the record, and the way to post it. */}
        {game.done && (
          <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 14, background: theme.wash, border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <img src={headshot(answer.id, 72)} alt="" width={72} height={72} style={{ borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>
                {game.done === 'won' ? `Got it in ${game.guesses.length}` : 'Today’s Packer'}
              </div>
              <div style={{ fontFamily: theme.serif, fontSize: 22, color: theme.green, lineHeight: 1.1 }}>{answer.name}</div>
              <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 2 }}>
                #{answer.jersey} · {answer.pos} · {answer.college}
              </div>
              <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.ink, marginTop: 6 }}>
                Streak <strong>{game.streak}</strong> · best <strong>{game.best}</strong> · solved <strong>{game.wins}</strong> of {game.played} · next player in {next}
              </div>
              <button type="button" onClick={share} className="link-hover"
                style={{ marginTop: 8, cursor: 'pointer', background: theme.green, color: '#fff', border: 'none', borderRadius: 16, padding: '7px 14px', fontFamily: theme.sans, fontSize: 12.5, fontWeight: 700 }}>
                {copied ? 'Result copied' : 'Share your result'}
              </button>
            </div>
          </div>
        )}

        {/* The guess box: type a name, tap a match. Names only — the clues are the game. */}
        {!game.done && (
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <label htmlFor="guess-name" style={{ display: 'block', fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, marginBottom: 5 }}>
              Guess {game.guesses.length + 1} of {MAX_GUESSES}
            </label>
            <input id="guess-name" type="text" autoComplete="off" autoCapitalize="words" spellCheck={false} value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && options.length) { e.preventDefault(); guess(options[0]) } }}
              placeholder="Type a Packer’s name"
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: theme.sans, fontSize: 16, padding: '10px 12px', color: theme.ink, background: '#fff', border: `1.5px solid ${theme.green}`, borderRadius: 6 }} />
            {options.length > 0 && (
              <ul role="listbox" aria-label="Matching players" style={{ listStyle: 'none', margin: '4px 0 0', padding: 0, border: `1px solid ${theme.rule}`, borderRadius: 6, background: '#fff', overflow: 'hidden' }}>
                {options.map((p, i) => (
                  <li key={p.id} role="option" aria-selected={i === 0}>
                    <button type="button" onClick={() => guess(p)} className="hover-row"
                      style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', background: i === 0 ? theme.wash : '#fff', border: 'none', borderTop: i ? `1px solid ${theme.rule}` : 'none', padding: '10px 12px', fontFamily: theme.sans, fontSize: 14.5, color: theme.ink }}>
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && options.length === 0 && (
              <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 5 }}>No one on the current roster by that name.</div>
            )}
          </div>
        )}

        {/* The hint: the player's outline, once four guesses have missed. */}
        {!game.done && game.guesses.length >= HINT_AFTER && (
          <div style={{ marginBottom: 14 }}>
            {hint ? (
              // The filter blackens everything the <img> paints — a background on the image itself
              // turned the hint into a black square — so the tint lives on the wrapper.
              <div style={{ width: 132, background: theme.wash, border: `1px solid ${theme.rule}`, borderRadius: 8, overflow: 'hidden' }}>
                <img src={headshot(answer.id, 96)} alt="A silhouette of today’s player" width={132} height={96}
                  style={{ display: 'block', objectFit: 'cover', filter: 'brightness(0)', opacity: 0.8 }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
              </div>
            ) : (
              <button type="button" onClick={() => { setHint(true); track('Guess Hint') }} className="link-hover"
                style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: '8px 0', fontFamily: theme.sans, fontSize: 12.5, fontWeight: 700, color: theme.green }}>
                Need a hint? Show the silhouette
              </button>
            )}
          </div>
        )}

        {game.guesses.length > 0 && (
          <div role="table" aria-label="Your guesses">
            <div role="row" style={{ display: 'grid', gridTemplateColumns: cols, gap: 4, marginBottom: 4 }}>
              {labels.map((l) => <div key={l} role="columnheader" style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, textAlign: 'center' }}>{l}</div>)}
            </div>
            {[...game.guesses].reverse().map((id) => {
              const p = roster.byId[id]
              return (
                <div key={id} style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: theme.serif, fontSize: 15, color: id === game.answerId ? theme.green : theme.ink, fontWeight: id === game.answerId ? 700 : 400, marginBottom: 3 }}>{p.name}</div>
                  <div role="row" style={{ display: 'grid', gridTemplateColumns: cols, gap: 4 }}>{clues(p, answer).map(cell)}</div>
                </div>
              )
            })}
          </div>
        )}
        {!game.done && game.guesses.length > 0 && (
          <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted }}>{left} {left === 1 ? 'guess' : 'guesses'} left.</div>
        )}

        <div style={{ fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 14, lineHeight: 1.5 }}>
          A new player every day at midnight Central, the same one for everyone. Gold on position means the same side of the ball; on a number, within 5 (jersey) or 2 (age, seasons, inches). Your streak is kept on this device.
        </div>
      </div>
    )
  })()

  return <Section kicker="The daily game" title="Guess the Packer" sponsor={SPONSORS.guess || undefined} slot="guess">{body}</Section>
}

// The Season tab's door to the game: one slim row that knows whether today's is done.
export function GuessPromo({ onPlay }) {
  const [state] = useState(() => { const s = loadStore(); return s.day === dayKey() ? s : { ...s, guesses: [], done: null } })
  const line = state.done === 'won' ? `Solved in ${state.guesses.length} today · streak ${state.streak}`
    : state.done === 'lost' ? 'Today’s got away — a new player at midnight'
      : state.guesses.length ? `${state.guesses.length} of ${MAX_GUESSES} guesses used — finish today’s`
        : 'One mystery player a day, eight guesses'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 14px', borderTop: `1px solid ${theme.rule}`, padding: '16px 0' }}>
      <div>
        <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>The daily game</div>
        <div style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink, marginTop: 2 }}>Guess the Packer <span style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted }}>· {line}</span></div>
      </div>
      <button type="button" onClick={onPlay} className="link-hover"
        style={{ cursor: 'pointer', background: theme.green, color: '#fff', border: 'none', borderRadius: 18, padding: '9px 16px', fontFamily: theme.sans, fontSize: 13, fontWeight: 700 }}>
        {state.done ? 'See today’s board' : state.guesses.length ? 'Keep playing' : 'Play today’s'}
      </button>
    </div>
  )
}
