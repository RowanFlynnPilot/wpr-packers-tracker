import { theme } from '../theme.js'
import { TEAM_ID, SEASON, CONFERENCE, DIVISION, DIVISION_NAME, GAMES_IN_SEASON } from '../config.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Section from './Section.jsx'
import TeamLogo from './TeamLogo.jsx'

// "If the season ended today" — the conference's seven seeds as wild-card weekend would pair
// them (2 hosts 7, 3 hosts 6, 4 hosts 5, the 1 seed rests), the teams in the hunt behind them, and
// one sentence on where the Packers stand against the cut line. Seeds are ESPN's own
// `playoffSeed` (tiebreakers applied — we don't re-derive them), clinch marks are its `clincher`.
// Reads the standings bundle App already holds; waits for Week 1 (preseason seeds are
// meaningless) and renders nothing until then or on a short table.
const MARK = {
  '*': { chip: 'No. 1 seed', full: 'Clinched the No. 1 seed' },
  z: { chip: 'Div. champs', full: 'Clinched the division' },
  y: { chip: 'Clinched', full: 'Clinched a playoff spot' },
  x: { chip: 'Clinched', full: 'Clinched a playoff spot' },
  e: { chip: 'Out', full: 'Eliminated from playoff contention' },
}
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
// Games between two records (ties cancel out of wins minus losses), in words.
const gap = (a, b) => ((a.wins - a.losses) - (b.wins - b.losses)) / 2
const games = (n) => n === 0.5 ? 'half a game' : n === 1 ? 'a game' : n === 1.5 ? 'a game and a half'
  : Number.isInteger(n) ? `${n < 10 ? WORDS[n] : n} games` : `${Math.floor(n)}½ games`
const rec = (t) => `${t.wins}–${t.losses}${t.ties ? `–${t.ties}` : ''}`

// The Packers in one sentence, against whichever line matters for where they sit.
function packersLine(seeds, by, final) {
  const me = seeds.find((r) => r.id === TEAM_ID)
  if (!me) return null
  if (me.clincher === 'e') return 'The Packers have been eliminated from playoff contention.'
  const opp = me.seed >= 2 && me.seed <= 7 ? by(9 - me.seed) : null
  // What the seed would mean on wild-card weekend.
  const draw = me.seed === 1 ? 'have the only first-round bye'
    : opp ? `${me.seed <= 4 ? 'host' : 'play at'} the ${opp.name} on wild-card weekend` : null
  if (final) return me.seed <= 7 ? `The Packers are in as the No. ${me.seed} seed. They ${draw}.` :'The Packers missed the playoffs.'
  if (me.seed <= 4) {
    const rival = seeds.filter((r) => DIVISION[r.id] && r.id !== TEAM_ID).sort((a, b) => a.seed - b.seed)[0]
    const lead = rival ? gap(me, rival) : 0
    return `The Packers lead the ${DIVISION_NAME} ${lead > 0 ? `by ${games(lead)}` : 'on a tiebreaker'}. As the No. ${me.seed} seed they would ${draw}.`
  }
  if (me.seed <= 7) {
    const cut = by(8)
    const m = cut ? gap(me, cut) : 0
    const margin = m > 0 ? `${games(m)} clear of the ${cut.name}` : `level with the ${cut?.name || 'next team'} and ahead on a tiebreaker`
    return `The Packers hold the No. ${me.seed} seed${me.seed === 7 ? ' — the last spot in —' : ','} ${margin}. They would ${draw}.`
  }
  const last = by(7)
  const m = last ? gap(last, me) : 0
  return m > 0
    ? `The Packers are on the outside at No. ${me.seed}, ${games(m)} behind the ${last.name} for the last spot.`
    : `The Packers are on the outside at No. ${me.seed} — level with the ${last?.name || 'last team in'} for the last spot but behind on tiebreakers.`
}

export default function PlayoffPicture({ bundle }) {
  const narrow = useIsNarrow()
  if (!bundle || bundle.season !== SEASON) return null
  const seeds = bundle.league.filter((r) => r.conf === CONFERENCE && r.seed).sort((a, b) => a.seed - b.seed)
  if (seeds.length < 12) return null
  const by = (s) => seeds.find((r) => r.seed === s)
  const final = seeds.every((r) => r.wins + r.losses + r.ties >= GAMES_IN_SEASON)

  const row = (r, first) => {
    const mine = r.id === TEAM_ID
    const mark = MARK[r.clincher]
    return (
      <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '18px 22px minmax(0, 1fr) auto', alignItems: 'center', columnGap: 8, padding: '7px 0', borderTop: first ? 'none' : `1px solid ${theme.rule}` }}>
        <span style={{ fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: theme.muted, textAlign: 'right' }}>{r.seed}</span>
        <TeamLogo id={r.id} size={22} />
        <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: theme.serif, fontSize: 15.5, color: mine ? theme.green : theme.ink, fontWeight: mine ? 700 : 400 }}>{r.name}</span>
          {mark && (
            <span title={mark.full} style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: r.clincher === 'e' ? '#fff' : theme.green, background: r.clincher === 'e' ? theme.muted : theme.gold, borderRadius: 3, padding: '2px 5px', whiteSpace: 'nowrap' }}>
              <span className="sr-only">{mark.full}</span><span aria-hidden="true">{mark.chip}</span>
            </span>
          )}
        </span>
        <span style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted }}>{rec(r)}</span>
      </div>
    )
  }

  // One card per wild-card game, higher seed first; the Packers' card wears the gold top rule.
  const card = (label, teams) => {
    const ours = teams.some((t) => t?.id === TEAM_ID)
    return (
      <div key={label + teams[0]?.id} style={{ background: '#fff', border: `1px solid ${theme.rule}`, borderTop: ours ? `3px solid ${theme.gold}` : `1px solid ${theme.rule}`, borderRadius: 6, padding: '9px 12px 4px' }}>
        <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: ours ? theme.goldText : theme.muted, fontWeight: 700, marginBottom: 2 }}>{label}</div>
        {teams.filter(Boolean).map((t, i) => row(t, i === 0))}
      </div>
    )
  }

  // The chase: the next three teams not yet eliminated — and the Packers, wherever they are.
  const chasers = seeds.filter((r) => r.seed > 7 && r.clincher !== 'e')
  const hunt = chasers.filter((r, i) => i < 3 || r.id === TEAM_ID)
  const line = packersLine(seeds, by, final)

  return (
    <Section kicker={final ? 'Regular season final' : 'If the season ended today'} title={final ? `The ${CONFERENCE} playoff field` : `The ${CONFERENCE} playoff picture`}>
      {line && (
        <p style={{ fontFamily: theme.serif, fontSize: narrow ? 15.5 : 17, color: theme.ink, lineHeight: 1.45, margin: '-6px 0 16px', maxWidth: 640, textWrap: 'pretty' }}>{line}</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 10 }}>
        {card('First-round bye', [by(1)])}
        {card('Wild-card round', [by(2), by(7)])}
        {card('Wild-card round', [by(3), by(6)])}
        {card('Wild-card round', [by(4), by(5)])}
      </div>
      {!final && hunt.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 14px', fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 12, lineHeight: 1.5 }}>
          <span style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>In the hunt</span>
          {hunt.map((r) => (
            <span key={r.id} style={{ whiteSpace: 'nowrap' }}>
              <span style={{ color: r.id === TEAM_ID ? theme.green : theme.ink, fontWeight: r.id === TEAM_ID ? 700 : 400 }}>{r.seed}. {r.name}</span> {rec(r)}
            </span>
          ))}
        </div>
      )}
      <div style={{ fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 10 }}>
        Seeds and clinch marks as ESPN posts them, tiebreakers applied. Division winners take seeds 1–4.
      </div>
    </Section>
  )
}
