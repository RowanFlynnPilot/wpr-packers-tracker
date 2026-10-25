import { theme } from '../theme.js'
import { TEAM_ID, TEAM_ABBRS, TEAM_NAMES, TEAM_ACCENT } from '../config.js'
import TeamLogo from './TeamLogo.jsx'

// The live hero's field strip — "where's the ball?" answered the way TV answers it: the spot,
// the line of scrimmage (blue), the line to gain (yellow), the drive so far, and the red zone.
// Drawn in Packers terms (api.js fieldState): Green Bay's end zone is ALWAYS on the left and the
// Packers always attack right, so the picture never flips with possession. The SVG is the turf
// only (stretched, no text); every label is HTML so it stays readable at any width. The ball
// glides to its new spot on each 30-second update (instant with reduced motion).
const pct = (x) => `${((10 + x) / 120) * 100}%`  // yard x (0–100 from GB's goal line) → % of strip
const YARD_NUMBERS = [10, 20, 30, 40, 50, 60, 70, 80, 90]

export default function LiveField({ field, oppId, narrow }) {
  const oppAccent = TEAM_ACCENT[oppId] || '#555'
  const ballName = field.gbBall ? 'Packers' : TEAM_NAMES[field.ballTeam] || 'Opponent'
  const ballSide = field.gbBall ? TEAM_ID : oppId
  const hasDrive = field.driveStart != null && field.driveStart !== field.x
  const pill = (text, style) => (
    <span style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 3, padding: '2px 6px', whiteSpace: 'nowrap', ...style }}>{text}</span>
  )

  return (
    <div style={{ margin: '0 0 16px' }}>
      <div aria-hidden="true" style={{ position: 'relative', height: narrow ? 46 : 58, borderRadius: 6, overflow: 'hidden', background: theme.green }}>
        <svg viewBox="0 0 120 10" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
          <rect x="0" y="0" width="10" height="10" fill={theme.gold} />
          <rect x="110" y="0" width="10" height="10" fill={oppAccent} />
          {field.redZone && (
            field.gbBall
              ? <rect x="90" y="0" width="20" height="10" fill={theme.gold} opacity="0.16" />
              : <rect x="10" y="0" width="20" height="10" fill="#e25c4a" opacity="0.22" />
          )}
          {Array.from({ length: 19 }, (_, i) => (i + 1) * 5).map((y) => (
            <line key={y} x1={10 + y} x2={10 + y} y1="0" y2="10" stroke="#fff" strokeOpacity={y % 10 === 0 ? 0.26 : 0.1} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="10" x2="10" y1="0" y2="10" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <line x1="110" x2="110" y1="0" y2="10" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          {hasDrive && (
            <rect x={10 + Math.min(field.driveStart, field.x)} y="3.7" width={Math.abs(field.x - field.driveStart)} height="2.6" fill="#fff" opacity="0.24" />
          )}
          <line x1={10 + field.x} x2={10 + field.x} y1="0" y2="10" stroke="#8fc1ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {field.lineToGain != null && (
            <line x1={10 + field.lineToGain} x2={10 + field.lineToGain} y1="0" y2="10" stroke="#ffd23f" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {/* End-zone names and yard numbers — HTML, so the stretched SVG never distorts them. */}
        {[[TEAM_ID, 0, theme.green], [oppId, 110, '#fff']].map(([id, x, color]) => (
          <span key={id} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(x / 120) * 100}%`, width: `${(10 / 120) * 100}%`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: narrow ? 10 : 12, fontWeight: 800, letterSpacing: '0.06em', color }}>
            {TEAM_ABBRS[id]}
          </span>
        ))}
        {YARD_NUMBERS.filter((y) => !narrow || y % 20 === 10 || y === 50).map((y) => (
          <span key={y} style={{ position: 'absolute', bottom: narrow ? 2 : 3, left: pct(y), transform: 'translateX(-50%)', fontFamily: theme.sans, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
            {y > 50 ? 100 - y : y}
          </span>
        ))}
        {/* The ball — a small football, white-rimmed so it reads on the turf. */}
        <span className="field-ball" style={{ position: 'absolute', top: '42%', left: pct(field.x), transform: 'translate(-50%, -50%)', lineHeight: 0 }}>
          <svg width={narrow ? 18 : 22} height={narrow ? 11 : 13} viewBox="0 0 22 13">
            <ellipse cx="11" cy="6.5" rx="10" ry="5.5" fill="#7a3e1d" stroke="#fff" strokeWidth="1.2" />
            <line x1="7.5" x2="14.5" y1="6.5" y2="6.5" stroke="#fff" strokeWidth="1" />
            {[9, 11, 13].map((x) => <line key={x} x1={x} x2={x} y1="5" y2="8" stroke="#fff" strokeWidth="0.9" />)}
          </svg>
        </span>
      </div>

      {/* Who has it, where, and how the drive is going — the words the strip draws. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px 12px', flexWrap: 'wrap', marginTop: 8, fontFamily: theme.sans, fontSize: 13, textAlign: 'left' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', fontWeight: 700, color: field.gbBall ? theme.green : theme.ink }}>
          <TeamLogo id={ballSide} size={18} />
          <span>{ballName} ball{field.downText && <span style={{ color: theme.ink }}> · {field.downText}</span>}</span>
          {field.redZone && pill('Red zone', field.gbBall ? { background: theme.gold, color: theme.green } : { background: '#f6dcd7', color: theme.red })}
          {field.down === 4 && pill('4th down', { border: `1px solid ${theme.red}`, color: theme.red })}
        </span>
        {field.driveText && <span style={{ color: theme.muted, fontSize: 12 }}>Drive: {field.driveText}</span>}
      </div>
    </div>
  )
}
