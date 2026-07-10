import { teamLogo } from '../config.js'

// Small team mark from ESPN's CDN. One responsibility: render a logo that
// hides itself if the image fails to load (so a missing mark never breaks a layout).
export default function TeamLogo({ id, size = 22 }) {
  return (
    <img
      src={teamLogo(id)}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain', flexShrink: 0 }}
      onError={(e) => { e.currentTarget.style.display = 'none' }}
    />
  )
}
