import { el, clear } from '../lib/dom.js'
import { ROUTES } from '../app/router.js'
import { loadMergedPhotos, listLocalPhotos, subscribePhotoInserts } from '../app/photos.js'
import { loadMergedMessages, listLocalMessages, subscribeMessageInserts } from '../app/messages.js'
import { loadMergedVoices, listLocalVoices, subscribeVoiceInserts } from '../app/voices.js'
import { createComposer } from '../ui/composer.js'
import { createAudioCard, createMessageCard, createTimeline } from '../ui/memory.js'
import { prependPhoto, renderPhotoWall } from '../ui/photo-wall.js'
import { createButton } from '../ui/button.js'

function newestFirst(items) {
  return [...items].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
}

function renderMessageList(host, messages, { i18n, locale }) {
  clear(host)
  if (!messages.length) {
    host.append(el('p', { className: 'empty', textContent: i18n.t('today.emptyMessages') }))
    return
  }

  host.append(
    el(
      'div',
      { className: 'note-list' },
      newestFirst(messages).map((item) =>
        createMessageCard({
          id: item.id,
          name: item.displayName,
          text: item.text,
          createdAt: item.createdAt,
          locale,
        }),
      ),
    ),
  )
}

function prependMessageCard(host, message, { locale }) {
  let list = host.querySelector('.note-list')
  if (!list) {
    clear(host)
    list = el('div', { className: 'note-list' })
    host.append(list)
  }
  const duplicate = [...list.children].some((node) => node.dataset?.messageId === String(message.id))
  if (duplicate) return
  list.prepend(
    createMessageCard({
      id: message.id,
      name: message.displayName,
      text: message.text,
      createdAt: message.createdAt,
      locale,
      entering: true,
    }),
  )
}

function renderVoiceList(host, voices, { i18n, locale }) {
  clear(host)
  if (!voices.length) {
    host.append(el('p', { className: 'empty', textContent: i18n.t('today.emptyVoices') }))
    return
  }
  host.append(
    el(
      'div',
      { className: 'note-list' },
      newestFirst(voices).map((item) =>
        createAudioCard({
          i18n,
          name: item.displayName,
          createdAt: item.createdAt,
          url: item.url,
          duration: item.duration,
          locale,
        }),
      ),
    ),
  )
}

export function renderToday({ i18n, session, router }) {
  const locale = i18n.getLocale()
  const participant = session.getParticipant()
  const isOwner = session.isOwner()
  const seenPhotos = new Set()
  const seenMessages = new Set()
  const seenVoices = new Set()
  let photos = listLocalPhotos('today')
  let messages = listLocalMessages('today')
  let voices = listLocalVoices('today')

  const photoHost = el('div', { className: 'today-photos' })
  const messageHost = el('div', { className: 'today-messages' })
  const voiceHost = el('div', { className: 'today-voices' })
  const timelineHost = el('div', { className: 'today-timeline' })

  photos.forEach((photo) => {
    seenPhotos.add(photo.id)
    if (photo.filePath) seenPhotos.add(photo.filePath)
  })
  messages.forEach((message) => seenMessages.add(message.id))
  voices.forEach((voice) => seenVoices.add(voice.id))

  const refreshTimeline = () => {
    const items = newestFirst([
      ...photos.map((item) => ({ ...item, type: 'photo' })),
      ...messages.map((item) => ({ ...item, type: 'message' })),
      ...voices.map((item) => ({ ...item, type: 'voice' })),
    ])
    clear(timelineHost)
    if (!items.length) {
      timelineHost.append(el('p', { className: 'empty', textContent: i18n.t('today.emptyTimeline') }))
      return
    }
    timelineHost.append(createTimeline({ i18n, items, locale }))
  }

  renderPhotoWall(photoHost, photos, { i18n, locale })
  renderMessageList(messageHost, messages, { i18n, locale })
  renderVoiceList(voiceHost, voices, { i18n, locale })
  refreshTimeline()

  const addPhoto = (photo) => {
    if (!photoHost.isConnected) return
    if ((photo.destination || 'today') !== 'today') return
    const keys = [photo.id, photo.filePath].filter(Boolean)
    if (keys.some((key) => seenPhotos.has(key))) return
    keys.forEach((key) => seenPhotos.add(key))
    photos = [photo, ...photos]
    prependPhoto(photoHost, photo, { i18n, locale })
    refreshTimeline()
  }

  const addMessage = (message) => {
    if (!messageHost.isConnected) return
    if ((message.destination || 'today') !== 'today') return
    if (!message.id || seenMessages.has(message.id)) return
    seenMessages.add(message.id)
    messages = [message, ...messages]
    prependMessageCard(messageHost, message, { locale })
    refreshTimeline()
  }

  const addVoice = (voice) => {
    if (!voiceHost.isConnected) return
    if ((voice.destination || 'today') !== 'today') return
    if (!voice.id || seenVoices.has(voice.id)) return
    seenVoices.add(voice.id)
    voices = [voice, ...voices]
    renderVoiceList(voiceHost, voices, { i18n, locale })
    refreshTimeline()
  }

  void loadMergedPhotos('today').then(({ photos: next }) => {
    if (!photoHost.isConnected) return
    photos = next
    next.forEach((photo) => {
      seenPhotos.add(photo.id)
      if (photo.filePath) seenPhotos.add(photo.filePath)
    })
    renderPhotoWall(photoHost, photos, { i18n, locale })
    refreshTimeline()
  })

  void loadMergedMessages('today').then(({ messages: next }) => {
    if (!messageHost.isConnected) return
    messages = next
    next.forEach((message) => seenMessages.add(message.id))
    renderMessageList(messageHost, messages, { i18n, locale })
    refreshTimeline()
  })

  void loadMergedVoices('today').then(({ voices: next }) => {
    if (!voiceHost.isConnected) return
    voices = next
    next.forEach((voice) => seenVoices.add(voice.id))
    renderVoiceList(voiceHost, voices, { i18n, locale })
    refreshTimeline()
  })

  subscribePhotoInserts(addPhoto)
  subscribeMessageInserts(addMessage)
  subscribeVoiceInserts(addVoice)

  const changeIdentity = () => {
    session.clearIdentity()
    router.navigate(ROUTES.landing)
  }

  const homeHead = isOwner
    ? [el('h1', { className: 'section-title', textContent: i18n.t('today.title') })]
    : [
        el('div', { className: 'home-identity' }, [
          el('p', {
            className: 'home-hello',
            textContent: i18n.t('contribute.hello', { name: participant?.displayName || '' }),
          }),
          createButton({
            label: i18n.t('shell.changeIdentity'),
            variant: 'ghost',
            className: 'home-identity__switch',
            onClick: changeIdentity,
          }),
        ]),
        el('h1', { className: 'home-prompt', textContent: i18n.t('contribute.prompt') }),
        createComposer({
          i18n,
          session,
          destination: 'today',
          showPrompt: false,
          showReactions: true,
          onPhotoAdded: addPhoto,
          onMessageAdded: addMessage,
          onVoiceAdded: addVoice,
        }),
      ]

  return el('section', { className: `screen screen--today${isOwner ? '' : ' screen--home'}` }, [
    ...homeHead,
    el('div', { className: 'today-feed' }, [
      el('h2', { className: 'block-title', textContent: i18n.t('today.photos') }),
      photoHost,
      el('h2', { className: 'block-title', textContent: i18n.t('today.messages') }),
      messageHost,
      el('h2', { className: 'block-title', textContent: i18n.t('today.voices') }),
      voiceHost,
      el('h2', { className: 'block-title', textContent: i18n.t('today.timeline') }),
      timelineHost,
    ]),
  ])
}
