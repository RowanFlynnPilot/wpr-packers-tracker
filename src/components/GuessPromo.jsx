import { useState } from 'react'
import { theme } from '../theme.js'
import { MAX_GUESSES, dayKey, loadStore } from '../guess.js'

// The Season tab's door to the game: one slim row that knows whether today's is done.
export default function GuessPromo({ onPlay }) {
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
