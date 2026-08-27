import { el } from '../lib/dom.js'
import { SUPPORTED_LOCALES } from '../i18n/index.js'

export function createLanguageSwitcher(i18n) {
  const current = i18n.getLocale()

  const buttons = SUPPORTED_LOCALES.map((locale, index) => {
    const isActive = locale === current
    const button = el('button', {
      type: 'button',
      className: `lang-switcher__option${isActive ? ' is-active' : ''}`,
      textContent: i18n.t(`lang.${locale}`),
      'aria-pressed': isActive ? 'true' : 'false',
      'aria-current': isActive ? 'true' : undefined,
      onClick: () => i18n.setLocale(locale),
    })

    if (index < SUPPORTED_LOCALES.length - 1) {
      return [button, el('span', { className: 'lang-switcher__divider', 'aria-hidden': 'true', textContent: '|' })]
    }

    return button
  }).flat()

  return el(
    'div',
    {
      className: 'lang-switcher',
      role: 'group',
      'aria-label': i18n.t('lang.groupLabel'),
    },
    buttons,
  )
}
