import { el, clear } from '../lib/dom.js'
import { formatClock } from './memory.js'
import { bindPhotoOpen } from './photo-viewer.js'

export function formatPhotoStamp(iso, locale) {
  try {
    const date = new Date(iso)
    const now = new Date()
    const sameDay = date.toDateString() === now.toDateString()
    if (sameDay) return formatClock(iso, locale)
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return formatClock(iso, locale)
  }
}

export function createPhotoFigure(photo, { i18n, locale, isNew = false, entering = false } = {}) {
  const classes = ['photo-wall__item']
  if (entering) classes.push('is-entering')
  const alt = photo.displayName || i18n.t('photo.preview')
  const image = photo.url
    ? bindPhotoOpen(
        el('img', {
          src: photo.url,
          alt,
          loading: 'lazy',
        }),
        { src: photo.url, alt, i18n },
      )
    : el('div', { className: 'empty-state', style: { minHeight: '8rem' } })

  return el('figure', { className: classes.join(' '), dataset: { photoId: photo.id } }, [
    image,
    isNew ? el('span', { className: 'photo-wall__badge', textContent: i18n.t('photo.neu') }) : null,
    el('figcaption', { className: 'photo-wall__caption' }, [
      el('span', { className: 'photo-wall__name', textContent: photo.displayName || '' }),
      el('span', {
        className: 'photo-wall__time',
        textContent: formatPhotoStamp(photo.createdAt, locale),
      }),
    ]),
  ])
}

export function createPhotoEmpty(i18n) {
  return el('div', { className: 'empty-state' }, [
    el('p', { className: 'empty-state__text', textContent: i18n.t('today.emptyPhotos') }),
  ])
}

export function renderPhotoWall(host, photos, { i18n, locale, newestIsNew = false } = {}) {
  clear(host)
  if (!photos.length) {
    host.append(createPhotoEmpty(i18n))
    return host
  }

  const wall = el(
    'div',
    { className: 'photo-wall' },
    photos.map((photo, index) =>
      createPhotoFigure(photo, {
        i18n,
        locale,
        isNew: newestIsNew && index === 0,
      }),
    ),
  )
  host.append(wall)
  return host
}

export function prependPhoto(host, photo, { i18n, locale } = {}) {
  let wall = host.querySelector('.photo-wall')
  if (!wall) {
    clear(host)
    wall = el('div', { className: 'photo-wall' })
    host.append(wall)
  }

  const key = photo.filePath || photo.id
  const duplicate = [...wall.children].some((node) => {
    const id = node.dataset?.photoId
    return id && (id === photo.id || id === key)
  })
  if (duplicate) return

  wall.prepend(createPhotoFigure(photo, { i18n, locale, isNew: true, entering: true }))
}
