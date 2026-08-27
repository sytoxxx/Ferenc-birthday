import { readJson, removeItem, writeJson } from '../lib/storage.js'

const SESSION_KEY = 'admin.gateSession'
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000

function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function checkAdminGateAnswer(rawValue) {
  const value = fold(rawValue)
  if (!value) return { ok: false, code: 'empty' }
  if (value === 'levente' || value === 'levi' || value === 'wittmann' || value === 'wittman') {
    return { ok: true }
  }
  return { ok: false, code: 'wrong' }
}

export function isAdminUnlocked() {
  const session = readJson(SESSION_KEY)
  if (!session || typeof session.expiresAt !== 'string') return false
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    removeItem(SESSION_KEY)
    return false
  }
  return session.kind === 'admin'
}

export function unlockAdmin() {
  writeJson(SESSION_KEY, {
    kind: 'admin',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ADMIN_TTL_MS).toISOString(),
  })
}

export function lockAdmin() {
  removeItem(SESSION_KEY)
}
