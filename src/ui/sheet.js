import { el } from '../lib/dom.js'
import { createLocalId } from '../lib/id.js'
import { createButton } from './button.js'

let openCount = 0

export function lockPageScroll() {
  if (openCount === 0) {
    document.documentElement.classList.add('is-sheet-open')
  }
  openCount += 1
}

export function unlockPageScroll() {
  openCount = Math.max(0, openCount - 1)
  if (openCount === 0) {
    document.documentElement.classList.remove('is-sheet-open')
  }
}

export function closeAllSheets() {
  document.querySelectorAll('.sheet').forEach((node) => node.remove())
  openCount = 0
  document.documentElement.classList.remove('is-sheet-open')
}

/**
 * Viewport-fixed bottom sheet. Always mounted on document.body so a
 * transformed ancestor (page animation) cannot pin it below the fold.
 */
export function openSheet({ title, onClose, i18n, children }) {
  const titleId = `sheet-title-${createLocalId()}`
  let closed = false

  const close = () => {
    if (closed) return
    closed = true
    overlay.remove()
    unlockPageScroll()
    if (typeof onClose === 'function') onClose()
  }

  const overlay = el('div', { className: 'sheet', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { className: 'sheet__panel' }, [
      el('div', { className: 'sheet__head' }, [
        el('h2', { className: 'sheet__title', id: titleId, textContent: title }),
        createButton({
          label: i18n.t('contribute.close'),
          variant: 'ghost',
          ariaLabel: i18n.t('a11y.close'),
          onClick: close,
        }),
      ]),
      el('div', { className: 'sheet__body' }, children),
    ]),
  ])

  overlay.setAttribute('aria-labelledby', titleId)
  overlay.tabIndex = -1
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close()
  })
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close()
  })
  overlay.addEventListener(
    'touchmove',
    (event) => {
      if (event.target === overlay) event.preventDefault()
    },
    { passive: false },
  )

  lockPageScroll()
  document.body.append(overlay)
  requestAnimationFrame(() => overlay.classList.add('is-open'))

  window.setTimeout(() => {
    const field = overlay.querySelector('textarea, input:not([type="file"]):not([type="checkbox"])')
    ;(field || overlay).focus()
  }, 40)

  return { overlay, close }
}
