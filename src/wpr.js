// Wausau Pilot & Review's own Packers coverage, via the WordPress REST API. Third external API,
// same rules as the ESPN + weather clients: browser fetch, keyless, CORS-open, fail fast (the
// section renders nothing on failure). No caching, no scraper — this is a live read of WPR's CMS.
import { WPR_NEWS } from './config.js'

// WP returns rendered HTML with entities (won&#8217;t) and <p> wrappers. Strip tags, decode
// entities via the DOM, collapse whitespace. Browser-only (this client never runs server-side).
function clean(html) {
  const el = document.createElement('textarea')
  el.innerHTML = (html || '').replace(/<[^>]+>/g, '')
  return el.value.replace(/\s+/g, ' ').trim()
}

function truncate(text, max) {
  if (text.length <= max) return text
  return text.slice(0, max).replace(/\s+\S*$/, '').trimEnd() + '…'
}

// Smallest decent featured image: the embedded medium thumbnail, then any embedded size, then
// the Jetpack full image. Null when a post has no featured image.
function image(post) {
  const media = post._embedded?.['wp:featuredmedia']?.[0]
  const sizes = media?.media_details?.sizes
  return (
    sizes?.medium?.source_url ||
    sizes?.medium_large?.source_url ||
    media?.source_url ||
    post.jetpack_featured_media_url ||
    null
  )
}

// Recent Packers articles, newest first. `_fields` trims the payload (no full article body);
// `_embed` carries the featured-media thumbnail.
export async function fetchPackersCoverage(limit = 4) {
  if (!WPR_NEWS) return []
  const fields = 'date,link,title,excerpt,jetpack_featured_media_url,_links,_embedded'
  const url =
    `${WPR_NEWS.base}/posts?categories=${WPR_NEWS.categoryId}` +
    `&orderby=date&order=desc&per_page=${limit}&_embed=wp:featuredmedia&_fields=${fields}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`WPR REST ${res.status}`)
  const posts = await res.json()
  return posts.map((p) => ({
    date: p.date,
    link: p.link,
    title: clean(p.title?.rendered),
    excerpt: truncate(clean(p.excerpt?.rendered), 140),
    image: image(p),
  }))
}
