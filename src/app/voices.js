import { APP_CONFIG } from './config.js'
import { createLocalId } from '../lib/id.js'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js'
import {
  addContribution,
  getFileUrl,
  listContributions,
  rememberFile,
  updateContribution,
} from './contributions.js'

export const VOICE_BUCKET = APP_CONFIG.voiceBucket
export const VOICE_TABLE = APP_CONFIG.voiceTable

const VOICE_COLUMNS = 'id, participant_id, participant_name, file_path, duration, destination, created_at'
const VOICE_COLUMNS_MIN = 'id, participant_id, participant_name, file_path, created_at'

let voiceChannel = null
const listeners = new Set()

function safeParticipantId(participant) {
  const raw = String(participant?.localId || 'guest')
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '')
  return cleaned || 'guest'
}

function extensionForBlob(blob) {
  const type = String(blob?.type || '').toLowerCase()
  if (type.includes('mp4') || type.includes('aac') || type.includes('m4a')) return '.m4a'
  if (type.includes('ogg')) return '.ogg'
  return '.webm'
}

export function normalizeVoice(row, extras = {}) {
  return {
    id: String(row.id || row.file_path || extras.id || createLocalId()),
    displayName: row.participant_name || row.displayName || '',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    filePath: row.file_path || row.filePath || '',
    duration: Number(row.duration || extras.duration || 0),
    destination: row.destination || extras.destination || 'today',
    url: extras.url || row.url || '',
    source: extras.source || row.source || 'remote',
  }
}

export async function resolveVoiceUrl(filePath) {
  const client = getSupabaseClient()
  if (!client || !filePath) return ''

  const { data: signed, error } = await client.storage.from(VOICE_BUCKET).createSignedUrl(filePath, 60 * 60)
  if (!error && signed?.signedUrl) return signed.signedUrl

  const { data: pub } = client.storage.from(VOICE_BUCKET).getPublicUrl(filePath)
  return pub?.publicUrl || ''
}

export function listLocalVoices(destination = 'today') {
  return listContributions({ destination, type: 'voice' }).map((item) =>
    normalizeVoice(
      {
        id: item.id,
        participant_name: item.displayName,
        created_at: item.createdAt,
        file_path: item.filePath || '',
        duration: item.duration,
        destination: item.destination,
        url: getFileUrl(item.id, item.url),
      },
      { source: 'local', url: getFileUrl(item.id, item.url), destination: item.destination || destination },
    ),
  )
}

export async function listRemoteVoices(destination = 'today') {
  const client = getSupabaseClient()
  if (!client || !isSupabaseConfigured()) {
    return { ok: false, reason: 'supabase_not_configured', voices: [] }
  }

  let { data, error } = await client.from(VOICE_TABLE).select(VOICE_COLUMNS).order('created_at', { ascending: false })
  if (error) {
    const retry = await client.from(VOICE_TABLE).select(VOICE_COLUMNS_MIN).order('created_at', { ascending: false })
    data = retry.data
    error = retry.error
  }

  if (error) {
    return { ok: false, reason: error.message, voices: [] }
  }

  const voices = await Promise.all(
    (data || [])
      .filter((row) => (row.destination || 'today') === destination)
      .map(async (row) =>
        normalizeVoice(row, {
          url: await resolveVoiceUrl(row.file_path),
          source: 'remote',
          destination: row.destination || destination,
        }),
      ),
  )

  return { ok: true, voices }
}

export function mergeVoices(remoteVoices, localVoices) {
  const seen = new Set()
  const merged = []
  for (const voice of [...remoteVoices, ...localVoices]) {
    const keys = [voice.filePath, voice.id].filter(Boolean)
    if (keys.some((key) => seen.has(key))) continue
    keys.forEach((key) => seen.add(key))
    merged.push(voice)
  }
  merged.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  return merged
}

export async function loadMergedVoices(destination = 'today') {
  const localVoices = listLocalVoices(destination)
  const remote = await listRemoteVoices(destination)
  return {
    voices: mergeVoices(remote.voices, localVoices),
    remoteOk: remote.ok,
  }
}

export async function uploadVoice({ blob, participant, destination = 'today', duration = 0 }) {
  if (!blob || !blob.size) {
    return { ok: false, code: 'failed' }
  }

  const id = createLocalId()
  const localUrl = rememberFile(id, blob)
  const localEntry = {
    id,
    type: 'voice',
    destination,
    displayName: participant?.displayName || '',
    participantId: safeParticipantId(participant),
    createdAt: new Date().toISOString(),
    remoteStatus: 'local-only',
    url: localUrl,
    duration,
    filePath: '',
  }
  addContribution(localEntry)

  const localVoice = normalizeVoice(localEntry, {
    url: localUrl,
    source: 'local',
    destination,
    duration,
  })

  const client = getSupabaseClient()
  if (!client || !isSupabaseConfigured()) {
    return { ok: false, remote: false, code: 'notConfigured', voice: localVoice }
  }

  const participantId = safeParticipantId(participant)
  const filePath = `${destination}/${participantId}/${id}${extensionForBlob(blob)}`

  try {
    const { error: uploadError } = await client.storage.from(VOICE_BUCKET).upload(filePath, blob, {
      cacheControl: '3600',
      contentType: blob.type || 'audio/webm',
      upsert: false,
    })

    if (uploadError) {
      return { ok: false, remote: false, code: 'failed', voice: localVoice }
    }

    const row = {
      participant_id: participantId,
      participant_name: participant?.displayName || '',
      file_path: filePath,
      duration,
      destination,
    }

    let inserted = await client.from(VOICE_TABLE).insert(row).select(VOICE_COLUMNS).maybeSingle()
    if (inserted.error) {
      const { destination: _dest, duration: _dur, ...minRow } = row
      inserted = await client.from(VOICE_TABLE).insert(minRow).select(VOICE_COLUMNS_MIN).maybeSingle()
    }

    if (inserted.error) {
      await client.storage.from(VOICE_BUCKET).remove([filePath])
      return { ok: false, remote: false, code: 'failed', voice: localVoice }
    }

    updateContribution(id, { remoteStatus: 'synced', filePath, url: localUrl })
    const remoteUrl = await resolveVoiceUrl(filePath)

    return {
      ok: true,
      remote: true,
      voice: normalizeVoice(inserted.data || { ...localEntry, file_path: filePath, id }, {
        url: remoteUrl || localUrl,
        source: 'remote',
        destination,
        duration,
      }),
    }
  } catch {
    return { ok: false, remote: false, code: 'failed', voice: localVoice }
  }
}

function notifyVoice(voice) {
  listeners.forEach((listener) => listener(voice))
}

export function stopVoiceRealtime() {
  if (!voiceChannel) return
  const client = getSupabaseClient()
  if (client) void client.removeChannel(voiceChannel)
  voiceChannel = null
}

export function subscribeVoiceInserts(onInsert) {
  if (typeof onInsert === 'function') listeners.add(onInsert)
  ensureVoiceChannel()
  return () => listeners.delete(onInsert)
}

function ensureVoiceChannel() {
  if (voiceChannel) return
  const client = getSupabaseClient()
  if (!client || !isSupabaseConfigured()) return

  voiceChannel = client
    .channel('voices-inserts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: VOICE_TABLE },
      async (payload) => {
        const row = payload.new
        if (!row) return
        notifyVoice(
          normalizeVoice(row, {
            url: await resolveVoiceUrl(row.file_path),
            source: 'remote',
          }),
        )
      },
    )
    .subscribe()
}
