import { APP_CONFIG } from './config.js'
import { createLocalId } from '../lib/id.js'
import { readJson, removeItem, writeJson } from '../lib/storage.js'
import { checkOwnerGateAnswer } from './owner-gate.js'

const SESSION_KEY = 'owner.gateSession'
const LEGACY_KEYS = ['owner.session', 'owner.pinVerifier']

export const OWNER_AUTH_STATUS = {
  locked: 'locked',
  authenticated: 'authenticated',
}

function isExpired(isoDate) {
  const expiresAt = new Date(isoDate).getTime()
  return Number.isNaN(expiresAt) || expiresAt <= Date.now()
}

function clearLegacyPinState() {
  LEGACY_KEYS.forEach((key) => removeItem(key))
}

function readSessionRecord() {
  clearLegacyPinState()
  const value = readJson(SESSION_KEY)
  if (!value || typeof value !== 'object' || value.kind !== 'question') {
    return null
  }
  if (typeof value.expiresAt !== 'string' || isExpired(value.expiresAt)) {
    removeItem(SESSION_KEY)
    return null
  }
  return value
}

function persistLocalSession() {
  writeJson(SESSION_KEY, {
    id: createLocalId(),
    kind: 'question',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + APP_CONFIG.ownerSessionMs).toISOString(),
  })
}

export function getOwnerAuthState() {
  const session = readSessionRecord()
  if (session) {
    return {
      status: OWNER_AUTH_STATUS.authenticated,
      provider: 'question-gate',
      secure: false,
    }
  }

  return {
    status: OWNER_AUTH_STATUS.locked,
    provider: 'question-gate',
    secure: false,
  }
}

export function verifyOwnerGateAnswer(rawValue) {
  const result = checkOwnerGateAnswer(rawValue)
  if (!result.ok) return result
  persistLocalSession()
  return { ok: true }
}

export function clearOwnerSession() {
  removeItem(SESSION_KEY)
  clearLegacyPinState()
}
