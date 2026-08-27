import { el } from '../lib/dom.js'
import { isCapsuleUnlocked, getFileUrl, listContributions } from '../app/contributions.js'
import { createComposer } from '../ui/composer.js'
import { createAudioCard, createMessageCard } from '../ui/memory.js'
import { bindPhotoOpen } from '../ui/photo-viewer.js'
import { loadMergedPhotos } from '../app/photos.js'
import { loadMergedMessages } from '../app/messages.js'
import { loadMergedVoices } from '../app/voices.js'

function newestFirst(items) {
  return [...items].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
}

export function renderTimeCapsule({ i18n, session, router }) {
  const unlocked = isCapsuleUnlocked()
  const locale = i18n.getLocale()
  const localItems = listContributions({ destination: 'capsule' })
  const waiting = el('p', {
    className: 'empty',
    textContent: i18n.t('capsule.waiting', { count: localItems.length }),
  })

  void Promise.all([
    loadMergedPhotos('capsule'),
    loadMergedMessages('capsule'),
    loadMergedVoices('capsule'),
  ]).then(([photos, messages, voices]) => {
    if (!waiting.isConnected) return
    const count = photos.photos.length + messages.messages.length + voices.voices.length || localItems.length
    waiting.textContent = i18n.t('capsule.waiting', { count })
  })

  if (!unlocked) {
    return el('section', { className: 'screen screen--capsule is-locked' }, [
      el('p', { className: 'eyebrow', textContent: i18n.t('capsule.nav') }),
      el('h1', { className: 'section-title', textContent: i18n.t('capsule.lockedTitle') }),
      el('p', { className: 'support', textContent: i18n.t('capsule.lockedBody') }),
      waiting,
      el('p', { className: 'block-title', textContent: i18n.t('capsule.leave') }),
      createComposer({ i18n, session, router, destination: 'capsule', showPrompt: false }),
    ])
  }

  const list = el('div', { className: 'note-list' })

  const renderItems = (items) => {
    list.replaceChildren(
      ...newestFirst(items).map((item) => {
        if (item.type === 'message' || item.text) {
          return createMessageCard({
            name: item.displayName,
            text: item.text,
            createdAt: item.createdAt,
            locale,
          })
        }
        if (item.type === 'voice' || item.duration) {
          return createAudioCard({
            i18n,
            name: item.displayName,
            createdAt: item.createdAt,
            url: item.url || getFileUrl(item.id, item.url),
            duration: item.duration,
            locale,
          })
        }
        const src = item.url || getFileUrl(item.id, item.url)
        const image = bindPhotoOpen(
          el('img', {
            src,
            alt: item.displayName,
            loading: 'lazy',
          }),
          { src, alt: item.displayName || '', i18n },
        )
        return el('figure', { className: 'photo-wall__item' }, [image])
      }),
    )
  }

  renderItems(localItems.map((item) => ({ ...item, type: item.type })))

  void Promise.all([
    loadMergedPhotos('capsule'),
    loadMergedMessages('capsule'),
    loadMergedVoices('capsule'),
  ]).then(([photos, messages, voices]) => {
    if (!list.isConnected) return
    renderItems([
      ...photos.photos.map((item) => ({ ...item, type: 'photo' })),
      ...messages.messages.map((item) => ({ ...item, type: 'message' })),
      ...voices.voices.map((item) => ({ ...item, type: 'voice' })),
    ])
  })

  return el('section', { className: 'screen screen--capsule is-open' }, [
    el('h1', { className: 'section-title', textContent: i18n.t('capsule.opened') }),
    list,
  ])
}
