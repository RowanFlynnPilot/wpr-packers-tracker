import { theme } from '../theme.js'
import { teamLogo } from '../config.js'
import { winnerOf } from '../games.js'

// One game on the pick sheet: two tappable sides, the kickoff/live/final column, and — on
// the tiebreaker game — the total-points call. Each side carries its record and a win %:
// ESPN FPI's pregame projection, or the live win probability once the game is on (the
// caller resolves which; this row just prints it, favorite in ink). `narrow` (a phone or
// a sidebar-width iframe) tightens the row and, once a side carries a score, keeps only
// the percentage under the abbreviation — at 375px a scored side has room for one, not both.

const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// A picked side through a game's life: green while it waits, gold while the game is on,
// then green ✓ / red ✗ at the final. Unpicked sides stay quiet.
const LOOK = {
  none: { ring: theme.rule, bg: 'transparent' },
  pre: { ring: theme.green, bg: '#eef3f0' },
  live: { ring: theme.gold, bg: '#fff8e6' },
  correct: { ring: theme.green, bg: '#eef3f0', mark: '✓', color: theme.green, label: 'Pick correct' },
  wrong: { ring: theme.red, bg: '#fdf0ef', mark: '✗', color: theme.red, label: 'Pick missed' },
}

function Side({ team, pct, favorite, status, pickable, onPick, narrow }) {
  const look = LOOK[status]
  const picked = status !== 'none'
  const scored = team.score != null
  // Week 1's thirty-two "0-0"s are noise; on a phone a scored side shows the % alone.
  const record = team.record && team.record !== '0-0' && !(narrow && scored) ? team.record : ''
  return (
    <button
      onClick={pickable ? onPick : undefined}
      disabled={!pickable}
      aria-pressed={picked}
      style={{
        display: 'flex', alignItems: 'center', gap: narrow ? 6 : 8, flex: '1 1 0', minWidth: 0,
        background: look.bg, border: `1.5px solid ${look.ring}`, borderRadius: 8, padding: narrow ? '6px 8px' : '6px 10px',
        cursor: pickable ? 'pointer' : 'default', opacity: !pickable && !picked ? 0.72 : 1,
        fontFamily: theme.sans, textAlign: 'left',
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      <img src={teamLogo(team.id)} alt="" width={narrow ? 20 : 22} height={narrow ? 20 : 22} loading="lazy" decoding="async"
        style={{ objectFit: 'contain', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: picked ? 700 : 600, color: theme.ink, lineHeight: 1.2 }}>{team.abbr}</span>
        {(record || pct != null) && (
          <span style={{ display: 'block', fontSize: 10.5, color: theme.muted, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {record}{record && pct != null ? ' · ' : ''}
            {pct != null && <span style={{ color: favorite ? theme.ink : theme.muted, fontWeight: favorite ? 700 : 400 }}>{pct}%</span>}
          </span>
        )}
      </span>
      {scored && (
        <span style={{ fontSize: 15, fontWeight: 700, color: theme.ink, flexShrink: 0 }}>{team.score}</span>
      )}
      {look.mark && (
        <span aria-label={look.label} style={{ fontSize: 13, fontWeight: 700, color: look.color, flexShrink: 0 }}>{look.mark}</span>
      )}
    </button>
  )
}

// `pct`: { home, away } (whole numbers) or null. `tiebreak`: { value, onChange, locked, actual }
// on the tiebreaker game only.
export default function PickRow({ game: g, pick, pct, pickable, onPick, packers, tiebreak, narrow }) {
  const winner = winnerOf(g)
  const status = (id) => (pick !== id ? 'none' : g.completed ? (winner === id ? 'correct' : 'wrong') : g.state === 'in' ? 'live' : 'pre')
  const favorite = pct ? (pct.home >= pct.away ? g.home.id : g.away.id) : null
  const live = g.state === 'in'
  return (
    <div style={{
      padding: '6px 8px', borderRadius: 10, marginBottom: 6,
      background: packers ? theme.wash : 'transparent',
      border: `1px solid ${packers ? theme.rule : 'transparent'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? 6 : 8 }}>
        <Side team={g.away} pct={pct?.away} favorite={favorite === g.away.id} status={status(g.away.id)} pickable={pickable} onPick={() => onPick(g.away.id)} narrow={narrow} />
        <span style={{ fontFamily: theme.sans, fontSize: 10, color: theme.muted, flexShrink: 0 }}>{g.neutral ? 'vs' : 'at'}</span>
        <Side team={g.home} pct={pct?.home} favorite={favorite === g.home.id} status={status(g.home.id)} pickable={pickable} onPick={() => onPick(g.home.id)} narrow={narrow} />
        <span style={{ fontFamily: theme.sans, fontSize: 11, color: live ? theme.red : theme.muted, fontWeight: live ? 700 : 400, width: narrow ? 54 : 70, textAlign: 'right', flexShrink: 0, lineHeight: 1.25 }}>
          {live ? 'Live' : g.completed ? 'Final' : g.timeValid ? fmtTime(g.date) : 'TBD'}
          {live && g.detail ? <span style={{ display: 'block', fontSize: 9.5, fontWeight: 400, color: theme.muted }}>{g.detail}</span> : null}
          {!live && !g.completed && g.tv ? <span style={{ display: 'block', fontSize: 9.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.tv}</span> : null}
          {g.completed && /OT/i.test(g.detail) ? <span style={{ display: 'block', fontSize: 9.5 }}>Overtime</span> : null}
        </span>
      </div>

      {tiebreak && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 7, paddingTop: 7, borderTop: `1px solid ${theme.rule}`, fontFamily: theme.sans, fontSize: 11.5, color: theme.muted }}>
          <label htmlFor="pickem-tiebreak">Tiebreaker · total points in this game</label>
          {tiebreak.locked ? (
            <span style={{ color: theme.ink, fontWeight: 700 }}>
              {tiebreak.value != null ? tiebreak.value : 'No call'}
              {tiebreak.actual != null && (
                <span style={{ color: theme.muted, fontWeight: 400 }}>
                  {' '}· actual {tiebreak.actual}{tiebreak.value != null ? `, off by ${Math.abs(tiebreak.actual - tiebreak.value)}` : ''}
                </span>
              )}
            </span>
          ) : (
            // The house .field chrome (border, hover, focus) minus the select's chevron.
            <input id="pickem-tiebreak" className="field" type="number" inputMode="numeric" min={0} max={200} placeholder="e.g. 47"
              value={tiebreak.value ?? ''} onChange={(e) => tiebreak.onChange(e.target.value)}
              style={{ width: 92, padding: '5px 10px', backgroundImage: 'none', fontFamily: theme.sans, fontSize: 13, color: theme.ink }} />
          )}
        </div>
      )}
    </div>
  )
}
