import { HONOREE_NAME } from './config.js'
import { AppError } from '../lib/errors.js'
import { createLocalId } from '../lib/id.js'
import { isSupabaseConfigured, getSupabaseClient } from '../lib/supabase.js'

export const NAME_MIN_LENGTH = 1
export const NAME_MAX_LENGTH = 40

export function validateDisplayName(rawValue) {
  const displayName = String(rawValue ?? '').trim()

  if (displayName.length < NAME_MIN_LENGTH) {
    return { ok: false, code: 'name_empty' }
  }

  if (displayName.length > NAME_MAX_LENGTH) {
    return { ok: false, code: 'name_too_long' }
  }

  return { ok: true, displayName }
}

/**
 * Local participant record. The same `localId` is inserted into
 * public.participants so message and photo foreign keys can succeed.
 */
export function buildLocalParticipant(displayName, locale) {
  return {
    localId: createLocalId(),
    displayName,
    locale,
    createdAt: new Date().toISOString(),
    remoteStatus: 'local-only',
  }
}

export function buildOwnerParticipant(locale) {
  return buildLocalParticipant(HONOREE_NAME, locale)
}

/**
 * public.messages and public.photos both reference public.participants(id).
 * Join already calls this; contribute paths call it again so older local
 * sessions still get a row before the first insert.
 */
export async function syncParticipantToSupabase(participant) {
  const client = getSupabaseClient()
  if (!isSupabaseConfigured() || !client) {
    return { status: 'skipped', reason: 'supabase_not_configured' }
  }

  if (!participant) {
    throw new AppError('generic', 'Missing participant')
  }

  const id = String(participant.localId || '').trim()
  const name = String(participant.displayName || '').trim()
  if (!id || !name) {
    return { status: 'skipped', reason: 'missing_participant' }
  }

  const { error } = await client.from('participants').insert({ id, name })
  if (!error) {
    return { status: 'synced' }
  }

  const duplicate =
    error.code === '23505' || String(error.message || '').toLowerCase().includes('duplicate')
  if (duplicate) {
    return { status: 'synced', reason: 'already_exists' }
  }

  return { status: 'failed', reason: error.message }
}
