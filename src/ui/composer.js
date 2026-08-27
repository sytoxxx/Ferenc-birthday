import { el } from '../lib/dom.js'
import { APP_CONFIG } from '../app/config.js'
import { uploadPhoto } from '../app/photos.js'
import { sendMessage } from '../app/messages.js'
import { uploadVoice } from '../app/voices.js'
import { syncParticipantToSupabase } from '../app/participant.js'
import { getMicrophoneSupport, startVoiceRecording, validatePhotoFile } from '../lib/media.js'
import { announce, createLiveRegion } from '../lib/errors.js'
import { createButton } from './button.js'
import { createIcon } from './icons.js'
import { createReactionBar } from './reactions.js'
import { openSheet } from './sheet.js'

function createStatus() {
  const region = createLiveRegion({ polite: true })
  region.classList.add('composer-status')
  return region
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function photoUploadFailed(result) {
  if (!result) return true
  if (result.ok === false) return true
  if (result.remote) return false
  return result.code !== 'localDestination'
}

function photoErrorCopy(i18n, result) {
  if (isOffline() || result?.code === 'notConfigured') {
    return i18n.t('errors.connection')
  }
  return i18n.t('photo.failed')
}

function messageErrorCopy(i18n, result) {
  if (isOffline() || result?.code === 'notConfigured') {
    return i18n.t('errors.connection')
  }
  if (result?.code === 'failed') return i18n.t('message.failed')
  if (result?.code === 'localDestination') return i18n.t('message.savedLocally')
  if (result?.code) return i18n.t(`message.${result.code}`)
  return i18n.t('message.failed')
}

function openPhotoSheet({ i18n, session, destination, withFerencDefault = false, onDone, onPhotoAdded }) {
  const status = createStatus()
  const preview = el('img', {
    className: 'media-preview',
    alt: i18n.t('photo.preview'),
  })
  const previewFrame = el('div', { className: 'media-preview-frame', hidden: true }, [preview])
  let selectedFile = null
  let previewUrl = ''
  let sending = false
  let closer = { close: () => {} }

  const cameraInput = el('input', {
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/*',
    capture: 'environment',
    className: 'visually-hidden',
  })
  const uploadInput = el('input', {
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/*',
    className: 'visually-hidden',
  })

  const withFerenc = el('input', {
    type: 'checkbox',
    className: 'field-check__input',
    id: 'photo-with-ferenc',
  })
  withFerenc.checked = Boolean(withFerencDefault)
  const withFerencRow =
    destination === 'today'
      ? el('label', { className: 'field-check', htmlFor: 'photo-with-ferenc' }, [
          withFerenc,
          el('span', { textContent: i18n.t('challenge.mark') }),
        ])
      : null

  const cameraButton = createButton({
    label: i18n.t('photo.make'),
    ariaLabel: i18n.t('a11y.camera'),
    children: [createIcon('camera', { size: 18 }), el('span', { textContent: i18n.t('photo.make') })],
    onClick: () => cameraInput.click(),
  })
  const uploadButton = createButton({
    label: i18n.t('photo.upload'),
    variant: 'choice',
    ariaLabel: i18n.t('a11y.upload'),
    children: [createIcon('photo', { size: 18 }), el('span', { textContent: i18n.t('photo.upload') })],
    onClick: () => uploadInput.click(),
  })
  const chooseRow = el('div', { className: 'sheet-actions' }, [cameraButton, uploadButton])

  const setPreview = (file) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    selectedFile = file
    previewUrl = URL.createObjectURL(file)
    preview.src = previewUrl
    previewFrame.hidden = false
    chooseRow.hidden = true
    actionRow.hidden = false
    successBlock.hidden = true
    status.textContent = ''
    sendButton.disabled = false
    sendButton.textContent = i18n.t('photo.send')
  }

  const resetPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    previewUrl = ''
    selectedFile = null
    preview.removeAttribute('src')
    previewFrame.hidden = true
    chooseRow.hidden = false
    actionRow.hidden = true
    cameraInput.value = ''
    uploadInput.value = ''
    sending = false
    sendButton.disabled = false
    sendButton.textContent = i18n.t('photo.send')
  }

  const handleFile = (file) => {
    const result = validatePhotoFile(file)
    if (!result.ok) {
      status.textContent = i18n.t(`photo.${result.code}`)
      announce(status, status.textContent)
      return
    }
    setPreview(result.file)
  }

  cameraInput.addEventListener('change', () => {
    const file = cameraInput.files?.[0]
    if (file) handleFile(file)
  })
  uploadInput.addEventListener('change', () => {
    const file = uploadInput.files?.[0]
    if (file) handleFile(file)
  })

  const retakeButton = createButton({
    label: i18n.t('photo.retake'),
    variant: 'choice',
    onClick: resetPreview,
  })

  const sendButton = createButton({
    label: i18n.t('photo.send'),
    onClick: async () => {
      if (!selectedFile || sending) {
        if (!selectedFile) status.textContent = i18n.t('photo.empty')
        return
      }

      sending = true
      sendButton.disabled = true
      retakeButton.disabled = true
      sendButton.textContent = i18n.t('contribute.sending')
      status.textContent = i18n.t('contribute.sending')

      try {
        const participant = session.getParticipant()
        await syncParticipantToSupabase(participant).catch(() => {})
        const result = await uploadPhoto({
          file: selectedFile,
          participant,
          destination,
          withFerenc: withFerenc.checked,
        })

        if (photoUploadFailed(result)) {
          sending = false
          sendButton.disabled = false
          retakeButton.disabled = false
          sendButton.textContent = i18n.t('photo.send')
          status.textContent = photoErrorCopy(i18n, result)
          announce(status, status.textContent)
          return
        }

        if (typeof onPhotoAdded === 'function' && result.photo) {
          onPhotoAdded(result.photo)
        }

        actionRow.hidden = true
        chooseRow.hidden = true
        if (withFerencRow) withFerencRow.hidden = true
        sendButton.textContent = i18n.t('contribute.sent')
        successTitle.textContent = i18n.t('contribute.sent')
        successHint.textContent = result.remote ? i18n.t('photo.successHint') : i18n.t('photo.savedLocally')
        successBlock.hidden = false
        status.textContent = i18n.t('contribute.sent')
        announce(status, i18n.t('contribute.sent'))
      } catch {
        sending = false
        sendButton.disabled = false
        retakeButton.disabled = false
        sendButton.textContent = i18n.t('photo.send')
        status.textContent = isOffline() ? i18n.t('errors.connection') : i18n.t('photo.failed')
        announce(status, status.textContent)
      }
    },
  })

  const actionRow = el('div', { className: 'sheet-actions', hidden: true }, [retakeButton, sendButton])
  const successTitle = el('p', { className: 'photo-success__title' })
  const successHint = el('p', { className: 'photo-success__hint' })
  const doneButton = createButton({
    label: i18n.t('contribute.done'),
    onClick: () => closer.close(),
  })
  const successBlock = el('div', { className: 'photo-success', hidden: true }, [
    successTitle,
    successHint,
    doneButton,
  ])

  closer = openSheet({
    title: i18n.t('contribute.photo'),
    i18n,
    onClose: () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      onDone()
    },
    children: [
      cameraInput,
      uploadInput,
      chooseRow,
      previewFrame,
      withFerencRow,
      actionRow,
      successBlock,
      status,
    ],
  })
}

function openMessageSheet({ i18n, session, destination, onDone, onMessageAdded }) {
  const status = createStatus()
  let sending = false
  let closer = { close: () => {} }
  const textarea = el('textarea', {
    className: 'field__input field__input--area',
    maxLength: APP_CONFIG.maxMessageLength,
    rows: 5,
    enterKeyHint: 'send',
  })
  textarea.placeholder = i18n.t('message.placeholder')

  const successTitle = el('p', { className: 'photo-success__title' })
  const successHint = el('p', { className: 'photo-success__hint' })
  const doneButton = createButton({
    label: i18n.t('contribute.done'),
    onClick: () => closer.close(),
  })
  const successBlock = el('div', { className: 'photo-success', hidden: true }, [
    successTitle,
    successHint,
    doneButton,
  ])

  const send = createButton({
    label: i18n.t('contribute.send'),
    onClick: async () => {
      if (sending) return
      const parsedText = textarea.value.trim()
      if (!parsedText) {
        status.textContent = i18n.t('message.empty')
        announce(status, i18n.t('message.empty'))
        return
      }
      if (parsedText.length > APP_CONFIG.maxMessageLength) {
        status.textContent = i18n.t('message.tooLong')
        announce(status, i18n.t('message.tooLong'))
        return
      }

      sending = true
      send.disabled = true
      textarea.disabled = true
      send.textContent = i18n.t('contribute.sending')
      status.textContent = i18n.t('contribute.sending')

      try {
        const result = await sendMessage({
          content: parsedText,
          participant: session.getParticipant(),
          destination,
        })

        if (!result.ok) {
          sending = false
          send.disabled = false
          textarea.disabled = false
          send.textContent = i18n.t('contribute.send')
          status.textContent = messageErrorCopy(i18n, result)
          announce(status, status.textContent)
          return
        }

        textarea.hidden = true
        send.hidden = true
        fieldBlock.hidden = true
        send.textContent = i18n.t('contribute.sent')
        successTitle.textContent = i18n.t('contribute.sent')
        successHint.textContent = result.remote
          ? i18n.t('message.successHint')
          : i18n.t('message.savedLocally')
        successBlock.hidden = false
        status.textContent = i18n.t('contribute.sent')
        announce(status, i18n.t('contribute.sent'))
        if (typeof onMessageAdded === 'function' && result.message) {
          onMessageAdded(result.message)
        }
      } catch {
        sending = false
        send.disabled = false
        textarea.disabled = false
        send.textContent = i18n.t('contribute.send')
        status.textContent = isOffline() ? i18n.t('errors.connection') : i18n.t('message.failed')
        announce(status, status.textContent)
      }
    },
  })

  const fieldBlock = el('div', { className: 'message-compose' }, [
    el('label', { className: 'field__label', textContent: i18n.t('message.label') }),
    textarea,
    send,
  ])

  closer = openSheet({
    title: i18n.t('contribute.message'),
    i18n,
    onClose: onDone,
    children: [fieldBlock, status, successBlock],
  })
}

function voiceErrorCopy(error, i18n) {
  const code = error?.code
  const name = error?.name
  if (code === 'insecure') return i18n.t('voice.insecure')
  if (code === 'unsupported') return i18n.t('voice.unsupported')
  if (code === 'failed' || code === 'empty-recording') return i18n.t('voice.empty')
  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError' ||
    code === 'denied'
  ) {
    return i18n.t('voice.denied')
  }
  return i18n.t('voice.unavailable')
}

function openVoiceSheet({ i18n, session, destination, onDone, onVoiceAdded }) {
  const status = createStatus()
  const timer = el('p', { className: 'voice-timer', textContent: '0:00' })
  let recording = null
  let elapsed = 0
  let tick = 0
  let blob = null
  let sending = false
  let closer = { close: () => {} }
  const preview = el('audio', { className: 'voice-preview', controls: true, hidden: true })

  const format = (seconds) => `0:${String(seconds).padStart(2, '0')}`
  const stopTick = () => window.clearInterval(tick)

  const finishRecording = async () => {
    if (!recording) return
    stopTick()
    try {
      blob = await recording.stop()
    } catch (error) {
      recording = null
      start.disabled = false
      stop.disabled = true
      send.disabled = true
      status.textContent = voiceErrorCopy(error, i18n)
      announce(status, status.textContent)
      return
    }
    recording = null
    preview.src = URL.createObjectURL(blob)
    preview.hidden = false
    start.disabled = true
    stop.disabled = true
    send.disabled = false
    status.textContent = i18n.t('voice.preview')
  }

  const start = createButton({
    label: i18n.t('voice.record'),
    ariaLabel: i18n.t('a11y.microphone'),
    onClick: async () => {
      const support = getMicrophoneSupport()
      if (!support.ok) {
        if (support.code === 'insecure') {
          console.info(
            '[microphone] Blocked on an insecure origin. Browsers require HTTPS (or localhost). http://192.168.x.x cannot access the microphone. Do not disable browser security; test on localhost or deploy over HTTPS.',
          )
        }
        status.textContent = i18n.t(`voice.${support.code}`)
        announce(status, status.textContent)
        return
      }
      try {
        recording = await startVoiceRecording()
        elapsed = 0
        blob = null
        preview.hidden = true
        timer.textContent = format(elapsed)
        status.textContent = i18n.t('voice.recording')
        start.disabled = true
        stop.disabled = false
        send.disabled = true
        tick = window.setInterval(async () => {
          elapsed += 1
          timer.textContent = format(elapsed)
          if (elapsed >= APP_CONFIG.maxVoiceSeconds) {
            await finishRecording()
          }
        }, 1000)
      } catch (error) {
        status.textContent = voiceErrorCopy(error, i18n)
        announce(status, status.textContent)
      }
    },
  })

  const stop = createButton({
    label: i18n.t('voice.stop'),
    variant: 'choice',
    onClick: finishRecording,
  })
  stop.disabled = true

  const send = createButton({
    label: i18n.t('voice.send'),
    onClick: async () => {
      if (!blob || sending) {
        if (!blob) status.textContent = i18n.t('voice.unavailable')
        return
      }
      sending = true
      send.disabled = true
      send.textContent = i18n.t('contribute.sending')
      status.textContent = i18n.t('contribute.sending')

      const result = await uploadVoice({
        blob,
        participant: session.getParticipant(),
        destination,
        duration: elapsed,
      })

      if (!result.ok || photoUploadFailed(result)) {
        sending = false
        send.disabled = false
        send.textContent = i18n.t('voice.send')
        status.textContent = isOffline() || result.code === 'notConfigured'
          ? i18n.t('errors.connection')
          : i18n.t('voice.failed')
        announce(status, status.textContent)
        return
      }

      send.textContent = i18n.t('contribute.sent')
      status.textContent = i18n.t('contribute.sent')
      if (typeof onVoiceAdded === 'function' && result.voice) onVoiceAdded(result.voice)
      window.setTimeout(() => closer.close(), 700)
    },
  })
  send.disabled = true

  closer = openSheet({
    title: i18n.t('contribute.voice'),
    i18n,
    onClose: () => {
      stopTick()
      recording?.cancel()
      onDone()
    },
    children: [timer, el('div', { className: 'sheet-actions' }, [start, stop]), preview, status, send],
  })
}

export function createComposer({
  i18n,
  session,
  destination = 'today',
  showPrompt = true,
  showReactions = false,
  withFerencDefault = false,
  onPhotoAdded,
  onMessageAdded,
  onVoiceAdded,
} = {}) {
  const host = el('div', { className: 'composer' })
  const participant = session.getParticipant()

  const actions = el('div', { className: 'composer__actions' }, [
    createButton({
      variant: 'choice',
      className: 'composer__action',
      ariaLabel: i18n.t('contribute.photo'),
      children: [createIcon('camera'), el('span', { textContent: i18n.t('contribute.photo') })],
      onClick: () => {
        openPhotoSheet({
          i18n,
          session,
          destination,
          withFerencDefault,
          onPhotoAdded,
          onDone: () => {},
        })
      },
    }),
    createButton({
      variant: 'choice',
      className: 'composer__action',
      ariaLabel: i18n.t('contribute.message'),
      children: [createIcon('message'), el('span', { textContent: i18n.t('contribute.message') })],
      onClick: () => {
        openMessageSheet({
          i18n,
          session,
          destination,
          onMessageAdded,
          onDone: () => {},
        })
      },
    }),
    createButton({
      variant: 'choice',
      className: 'composer__action',
      ariaLabel: i18n.t('contribute.voice'),
      children: [createIcon('mic'), el('span', { textContent: i18n.t('contribute.voice') })],
      onClick: () => {
        openVoiceSheet({
          i18n,
          session,
          destination,
          onVoiceAdded,
          onDone: () => {},
        })
      },
    }),
  ])

  const root = el('div', { className: 'composer__bar' }, [
    showPrompt
      ? el('p', {
          className: 'composer__prompt',
          textContent: i18n.t('contribute.prompt'),
        })
      : null,
    participant && showPrompt
      ? el('p', {
          className: 'composer__hello visually-hidden',
          textContent: i18n.t('contribute.hello', { name: participant.displayName }),
        })
      : null,
    actions,
    showReactions
      ? el('div', { className: 'composer__secondary' }, [
          createReactionBar({ i18n, compact: true, session }),
        ])
      : null,
  ])

  host.append(root)
  return host
}
