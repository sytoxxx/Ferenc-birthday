import { APP_CONFIG } from './config.js'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js'
import { readJson, writeJson } from '../lib/storage.js'

export const CONTRIBUTIONS_KEY = 'contributions'
const VOTES_KEY = 'votes'
const VOTED_KEY = 'votedPhotoIds'
const files = new Map()
const urls = new Map()

function loadList() {
  const items = readJson(CONTRIBUTIONS_KEY)
  return Array.isArray(items) ? items : []
}

function saveList(items) {
  writeJson(CONTRIBUTIONS_KEY, items)
}

export function rememberFile(id, blob) {
  files.set(id, blob)
  const url = URL.createObjectURL(blob)
  urls.set(id, url)
  return url
}

export function getFileUrl(id, storedUrl) {
  return urls.get(id) || storedUrl || ''
}

export function listContributions({ destination, type } = {}) {
  return loadList().filter((item) => {
    if (destination && item.destination !== destination) return false
    if (type && item.type !== type) return false
    return true
  })
}

export function addContribution(entry) {
  const items = loadList()
  items.unshift(entry)
  saveList(items)
  return entry
}

export function updateContribution(id, patch) {
  const items = loadList()
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) return null
  items[index] = { ...items[index], ...patch }
  saveList(items)
  return items[index]
}

export function removeContribution(id) {
  saveList(loadList().filter((item) => item.id !== id))
}

export function clearContributions() {
  saveList([])
}

export function getVoteCounts() {
  return readJson(VOTES_KEY) || {}
}

export function getVotedPhotoIds() {
  return Array.isArray(readJson(VOTED_KEY)) ? readJson(VOTED_KEY) : []
}

export function voteForPhoto(photoId) {
  const voted = getVotedPhotoIds()
  if (voted.includes(photoId)) {
    return { ok: false, code: 'alreadyVoted' }
  }

  const counts = getVoteCounts()
  counts[photoId] = (counts[photoId] || 0) + 1
  writeJson(VOTES_KEY, counts)
  writeJson(VOTED_KEY, [...voted, photoId])
  return { ok: true, count: counts[photoId] }
}

export function isCapsuleUnlocked(now = new Date()) {
  if (!APP_CONFIG.capsuleUnlockAt) return false
  const unlockAt = new Date(APP_CONFIG.capsuleUnlockAt)
  if (Number.isNaN(unlockAt.getTime())) return false
  return now.getTime() >= unlockAt.getTime()
}

/**
 * Reserved for later remote persistence. No table or query is invented here.
 */
export async function syncContributionToSupabase(entry) {
  if (!isSupabaseConfigured() || !getSupabaseClient()) {
    return { status: 'skipped', reason: 'supabase_not_configured' }
  }

  if (!entry) {
    return { status: 'skipped', reason: 'missing_entry' }
  }

  return { status: 'skipped', reason: 'table_schema_not_defined' }
}
