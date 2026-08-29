export const HONOREE_NAME = 'Hanna'

export const APP_CONFIG = {
  age: 17,
  birthdayIso: '2026-08-31',
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
   * Hanna can open Zeitkapsel content after this instant.
   * Change this ISO timestamp if the reveal should happen earlier or later.
   */
  capsuleUnlockAt: '2026-08-31T22:00:00+02:00',
}
