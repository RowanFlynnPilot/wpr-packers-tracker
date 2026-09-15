import { useEffect, useRef } from 'react'

// Minimal dialog focus management, shared by the box-score and player-card modals: on open,
// remember the invoker and move focus into the dialog; keep Tab cycling inside it; Escape
// calls `onClose`; on close, hand focus back. (aria-modal alone hides the page from screen
// readers but does nothing for the keyboard — without this, tabbing keeps walking the page
// behind the overlay.) `active` gates the behavior for hosts that render with the modal closed.
//
// Dialogs can stack — a box-score name opens the player card over the box score — so open
// dialogs sit on a module-level stack and only the TOP one answers Tab and Escape. Without
// that, both traps fight over focus on every Tab, and one Escape closes both dialogs. Closing
// the card pops it and returns focus to the name that opened it, inside the box score.
const stack = []

export function useModalFocus(ref, active = true, onClose) {
  // Held in a ref: callers pass inline closures, and re-running the effect on every render
  // would re-grab focus and re-stack the dialog.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return
    const invoker = document.activeElement
    const entry = {}
    stack.push(entry)
    // Queried per keypress, not once — the dialog's contents change as its data loads.
    const focusables = () => [...el.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')]
    focusables()[0]?.focus()
    // The listener lives on document, not the dialog: when loading content swaps to loaded
    // content the focused element can unmount (focus falls to <body>), and a dialog-scoped
    // listener would never see the next Tab — the trap has to recapture from anywhere.
    const onKey = (e) => {
      if (stack[stack.length - 1] !== entry) return
      if (e.key === 'Escape') {
        if (closeRef.current) { e.preventDefault(); closeRef.current() }
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      if (!el.contains(document.activeElement)) {
        e.preventDefault()
        ;(e.shiftKey ? list[list.length - 1] : list[0]).focus()
        return
      }
      const i = list.indexOf(document.activeElement)
      if (e.shiftKey && i <= 0) { e.preventDefault(); list[list.length - 1].focus() }
      else if (!e.shiftKey && i === list.length - 1) { e.preventDefault(); list[0].focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(entry), 1)
      if (invoker?.focus) invoker.focus()
    }
  }, [ref, active])
}
