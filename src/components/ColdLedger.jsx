import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_NAMES } from '../config.js'
import { fetchSeasonGames } from '../api.js'
import { fetchKickoffForecast } from '../weather.js'
import { loadLedger, coldRank, coldest, bandRecords, recordOf, LEDGER_FROM } from '../coldLedger.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Section from './Section.jsx'
import TeamLogo from './TeamLogo.jsx'

// "The cold ledger" — Lambeau by the thermometer: where the next home game's forecast would rank
// among every Lambeau kickoff since 2000, the Packers' home record by temperature band, and the
// ten coldest kickoffs. Data: coldLedger.js (baked history + this season live). Temperatures are
// reanalysis ESTIMATES at the kickoff minute and the section says so. Owns its Section;
// fail-soft — no ledger, no section; no forecast yet, the history stands on its own.
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
// A real minus sign: "-2°" set in the serif reads as a dash.
const deg = (t) => `${t < 0 ? '−' : ''}${Math.abs(t)}°`
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function ColdLedger() {
  const [entries, setEntries] = useState(null)
  const [next, setNext] = useState(null) // { game, forecast } — the next Lambeau kickoff
  const narrow = useIsNarrow()

  useEffect(() => {
    let alive = true
    loadLedger().then((e) => { if (alive) setEntries(e) }).catch(() => {})
    fetchSeasonGames().then(async ({ games }) => {
      const game = games.find((g) => g.state === 'pre' && g.home && g.seasonType !== 1)
      if (!alive || !game) return
      setNext({ game, forecast: null })
      // Only a real kickoff time gets a forecast, and only inside Open-Meteo's 16-day window.
      if (game.timeValid) {
        const forecast = await fetchKickoffForecast(game.date).catch(() => null)
        if (alive && forecast) setNext({ game, forecast })
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!entries || entries.length < 50) return null

  const bands = bandRecords(entries)
  const top = coldest(entries, 10)
  const freezing = entries.filter((e) => e.temp < 32)
  const mild = entries.filter((e) => e.temp >= 50)
  const temp = next?.forecast?.tempF
  const rank = temp == null ? null : coldRank(entries, temp)
  const opp = next ? TEAM_NAMES[next.game.oppId] || next.game.oppName : null
  const day = next ? new Date(next.game.date).toLocaleDateString('en-US', { weekday: 'long' }) : null

  // The lede: the forecast against the ledger when there is one, the record otherwise.
  const lede = rank != null
    ? <>The forecast for {day}’s kickoff against the {opp} is <strong>{deg(temp)}F</strong> — {rank <= 10
        ? <>cold enough for the list below: it would be the <strong>{ord(rank)}-coldest</strong> Lambeau kickoff since {LEDGER_FROM}.</>
        : rank <= 40
          ? <>the <strong>{ord(rank)}-coldest</strong> of {entries.length + 1} Lambeau kickoffs since {LEDGER_FROM}, if it holds.</>
          : <>ordinary by Lambeau standards: {rank - 1} kickoffs since {LEDGER_FROM} have been colder.</>}</>
    : <>Since {LEDGER_FROM} the Packers are <strong>{recordOf(freezing)}</strong> at Lambeau when it’s below freezing at kickoff, and <strong>{recordOf(mild)}</strong> when it’s 50 or warmer.
        {next && <> The forecast for the next one — the {opp}, {new Date(next.game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — arrives about two weeks out.</>}</>

  // The list: the ten coldest, with the forecast slotted in where it would land.
  const rows = top.map((e, i) => ({ ...e, rank: i + 1 }))
  if (rank != null && rank <= 10) rows.splice(rank - 1, 0, { forecast: true, temp, rank, date: next.game.date, oppId: next.game.oppId })

  return (
    <Section kicker="The cold ledger" title="Lambeau by the thermometer">
      <p style={{ fontFamily: theme.serif, fontSize: narrow ? 15.5 : 17, color: theme.ink, lineHeight: 1.45, margin: '-6px 0 18px', maxWidth: 640, textWrap: 'pretty' }}>{lede}</p>

      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 5fr) minmax(0, 6fr)', gap: narrow ? 22 : 34, alignItems: 'start' }}>
        {/* The record by kickoff temperature: win rate on one 0–100 scale, .500 ticked. */}
        <div>
          <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700, marginBottom: 8 }}>Home record by kickoff temperature</div>
          {bands.map((b) => (
            <div key={b.label} style={{ padding: '7px 0', borderTop: `1px solid ${theme.rule}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: theme.sans, fontSize: 13, color: theme.ink }}>{b.label}</span>
                <span style={{ fontFamily: theme.serif, fontSize: 17, color: theme.ink }}>
                  {b.w}–{b.l}{b.t ? `–${b.t}` : ''}
                  {b.pct != null && <span style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginLeft: 8 }}>{b.pct.toFixed(3).replace(/^0/, '')}</span>}
                </span>
              </div>
              {b.pct != null && (
                <div aria-hidden="true" style={{ position: 'relative', height: 6, borderRadius: 3, background: theme.rule, marginTop: 5 }}>
                  <div style={{ width: `${b.pct * 100}%`, height: '100%', borderRadius: 3, background: theme.green }} />
                  <div style={{ position: 'absolute', top: -2, bottom: -2, left: '50%', width: 1.5, background: theme.ink, opacity: 0.5 }} />
                </div>
              )}
            </div>
          ))}
          <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 6 }}>
            {entries.length} home games, regular season and playoffs. The tick marks .500.
          </div>
        </div>

        <div>
          <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700, marginBottom: 8 }}>The ten coldest kickoffs</div>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {rows.map((e) => (
              <li key={e.forecast ? 'forecast' : e.date} style={{ display: 'grid', gridTemplateColumns: '20px 58px minmax(0, 1fr)', alignItems: 'center', columnGap: 8, padding: e.forecast ? '8px 8px' : '6px 0', margin: e.forecast ? '2px -8px' : 0, borderTop: e.forecast ? `3px solid ${theme.gold}` : `1px solid ${theme.rule}`, background: e.forecast ? theme.wash : 'transparent', borderRadius: e.forecast ? 5 : 0 }}>
                <span style={{ fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: theme.muted, textAlign: 'right' }}>{e.forecast ? '' : e.rank}</span>
                <span style={{ fontFamily: theme.serif, fontSize: 21, color: theme.ink, textAlign: 'right', whiteSpace: 'nowrap' }}>{deg(e.temp)}</span>
                <span style={{ minWidth: 0, fontFamily: theme.sans, fontSize: 13, color: theme.ink, lineHeight: 1.35 }}>
                  {e.forecast ? (
                    <>
                      <strong style={{ color: theme.goldText, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Forecast</strong>{' '}
                      {day} vs the {opp} — would rank {ord(e.rank)}
                    </>
                  ) : (
                    <>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, verticalAlign: 'middle' }}>
                        <TeamLogo id={e.oppId} size={16} />
                        <strong style={{ color: e.tied ? theme.ink : e.won ? theme.green : theme.red }}>{e.tied ? 'T' : e.won ? 'W' : 'L'} {e.gb}–{e.opp}</strong>
                      </span>{' '}
                      <span style={{ color: theme.muted }}>vs {TEAM_NAMES[e.oppId] || 'opponent'} · {fmtDate(e.date)}{e.post ? ' · playoffs' : ''}{e.current ? ' · this season' : ''}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div style={{ fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 14, lineHeight: 1.5, maxWidth: 660 }}>
        Temperatures are estimates for the minute of kickoff from Open-Meteo’s historical weather record, not the official game-book readings; they can differ by a few degrees, and they are air temperature, not wind chill. ESPN’s archive has kickoff times from {LEDGER_FROM} on, so the ledger starts there.
      </div>
    </Section>
  )
}
