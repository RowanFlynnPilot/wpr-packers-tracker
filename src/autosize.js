// Iframe auto-resize: when embedded, post the document height to the host page so the iframe can
// fit the active tab exactly (no fixed height, no inner scroll). The host listens for
// { type: 'wpr-packers-height' } and sets the iframe height (see the embed snippet in README).
export function setupAutoResize() {
  if (typeof window === 'undefined' || window.self === window.top) return // only when embedded
  let last = 0
  const post = () => {
    const h = Math.ceil(document.documentElement.scrollHeight)
    if (h && Math.abs(h - last) > 2) {
      last = h
      window.parent.postMessage({ type: 'wpr-packers-height', height: h }, '*')
    }
  }
  // Catch every height change: tab switches, async content loads, image/font reflow, resizes.
  if ('ResizeObserver' in window) new ResizeObserver(post).observe(document.body)
  window.addEventListener('load', post)
  window.addEventListener('resize', post)
  setTimeout(post, 200)
  setTimeout(post, 1200)
}
