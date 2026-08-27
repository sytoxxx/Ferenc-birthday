import { el } from '../lib/dom.js'

const ICONS = {
  gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H8a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7m0 0h4a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7',
  today: 'M8 3v3M16 3v3M4 11h16M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  live: 'M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0M12 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1',
  photo: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zm8 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  capsule: 'M8 4h8l1 4H7zm-1 4h10v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM12 12v5M10 17h4',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zm8 3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  message: 'M5 6h14v10H8l-3 3z',
  mic: 'M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3zm6 8a6 6 0 0 1-12 0M12 18v3',
  heart: 'M12 19S5 14 5 9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 1.5C19 14 12 19 12 19z',
  party: 'M12 4v4M8 6l2 3M16 6l-2 3M7 14a5 5 0 0 0 10 0',
  cheers: 'M8 5h3v7a2.5 2.5 0 0 1-5 0zm8 0h3v7a2.5 2.5 0 0 1-5 0zM6 20h12',
  laugh: 'M7 10h.01M17 10h.01M8 14s1.8 3 4 3 4-3 4-3M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  play: 'M8 6v12l10-6z',
  pause: 'M8 6h3v12H8zm5 0h3v12h-3z',
  close: 'M7 7l10 10M17 7L7 17',
}

export function createIcon(name, { size = 22, className = 'icon' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.7')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('class', className)

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', ICONS[name] || ICONS.gift)
  svg.append(path)
  return svg
}

export function createBrandKicker(i18n, className = 'eyebrow') {
  return el('p', {
    className,
    textContent: `${i18n.t('brand.name')} · ${i18n.t('brand.age')}`,
  })
}
