// Service worker for the Packers tracker PWA. Network-first for HTML (a reader always gets the
// current build; the cached copy is the offline shell), cache-first for the hashed assets
// (immutable, so instant repeat loads). ESPN API requests are NOT cached — they must stay live.
// __BUILD__ is stamped with the deploy SHA in CI, so each release activates under a new cache
// name and the activate handler below evicts the previous release's assets.
// Why HTML isn't cache-first: a stale index.html points at the PREVIOUS build's hashed files,
// and once the new worker evicts that cache a late lazy chunk load (the race chart) 404s —
// the reader sees the error boundary after every code deploy.
const CACHE = 'packers-tracker-__BUILD__'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // leave the ESPN API (and all cross-origin) untouched

  const isHtml = req.mode === 'navigate' || req.destination === 'document' || /\.html$|\/$/.test(url.pathname)
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req)
      const network = fetch(req)
        .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res })
        .catch(() => cached)
      return isHtml ? network : (cached || network)
    })
  )
})
