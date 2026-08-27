import { el } from '../lib/dom.js'
import { createIcon } from './icons.js'

export function formatClock(iso, locale) {
  try {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  } catch {
    return ''
  }
}

export function createAudioCard({ i18n, name, createdAt, url, duration, locale }) {
  const audio = el('audio', { src: url || '', preload: 'metadata' })
  const play = el('button', {
    type: 'button',
    className: 'audio-card__play',
    'aria-label': i18n.t('a11y.play'),
  })
  play.append(createIcon('play', { size: 18 }))

  const toggle = () => {
    if (!url) return
    if (audio.paused) {
      audio.play()
      play.replaceChildren(createIcon('pause', { size: 18 }))
      play.setAttribute('aria-label', i18n.t('a11y.pause'))
    } else {
      audio.pause()
      play.replaceChildren(createIcon('play', { size: 18 }))
      play.setAttribute('aria-label', i18n.t('a11y.play'))
    }
  }

  play.addEventListener('click', toggle)
  audio.addEventListener('ended', () => {
    play.replaceChildren(createIcon('play', { size: 18 }))
    play.setAttribute('aria-label', i18n.t('a11y.play'))
  })

  return el('article', { className: 'note-card audio-card' }, [
    audio,
    play,
    el('div', { className: 'note-card__body' }, [
      el('p', { className: 'note-card__name', textContent: name }),
      el('p', {
        className: 'note-card__meta',
        textContent: `${formatClock(createdAt, locale)}${duration ? ` · ${duration}s` : ''}`,
      }),
    ]),
  ])
}

export function createMessageCard({ id, name, text, createdAt, locale, entering = false }) {
  const classes = ['note-card']
  if (entering) classes.push('is-entering')

  return el(
    'article',
    {
      className: classes.join(' '),
      dataset: id ? { messageId: String(id) } : undefined,
    },
    [
      el('p', { className: 'note-card__name', textContent: name }),
      el('p', { className: 'note-card__text', textContent: text }),
      el('p', { className: 'note-card__meta', textContent: formatClock(createdAt, locale) }),
    ],
  )
}

export function createTimeline({ i18n, items, locale }) {
  if (!items.length) return null

  return el(
    'ol',
    { className: 'timeline' },
    items.map((item) => {
      const labelKey =
        item.type === 'photo'
          ? 'timeline.photoAdded'
          : item.type === 'voice'
            ? 'timeline.voiceMessage'
            : 'timeline.newMessage'
      return el('li', { className: 'timeline__item' }, [
        el('span', { className: 'timeline__time', textContent: formatClock(item.createdAt, locale) }),
        el('span', { className: 'timeline__label', textContent: i18n.t(labelKey) }),
      ])
    }),
  )
}
