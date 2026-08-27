import { el } from '../lib/dom.js'
import { ROUTES } from '../app/router.js'
import { clearOwnerSession } from '../app/owner-auth.js'
import { createLanguageSwitcher } from './language-switcher.js'
import { createMainNav } from './nav.js'
import { createButton } from './button.js'

export function createShell({ i18n, session, router, currentPath, showNav, cinematic = false }) {
  const skip = el('a', {
    className: 'skip-link',
    href: '#main-content',
    textContent: i18n.t('a11y.skipToContent'),
  })

  const participant = session.getParticipant()
  const identityInHeader = Boolean(
    showNav && participant && (session.isOwner() || currentPath !== ROUTES.today),
  )
  const identityItems = []

  if (identityInHeader) {
    identityItems.push(
      el('p', {
        className: 'app-header__greeting',
        textContent: i18n.t('shell.greeting', { name: participant.displayName }),
      }),
    )
    identityItems.push(
      createButton({
        label: i18n.t('shell.changeIdentity'),
        variant: 'ghost',
        className: 'app-header__identity-action',
        onClick: () => {
          clearOwnerSession()
          session.clearIdentity()
          router.navigate(ROUTES.landing)
        },
      }),
    )
  }

  const header = el('header', { className: `app-header${identityInHeader ? '' : ' app-header--lang-only'}` }, [
    el('div', { className: 'app-header__bar' }, [
      el('div', { className: 'app-header__identity' }, identityItems),
      createLanguageSwitcher(i18n),
    ]),
  ])

  const main = el('main', {
    id: 'main-content',
    className: 'app-main',
    tabindex: '-1',
  })

  const nav = showNav
    ? createMainNav({ i18n, router, currentPath, isOwner: session.isOwner() })
    : null

  const root = el(
    'div',
    {
      className: `app-shell${showNav ? ' app-shell--with-nav' : ''}${cinematic ? ' app-shell--cinematic' : ''}`,
    },
    [
    skip,
    header,
    main,
    nav,
  ])

  return { root, main }
}
