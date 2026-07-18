import { teamLogo } from '../config.js'

// Small team mark from ESPN's CDN. One responsibility: render a logo that
// hides itself if the image fails to load (so a missing mark never breaks a layout).
// Lazy by default — list surfaces render dozens of these — the hero passes eager
// because its logos are the page's visual centerpiece.
export default function TeamLogo({ id, size = 22, loading = 'lazy' }) {
  return (
    <img
      src={teamLogo(id)}
      alt=""
      width={size}
      height={size}
      loading={loading}
      decoding="async"
      style={{ objectFit: 'contain', flexShrink: 0 }}
      onError={(e) => { e.currentTarget.style.display = 'none' }}
    />
  )
}
