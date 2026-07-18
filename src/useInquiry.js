import { useState } from 'react'
import { SPONSOR_INQUIRY } from './config.js'
import { track } from './analytics.js'

// mailto: with a safety net. Plenty of desks have no mail-app handler, so a mailto click
// looks like nothing happened — every inquiry click therefore ALSO copies the address and
// the caller shows a "copied" confirmation, so the prospect always walks away holding it.
// The mailto itself still opens the compose sheet wherever one exists (phones, Outlook
// desktops), and the Sponsor Inquiry event fires either way.
export function useInquiry(slot) {
  const [copied, setCopied] = useState(false)
  const onClick = () => {
    track('Sponsor Inquiry', { slot })
    try {
      navigator.clipboard?.writeText(SPONSOR_INQUIRY)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 4000)
        })
        .catch(() => {})
    } catch { /* no clipboard access — the mailto is still doing its best */ }
  }
  return { onClick, copied }
}
