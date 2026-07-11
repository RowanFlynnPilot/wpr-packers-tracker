import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { SEASON, headshot } from '../config.js'
import { fetchSeasonSummaries, fetchRoster } from '../api.js'
import { chunkLeaders } from '../games.js'
import { openPlayerCard } from './PlayerCard.jsx'
import Section from './Section.jsx'

// "Explosive-play leaders" — the season-long chunk-play board: every 20+ yard gain across the
// year's summaries, credited to the runner/receiver (games.js chunkLeaders). One pooled sweep
// of the summaries the film room already caches. Names resolve to the roster for headshots and
// player cards; a player the parse can't place on the roster still shows by play-by-play name.
// Owns its Section; fail-soft — before there's a completed game there's no board.
export default function ChunkLeaders() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ season, entries }, roster] = await Promise.all([fetchSeasonSummaries(), fetchRoster()])
      if (!entries.length) return
      const rows = chunkLeaders(entries).slice(0, 8).map((r) => {
        const p = roster.list.find((x) => x.name.endsWith(r.last) && x.name[0] === r.initial)
        return { ...r, id: p?.id ?? null, display: p?.name || r.name, pos: p?.pos || '' }
      })
      if (alive && rows.length) setData({ season, rows, games: entries.length })
    })().catch(() => {})
    return () => { alive = false }
  }, [])

  if (!data) return null
  const { season, rows, games } = data
  const max = rows[0].plays

  return (
    <Section kicker="Explosives, season-long" title="The chunk-play leaders">
      <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 14px', maxWidth: 620, lineHeight: 1.5 }}>
        Who supplies the 20-plus-yard gains — every explosive across {games} games, credited to
        the runner or receiver.
      </p>
      {rows.map((r, i) => {
        const lead = i === 0
        const clickable = r.id != null
        return (
          <div key={r.name} className={clickable ? 'hover-row' : undefined}
            onClick={clickable ? () => openPlayerCard(r.id) : undefined}
            onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlayerCard(r.id) } } : undefined}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: lead ? '9px 6px' : '7px 6px', borderTop: i ? `1px solid ${theme.rule}` : 'none', cursor: clickable ? 'pointer' : 'default' }}>
            {r.id != null ? (
              <img src={headshot(r.id)} alt="" width={lead ? 40 : 30} height={lead ? 40 : 30}
                style={{ borderRadius: '50%', background: theme.wash, objectFit: 'cover', flexShrink: 0, boxShadow: lead ? `0 0 0 2px ${theme.gold}` : undefined }}
                onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
            ) : (
              <span style={{ width: lead ? 40 : 30, height: lead ? 40 : 30, borderRadius: '50%', background: theme.wash, flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ fontFamily: theme.serif, fontSize: lead ? 16 : 15, fontWeight: lead ? 700 : 400, color: theme.ink }}>{r.display}</span>
                  {r.pos && <span style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted }}> · {r.pos}</span>}
                </span>
                <span style={{ fontFamily: theme.sans, fontSize: lead ? 14 : 12.5, fontWeight: lead ? 700 : 400, color: theme.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {r.plays} {r.plays === 1 ? 'play' : 'plays'}
                </span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: theme.wash, marginTop: 5, overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(2, (r.plays / max) * 100)}%`, height: '100%', borderRadius: 2, background: theme.green }} />
              </div>
              <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 3 }}>
                {r.yards} chunk yds · long {r.longest}{r.tds ? ` · ${r.tds} TD` : ''}
              </div>
            </div>
          </div>
        )
      })}
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 12 }}>
        {season < SEASON ? `Final ${season} — the new season's board starts at Week 1.` : 'Season to date.'}
      </div>
    </Section>
  )
}
