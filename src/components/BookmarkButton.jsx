import { useState, useEffect, useRef } from 'react'
import { theme } from '../theme.js'
import { SITE_URL, WPR_NEWS } from '../config.js'
import { track } from '../analytics.js'

// Stickiness nudge: "bookmark this page so you come back." No browser exposes a programmatic
// add-bookmark API, so the honest path is showing the OS-correct shortcut — and because the tool
// runs in an iframe, Ctrl/⌘ + D bookmarks the *host WPR page*, exactly what we want. Phones have no
// such shortcut, so a one-tap "copy link" (the canonical WPR Packers page) is the reliable path
// there. Pure client UI; every branch fails soft.

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '')
const isTouch = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches

// The URL a bookmark/copy should point at: the dedicated WPR Packers page when embedded (so
// readers land back on the news site, not the bare iframe), else the standalone tracker.
function bookmarkUrl() {
  if (typeof window === 'undefined') return SITE_URL
  if (window.self === window.top) return window.location.href
  return (WPR_NEWS && WPR_NEWS.archive) || document.referrer || SITE_URL
}

const Key = ({ children }) => (
  <kbd style={{ fontFamily: theme.sans, fontSize: 11, fontWeight: 700, color: theme.green, background: theme.wash, border: `1px solid ${theme.rule}`, borderRadius: 4, padding: '2px 6px', margin: '0 2px', boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>{children}</kbd>
)

export default function BookmarkButton() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const wrap = useRef(null)

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) track('Bookmark')
  }

  const copy = () => {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(bookmarkUrl()).then(() => {
      setCopied(true)
      track('Bookmark', { action: 'copy' })
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div ref={wrap} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={toggle} aria-expanded={open} aria-label="Bookmark this page" style={{
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent',
        border: `1px solid ${theme.rule}`, borderRadius: 999, padding: '5px 12px',
        fontFamily: theme.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: theme.green,
      }}>
        <span style={{ color: theme.goldText, fontSize: 12, lineHeight: 1 }}>★</span> Bookmark
      </button>

      {open && (
        <div role="dialog" aria-label="Bookmark this page" style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 250,
          background: theme.paper, border: `1px solid ${theme.rule}`, borderRadius: 10,
          boxShadow: '0 10px 30px rgba(32,55,49,0.18)', padding: '14px 16px',
        }}>
          <div style={{ fontFamily: theme.serif, fontSize: 16, color: theme.ink, marginBottom: 5 }}>Keep the Packers handy</div>
          <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, lineHeight: 1.5 }}>
            {isTouch
              ? <>Open your browser menu and tap <strong style={{ color: theme.ink }}>Add Bookmark</strong> (or Add to Home Screen) to check back anytime.</>
              : <>Press <Key>{isMac ? '⌘' : 'Ctrl'}</Key> + <Key>D</Key> to save this page and check back anytime.</>}
          </div>
          <button onClick={copy} style={{
            marginTop: 12, width: '100%', cursor: 'pointer',
            background: copied ? theme.green : 'transparent', color: copied ? '#fff' : theme.green,
            border: `1px solid ${copied ? theme.green : theme.rule}`, borderRadius: 7, padding: '8px 10px',
            fontFamily: theme.sans, fontSize: 12, fontWeight: 700, letterSpacing: '0.03em', transition: 'background 0.15s, color 0.15s',
          }}>
            {copied ? '✓ Link copied' : 'Copy link'}
          </button>
        </div>
      )}
    </div>
  )
}
