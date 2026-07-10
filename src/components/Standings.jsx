import { theme } from '../theme.js'
import { TEAM_ID, SEASON } from '../config.js'
import { recentResults } from '../games.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { Loading, ErrorState } from './Status.jsx'
import TeamLogo from './TeamLogo.jsx'

const th = { fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, textAlign: 'right', fontWeight: 700 }
const td = { fontFamily: theme.sans, fontSize: 14, color: theme.ink, textAlign: 'right', borderTop: `1px solid ${theme.rule}`, whiteSpace: 'nowrap' }

// Tiny result sequence strip under the streak — the order of the last five, which the number
// alone can't show (green = win, rule-gray = loss, gold = tie, oldest → newest).
function FormStrip({ results }) {
  if (!results.length) return null
  return (
    <span aria-hidden="true" style={{ display: 'flex', gap: 2, justifyContent: 'flex-end', marginTop: 4 }}>
      {results.map((r, i) => (
        <span key={i} style={{ width: 5, height: 8, borderRadius: 1, background: r === 'W' ? theme.green : r === 'T' ? theme.gold : theme.rule }} />
      ))}
    </span>
  )
}

// The NFC North table, from the shared standings bundle. Before Week 1 it shows last season's
// final table with a clear label, and flips over automatically once the new season has results.
export default function Standings({ bundle, schedules, error }) {
  const narrow = useIsNarrow()
  if (!bundle) return error ? <ErrorState /> : <Loading />
  const rows = bundle.standings
  const offseason = bundle.season < SEASON

  // Drop the most advanced columns on phones so the table fits without sideways scrolling.
  const thc = { ...th, padding: narrow ? '8px 5px' : '8px 10px' }
  const tdc = { ...td, padding: narrow ? '9px 5px' : '10px' }

  return (
    <div style={{ overflowX: 'auto' }}>
      {offseason && (
        <div style={{ fontFamily: theme.sans, fontSize: 11.5, color: theme.muted, marginBottom: 10 }}>
          Final {bundle.season} standings — the new table starts at Week 1.
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th scope="col" style={{ ...thc, textAlign: 'left' }}>Team</th>
            <th scope="col" style={thc}>W</th><th scope="col" style={thc}>L</th><th scope="col" style={thc}>T</th>
            {!narrow && <th scope="col" style={thc}>PCT</th>}
            {!narrow && <th scope="col" style={thc}>Div</th>}
            <th scope="col" style={thc}>Pt diff</th>
            <th scope="col" style={thc}>Streak</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const me = t.id === TEAM_ID
            const pd = t.pointDiff
            const sc = t.streak || '—'
            return (
              <tr key={t.id} className={me ? undefined : 'hover-row'} style={me ? { background: theme.wash } : undefined}>
                <td style={{ ...tdc, textAlign: 'left' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: narrow ? 7 : 9, fontFamily: theme.serif, fontSize: narrow ? 14 : 16, fontWeight: me ? 700 : 400, color: me ? theme.green : theme.ink }}>
                    <TeamLogo id={t.id} size={narrow ? 18 : 22} />
                    {t.name}
                  </span>
                </td>
                <td style={tdc}>{t.wins}</td>
                <td style={tdc}>{t.losses}</td>
                <td style={tdc}>{t.ties}</td>
                {!narrow && <td style={tdc}>{t.pct}</td>}
                {!narrow && <td style={tdc}>{t.divRecord || '—'}</td>}
                <td style={{ ...tdc, color: pd > 0 ? theme.green : pd < 0 ? theme.red : theme.ink }}>{pd > 0 ? '+' : ''}{pd}</td>
                <td style={tdc}>
                  <span style={{ color: sc[0] === 'W' ? theme.green : sc[0] === 'L' ? theme.red : theme.ink, fontWeight: 700 }}>{sc}</span>
                  {schedules && <FormStrip results={recentResults(schedules, t.id)} />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
