import { el } from '../lib/dom.js'
import { ROUTES } from '../app/router.js'
import { createButton } from '../ui/button.js'

export function renderNotFound({ i18n, router }) {
  return el('section', { className: 'screen screen--prepared' }, [
    el('h1', { className: 'section-title', textContent: i18n.t('notFound.title') }),
    el('p', { className: 'prose', textContent: i18n.t('notFound.body') }),
    createButton({
      label: i18n.t('notFound.home'),
      variant: 'primary',
      onClick: () => router.navigate(ROUTES.landing),
    }),
  ])
}
