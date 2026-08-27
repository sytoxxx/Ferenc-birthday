import { el } from '../lib/dom.js'
import { lockPageScroll, unlockPageScroll } from './sheet.js'
import { createButton } from './button.js'

let viewer = null
let onKey = null

export function closePhotoViewer() {
  if (!viewer) return
  if (onKey) {
    document.removeEventListener('keydown', onKey)
    onKey = null
  }
  viewer.remove()
  viewer = null
  unlockPageScroll()
}

export function openPhotoViewer({ src, alt = '', i18n }) {
  if (!src) return
  closePhotoViewer()
  lockPageScroll()

  const image = el('img', {
    className: 'photo-viewer__image',
    src,
    alt,
    draggable: false,
  })
  image.addEventListener('click', (event) => event.stopPropagation())

  const closeButton = createButton({
    label: '×',
    variant: 'ghost',
    className: 'photo-viewer__close',
    ariaLabel: i18n?.t?.('a11y.close') || 'Close',
    onClick: closePhotoViewer,
  })

  const overlay = el('div', { className: 'photo-viewer', role: 'dialog', 'aria-modal': 'true' }, [
    closeButton,
    image,
  ])

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closePhotoViewer()
  })

  onKey = (event) => {
    if (event.key === 'Escape') closePhotoViewer()
  }
  document.addEventListener('keydown', onKey)

  document.body.append(overlay)
  viewer = overlay
  requestAnimationFrame(() => overlay.classList.add('is-open'))
  overlay.tabIndex = -1
  overlay.focus()
}

export function bindPhotoOpen(node, { src, alt, i18n }) {
  if (!node || !src) return node
  node.classList.add('is-zoomable')
  node.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    openPhotoViewer({ src, alt, i18n })
  })
  return node
}
