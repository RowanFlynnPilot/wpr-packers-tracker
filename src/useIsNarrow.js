import { useState, useEffect } from 'react'

// True when the viewport is narrower than `bp` (phones / narrow iframes). Drives responsive
// sizing for the inline-styled layout where CSS media queries can't reach.
export function useIsNarrow(bp = 560) {
  const [narrow, setNarrow] = useState(typeof window !== 'undefined' && window.innerWidth < bp)

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < bp)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [bp])

  return narrow
}
