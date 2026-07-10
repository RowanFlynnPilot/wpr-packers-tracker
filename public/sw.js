// Service worker for the Packers tracker PWA. Stale-while-revalidate for our own app assets
// (instant repeat loads + offline shell). ESPN API requests are NOT cached — they must stay live.
// __BUILD__ is stamped with the deploy SHA in CI, so each release activates under a new cache
// name and the activate handler below evicts the previous release's assets.
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

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req)
      const network = fetch(req)
        .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res })
        .catch(() => cached)
      return cached || network
    })
  )
})
