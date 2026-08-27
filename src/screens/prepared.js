import { el } from '../lib/dom.js'

export function renderPreparedSection({ i18n, titleKey, bodyKey }) {
  return el('section', { className: 'screen screen--prepared' }, [
    el('h1', { className: 'section-title', textContent: i18n.t(titleKey) }),
    el('p', { className: 'prose', textContent: i18n.t(bodyKey) }),
    el('p', { className: 'prepared-note', textContent: i18n.t('section.prepared') }),
  ])
}

export function renderToday({ i18n }) {
  return renderPreparedSection({
    i18n,
    titleKey: 'today.title',
    bodyKey: 'today.body',
  })
}

export function renderLive({ i18n }) {
  return renderPreparedSection({
    i18n,
    titleKey: 'live.title',
    bodyKey: 'live.body',
  })
}

export function renderPhotoOfTheDay({ i18n }) {
  return renderPreparedSection({
    i18n,
    titleKey: 'photo.title',
    bodyKey: 'photo.body',
  })
}

export function renderTimeCapsule({ i18n }) {
  return renderPreparedSection({
    i18n,
    titleKey: 'capsule.title',
    bodyKey: 'capsule.body',
  })
}
