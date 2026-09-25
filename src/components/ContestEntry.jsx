import { useState } from 'react'
import { theme } from '../theme.js'
import { CONTEST } from '../config.js'
import { enter, resume } from '../contest.js'
import { track } from '../analytics.js'

// The contest's front door — deliberately the opposite of the six-field wall the TV station
// puts up before a reader sees a game: here the reader has already picked, and this card just
// attaches a name to the sheet. First, last, email, a four-digit PIN (for getting back in on
// another device), ZIP optional, one checkbox for the rules. `onEntered({ token, name })`
// when it lands. A returning reader on a new device flips to "resume" (email + PIN).

const input = { fontFamily: theme.sans, fontSize: 14, color: theme.ink, padding: '8px 11px', backgroundImage: 'none', width: '100%' }
const label = { display: 'block', fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, marginBottom: 4 }

// Module scope on purpose. Declared inside ContestEntry, every keystroke's re-render minted a
// NEW component type, React remounted the whole field — the <input> included — and focus fell
// out of the box after each character. Wrappers around inputs must never be declared in render.
function Field({ id, text, children }) {
  return (
    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
      <label htmlFor={id} style={label}>{text}</label>
      {children}
    </div>
  )
}

export default function ContestEntry({ onEntered }) {
  const [mode, setMode] = useState('enter')
  const [form, setForm] = useState({ first: '', last: '', email: '', zip: '', pin: '', agree: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const resuming = mode === 'resume'

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = resuming ? await resume(form.email, form.pin) : await enter(form)
      track(resuming ? 'Contest Resume' : 'Contest Enter')
      onEntered(r)
    } catch (err) {
      setError(err.message)
      if (err.status === 409) setMode('resume') // already entered — the message says so; land them on resume
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate
      style={{ border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`, borderRadius: 8, background: '#fff', padding: '14px 18px 16px', margin: '22px 0 4px' }}>
      <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>Play for the prize</div>
      <div style={{ fontFamily: theme.serif, fontSize: 21, color: theme.ink, marginTop: 4, lineHeight: 1.15 }}>
        {resuming ? 'Welcome back' : 'Enter the contest'}
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginTop: 6, lineHeight: 1.5, maxWidth: 620 }}>
        {resuming
          ? 'Your email and PIN pick your entry back up on this device — every pick you make here counts.'
          : <>Your picks are already on the sheet — enter once and every week counts toward {CONTEST.prizes.weekly} and {CONTEST.prizes.season}. {CONTEST.eligibility} Free to play.</>}
        {' '}
        <a href={CONTEST.rules} target="_blank" rel="noopener noreferrer" style={{ color: theme.green, fontWeight: 700 }}>Official rules</a>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 14px', marginTop: 14 }}>
        {!resuming && (
          <>
            <Field id="ce-first" text="First name">
              <input id="ce-first" className="field" style={input} value={form.first} onChange={set('first')} autoComplete="given-name" maxLength={40} required />
            </Field>
            <Field id="ce-last" text="Last name">
              <input id="ce-last" className="field" style={input} value={form.last} onChange={set('last')} autoComplete="family-name" maxLength={40} required />
            </Field>
          </>
        )}
        <Field id="ce-email" text="Email">
          <input id="ce-email" className="field" style={input} type="email" value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" maxLength={120} required />
        </Field>
        {!resuming && (
          <Field id="ce-zip" text="ZIP (optional)">
            <input id="ce-zip" className="field" style={input} value={form.zip} onChange={set('zip')} autoComplete="postal-code" inputMode="numeric" maxLength={10} />
          </Field>
        )}
        <Field id="ce-pin" text={resuming ? 'Your PIN' : 'Pick a 4-digit PIN'}>
          <input id="ce-pin" className="field" style={input} value={form.pin} onChange={set('pin')} inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" required />
        </Field>
      </div>
      {!resuming && (
        <div style={{ fontFamily: theme.sans, fontSize: 11.5, color: theme.muted, marginTop: 6 }}>
          The PIN gets you back into your entry on another phone or computer — no password, no email link.
        </div>
      )}

      {!resuming && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: theme.sans, fontSize: 12.5, color: theme.ink, marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.agree} onChange={set('agree')} style={{ marginTop: 2, accentColor: theme.green }} required />
          <span>I’ve read the official rules and I’m eligible to play.</span>
        </label>
      )}

      {error && <div role="alert" style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.red, marginTop: 10 }}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="submit" disabled={busy} className="link-hover"
          style={{ background: theme.green, color: '#fff', border: 'none', borderRadius: 5, padding: '9px 16px', fontFamily: theme.sans, fontSize: 13, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'One moment…' : resuming ? 'Resume my entry' : 'Enter the contest'}
        </button>
        <button type="button" onClick={() => { setMode(resuming ? 'enter' : 'resume'); setError(null) }} className="link-hover"
          style={{ background: 'transparent', border: 'none', padding: 0, fontFamily: theme.sans, fontSize: 12, color: theme.muted, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
          {resuming ? 'New here? Enter the contest' : 'Already entered? Resume with your email and PIN'}
        </button>
      </div>
    </form>
  )
}
