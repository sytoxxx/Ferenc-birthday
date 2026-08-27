export const HONOREE_NAME = 'Ferenc'

export const APP_CONFIG = {
  age: 22,
  birthdayIso: '2026-08-27',
  ownerSessionMs: 30 * 24 * 60 * 60 * 1000,
  maxPhotoBytes: 8 * 1024 * 1024,
  maxVoiceSeconds: 30,
  maxMessageLength: 500,
  allowedPhotoTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  photoBucket: 'photos',
  photoTable: 'photos',
  messageTable: 'messages',
  voiceBucket: 'voices',
  voiceTable: 'voices',
  /**
   * Ferenc can open Zeitkapsel content after this instant.
   * Change this ISO timestamp if the reveal should happen earlier or later.
   */
  capsuleUnlockAt: '2026-08-27T22:00:00+02:00',
}
