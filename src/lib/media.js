import { APP_CONFIG } from '../app/config.js'
import { AppError } from './errors.js'

const ALLOWED_TYPES = new Set(APP_CONFIG.allowedPhotoTypes)
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']

const RECORDER_TYPES = [
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/aac',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
]

export function validatePhotoFile(file) {
  if (!file || typeof file !== 'object' || !file.size) {
    return { ok: false, code: 'empty' }
  }

  if (file.size > APP_CONFIG.maxPhotoBytes) {
    return { ok: false, code: 'tooLarge' }
  }

  const type = String(file.type || '').toLowerCase()
  const name = String(file.name || '').toLowerCase()
  const typeLooksLikeVideo = type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov')

  if (typeLooksLikeVideo) {
    return { ok: false, code: 'unsupported' }
  }

  if (type) {
    if (!ALLOWED_TYPES.has(type) && !type.startsWith('image/')) {
      return { ok: false, code: 'unsupported' }
    }
    if (!ALLOWED_TYPES.has(type) && type.startsWith('image/')) {
      return { ok: false, code: 'unsupported' }
    }
    return { ok: true, file }
  }

  if (ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return { ok: true, file }
  }

  return { ok: false, code: 'unsupported' }
}

export function isSecureMicrophoneOrigin() {
  return Boolean(window.isSecureContext)
}

export function pickRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return ''
  }
  return RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

export function getMicrophoneSupport() {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return { ok: false, code: 'insecure' }
  }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return { ok: false, code: 'unsupported' }
  }
  if (typeof MediaRecorder === 'undefined') {
    return { ok: false, code: 'unsupported' }
  }
  return { ok: true }
}

export function canUseMicrophone() {
  return getMicrophoneSupport().ok
}

function stopTracks(stream) {
  if (!stream) return
  stream.getTracks().forEach((track) => {
    try {
      track.stop()
    } catch {
      // Track may already be ended.
    }
  })
}

export async function startVoiceRecording() {
  const support = getMicrophoneSupport()
  if (!support.ok) {
    throw new AppError(support.code, support.code)
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
  })

  const mimeType = pickRecorderMimeType()
  let recorder
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  } catch {
    try {
      recorder = new MediaRecorder(stream)
    } catch {
      stopTracks(stream)
      throw new AppError('unsupported', 'unsupported')
    }
  }

  const chunks = []
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data)
    }
  })

  const blobType = recorder.mimeType || mimeType || 'audio/mp4'
  try {
    recorder.start(250)
  } catch {
    recorder.start()
  }

  return {
    mimeType: blobType,
    stop() {
      return new Promise((resolve, reject) => {
        const finish = () => {
          stopTracks(stream)
          if (!chunks.length) {
            reject(new AppError('failed', 'empty-recording'))
            return
          }
          resolve(new Blob(chunks, { type: blobType }))
        }

        if (recorder.state === 'inactive') {
          finish()
          return
        }

        recorder.addEventListener('stop', finish, { once: true })
        recorder.addEventListener(
          'error',
          () => {
            stopTracks(stream)
            reject(new AppError('failed', 'recorder-error'))
          },
          { once: true },
        )
        recorder.stop()
      })
    },
    cancel() {
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        // Already stopped.
      }
      stopTracks(stream)
    },
  }
}
