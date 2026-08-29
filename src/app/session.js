import { HONOREE_NAME } from './config.js'
import { createLocalId } from '../lib/id.js'
import { readJson, removeItem, writeJson, writeString, readString } from '../lib/storage.js'

export const PARTICIPANT_STORAGE_KEY = 'participant'
export const ROLE_STORAGE_KEY = 'role'
export const GIFT_OPENED_KEY = 'giftOpened'

const LEGACY_OWNER_KEYS = ['owner.session', 'owner.pinVerifier', 'owner.gateSession']

export const ROLES = {
  guest: 'guest',
  participant: 'participant',
  owner: 'owner',
}

function clearLegacyOwnerAuth() {
  LEGACY_OWNER_KEYS.forEach((key) => removeItem(key))
}

function isValidStoredParticipant(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.displayName === 'string' &&
      value.displayName.trim().length >= 1 &&
      value.displayName.trim().length <= 40,
  )
}

function ownerParticipantFromStore(storedParticipant) {
  if (isValidStoredParticipant(storedParticipant)) {
    return {
      ...storedParticipant,
      displayName: HONOREE_NAME,
    }
  }

  return {
    localId: createLocalId(),
    displayName: HONOREE_NAME,
    locale: 'de',
    createdAt: new Date().toISOString(),
    remoteStatus: 'local-only',
  }
}

export function createSession() {
  clearLegacyOwnerAuth()

  const storedParticipant = readJson(PARTICIPANT_STORAGE_KEY)
  const storedRole = readString(ROLE_STORAGE_KEY)

  let participant = isValidStoredParticipant(storedParticipant)
    ? {
        ...storedParticipant,
        displayName: storedParticipant.displayName.trim(),
      }
    : null

  let role = ROLES.guest
  let giftOpened = readString(GIFT_OPENED_KEY) === '1'

  if (storedRole === ROLES.owner) {
    participant = ownerParticipantFromStore(participant)
    role = ROLES.owner
    writeJson(PARTICIPANT_STORAGE_KEY, participant)
    writeString(ROLE_STORAGE_KEY, ROLES.owner)
  } else if (storedRole === ROLES.participant && participant) {
    role = ROLES.participant
  }

  return {
    getRole() {
      return role
    },
    getParticipant() {
      return participant
    },
    isParticipant() {
      return Boolean(participant) && (role === ROLES.participant || role === ROLES.owner)
    },
    isOwner() {
      return role === ROLES.owner && Boolean(participant)
    },
    hasOpenedGift() {
      return role === ROLES.owner && giftOpened
    },
    markGiftOpened() {
      giftOpened = true
      writeString(GIFT_OPENED_KEY, '1')
    },
    clearGiftOpened() {
      giftOpened = false
      removeItem(GIFT_OPENED_KEY)
    },
    becomeParticipant(nextParticipant) {
      participant = nextParticipant
      role = ROLES.participant
      writeJson(PARTICIPANT_STORAGE_KEY, nextParticipant)
      writeString(ROLE_STORAGE_KEY, ROLES.participant)
    },
    becomeOwner(nextParticipant) {
      participant = nextParticipant
      role = ROLES.owner
      writeJson(PARTICIPANT_STORAGE_KEY, nextParticipant)
      writeString(ROLE_STORAGE_KEY, ROLES.owner)
    },
    clearIdentity() {
      participant = null
      role = ROLES.guest
      giftOpened = false
      removeItem(PARTICIPANT_STORAGE_KEY)
      removeItem(ROLE_STORAGE_KEY)
      removeItem(GIFT_OPENED_KEY)
      clearLegacyOwnerAuth()
    },
  }
}
