import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { WPR_NEWS } from '../config.js'
import { fetchPackersCoverage } from '../wpr.js'
import { track } from '../analytics.js'
import { Loading } from './Status.jsx'
import { useIsNarrow } from '../useIsNarrow.js'
import Section from './Section.jsx'

// "From the newsroom" — WPR's own recent Packers coverage, fetched live from their WordPress
// REST API. Self-contained and fail-soft: it owns its Section chrome, so on error/empty the
// heading disappears along with the content (no orphaned "From the newsroom" title). The per-card
// links use target=_top so a tap navigates the hosting page to the article — driving readers into
// WPR's coverage. Deferred until the section nears the viewport so it never competes with the live feeds.
export default function Coverage() {
  const ref = useRef(null)
  const [armed, setArmed] = useState(false)
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState(false)
  const narrow = useIsNarrow()

  useEffect(() => {
    if (armed || !ref.current) return
    const el = ref.current
    let io
    const t = setTimeout(() => {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { setArmed(true); io.disconnect() }
      }, { rootMargin: '300px' })
      io.observe(el)
    }, 800)
    return () => { clearTimeout(t); if (io) io.disconnect() }
  }, [armed])

  useEffect(() => {
    if (!armed) return
    fetchPackersCoverage(4).then(setPosts).catch(() => setError(true))
  }, [armed])

  const wrap = (children) => <Section kicker="From the newsroom" title="WPR Packers coverage">{children}</Section>

  if (error) return null
  if (!posts) return wrap(<div ref={ref}><Loading lines={2} /></div>)
  if (!posts.length) return null

  const date = (iso) => {
    const d = new Date(iso)
    const opts = d.getFullYear() === new Date().getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
    return d.toLocaleDateString('en-US', opts)
  }

  return wrap(
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {posts.map((p) => (
          <a
            key={p.link}
            href={p.link}
            target="_top"
            className="card-hover"
            onClick={() => track('Coverage Click', { title: p.title })}
            style={{ display: 'flex', flexDirection: 'column', textDecoration: 'none', border: `1px solid ${theme.rule}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}
          >
            {p.image && (
              <div style={{ aspectRatio: '3 / 2', background: theme.wash, overflow: 'hidden' }}>
                <img src={p.image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }} />
              </div>
            )}
            <div style={{ padding: '11px 13px 13px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.goldText, fontWeight: 700 }}>{date(p.date)}</div>
              <div style={{ fontFamily: theme.serif, fontSize: 16, lineHeight: 1.22, color: theme.ink }}>{p.title}</div>
              <div style={{ fontFamily: theme.sans, fontSize: 12, lineHeight: 1.5, color: theme.muted }}>{p.excerpt}</div>
            </div>
          </a>
        ))}
      </div>
      {WPR_NEWS?.archive && (
        <div style={{ marginTop: 16 }}>
          <a href={WPR_NEWS.archive} target="_top" className="link-hover" onClick={() => track('Coverage Click', { title: 'archive' })}
            style={{ fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: theme.green, textDecoration: 'none' }}>
            More Packers coverage at Wausau Pilot &amp; Review {'→'}
          </a>
        </div>
      )}
    </div>
  )
}
