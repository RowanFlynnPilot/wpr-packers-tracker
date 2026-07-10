import { useEffect } from 'react'

// Minimal dialog focus management, shared by the box-score and player-card modals: on open,
// remember the invoker and move focus into the dialog; keep Tab cycling inside it; on close,
// hand focus back. (aria-modal alone hides the page from screen readers but does nothing for
// the keyboard — without this, tabbing keeps walking the page behind the overlay.)
// `active` gates the behavior for hosts that render with the modal closed.
export function useModalFocus(ref, active = true) {
  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return
    const invoker = document.activeElement
    // Queried per keypress, not once — the dialog's contents change as its data loads.
    const focusables = () => [...el.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')]
    focusables()[0]?.focus()
    const onKey = (e) => {
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const i = list.indexOf(document.activeElement)
      if (e.shiftKey && i <= 0) { e.preventDefault(); list[list.length - 1].focus() }
      else if (!e.shiftKey && i === list.length - 1) { e.preventDefault(); list[0].focus() }
    }
    el.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('keydown', onKey)
      if (invoker?.focus) invoker.focus()
    }
  }, [ref, active])
}
