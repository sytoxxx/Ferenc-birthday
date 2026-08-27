import { el } from '../lib/dom.js'
import { visibleAppSections } from '../app/router.js'
import { createIcon } from './icons.js'

const ICONS = {
  gift: 'gift',
  today: 'today',
  live: 'live',
  photo: 'photo',
  challenge: 'photo',
  capsule: 'capsule',
}

export function createMainNav({ i18n, router, currentPath, isOwner = false }) {
  const links = visibleAppSections(isOwner).map((section) => {
    const isCurrent = currentPath === section.path

    return el(
      'a',
      {
        href: section.path,
        className: `app-nav__link${isCurrent ? ' is-current' : ''}`,
        'aria-current': isCurrent ? 'page' : undefined,
        'aria-label': i18n.t(section.labelKey),
        onClick: (event) => {
          event.preventDefault()
          router.navigate(section.path)
        },
      },
      [
        createIcon(ICONS[section.id], { size: 22, className: 'app-nav__icon' }),
        el('span', { className: 'app-nav__label', textContent: i18n.t(section.labelKey) }),
      ],
    )
  })

  return el(
    'nav',
    {
      className: 'app-nav',
      'aria-label': i18n.t('a11y.mainNav'),
    },
    [el('div', { className: 'app-nav__inner' }, links)],
  )
}
