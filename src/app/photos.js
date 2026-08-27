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

export const PHOTO_BUCKET = APP_CONFIG.photoBucket
export const PHOTO_TABLE = APP_CONFIG.photoTable

const PHOTO_COLUMNS =
  'id, participant_id, participant_name, file_path, created_at, destination, with_ferenc'
const PHOTO_COLUMNS_MIN = 'id, participant_id, participant_name, file_path, created_at'

const MIME_EXTENSION = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
}

let photoChannel = null
const photoListeners = new Set()

function isMissingColumnError(error, column) {
  const code = String(error?.code || '')
  const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    text.includes(`'${column}'`) ||
    text.includes(`"${column}"`) ||
    text.includes(` ${column} `)
  )
}

function extensionForFile(file) {
  const fromType = MIME_EXTENSION[(file.type || '').toLowerCase()]
  if (fromType) return fromType
  const name = String(file.name || '').toLowerCase()
  const match = name.match(/\.(jpe?g|png|webp|heic|heif)$/)
  return match ? `.${match[1].replace('jpeg', 'jpg')}` : '.jpg'
}

function safeParticipantId(participant) {
  const raw = String(participant?.localId || 'guest')
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '')
  return cleaned || 'guest'
}

function mapStorageError(error) {
  const message = String(error?.message || error?.error || error?.statusCode || '').toLowerCase()
  if (
    message.includes('bucket') ||
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('not configured') ||
    message.includes('404')
  ) {
    return 'notConfigured'
  }
  return 'failed'
}

export function normalizePhoto(row, extras = {}) {
  return {
    id: String(row.id || row.file_path || row.filePath || extras.id || createLocalId()),
    displayName: row.participant_name || row.displayName || '',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    filePath: row.file_path || row.filePath || '',
    destination: row.destination || extras.destination || 'today',
    withFerenc: Boolean(row.with_ferenc ?? row.withFerenc ?? extras.withFerenc),
    url: extras.url || row.url || '',
    source: extras.source || row.source || 'remote',
  }
}

export async function resolvePhotoUrl(filePath) {
  const client = getSupabaseClient()
  if (!client || !filePath) return ''

  const { data: signed, error } = await client.storage.from(PHOTO_BUCKET).createSignedUrl(filePath, 60 * 60)
  if (!error && signed?.signedUrl) return signed.signedUrl

  const { data: pub } = client.storage.from(PHOTO_BUCKET).getPublicUrl(filePath)
  return pub?.publicUrl || ''
}

async function selectPhotos(client) {
  const withExtras = await client.from(PHOTO_TABLE).select(PHOTO_COLUMNS).order('created_at', { ascending: false })
  if (!withExtras.error) return withExtras
  return client.from(PHOTO_TABLE).select(PHOTO_COLUMNS_MIN).order('created_at', { ascending: false })
}

export async function listRemotePhotos() {
  const client = getSupabaseClient()
  if (!client || !isSupabaseConfigured()) {
    return { ok: false, reason: 'supabase_not_configured', photos: [] }
  }

  const { data, error } = await selectPhotos(client)

  if (error) {
    return { ok: false, reason: error.message, photos: [] }
  }

  const photos = await Promise.all(
    (data || []).map(async (row) =>
      normalizePhoto(row, {
        url: await resolvePhotoUrl(row.file_path),
        source: 'remote',
      }),
    ),
  )

  return { ok: true, photos }
}

export function photosForDestination(photos, destination = 'today') {
  return photos.filter((photo) => (photo.destination || 'today') === destination)
}

export function listLocalPhotos(destination) {
  const filter = destination ? { destination, type: 'photo' } : { type: 'photo' }
  return listContributions(filter).map((item) =>
    normalizePhoto(
      {
        id: item.id,
        participant_name: item.displayName,
        created_at: item.createdAt,
        file_path: item.filePath || '',
        destination: item.destination || destination || 'today',
        with_ferenc: item.withFerenc,
        url: getFileUrl(item.id, item.url),
      },
      { source: 'local', url: getFileUrl(item.id, item.url) },
    ),
  )
}

export function mergePhotos(remotePhotos, localPhotos) {
  const seen = new Set()
  const merged = []

  for (const photo of [...remotePhotos, ...localPhotos]) {
    const keys = [photo.filePath, photo.id].filter(Boolean)
    if (keys.some((key) => seen.has(key))) continue
    keys.forEach((key) => seen.add(key))
    merged.push(photo)
  }

  merged.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  return merged
}

export async function loadMergedPhotos(destination = 'today') {
  const localPhotos = listLocalPhotos(destination)
  const remote = await listRemotePhotos()
  return {
    photos: mergePhotos(photosForDestination(remote.photos, destination), localPhotos),
    remoteOk: remote.ok,
    allRemote: remote.photos,
  }
}

export async function uploadPhoto({
  file,
  participant,
  destination = 'today',
  withFerenc = false,
} = {}) {
  const id = createLocalId()
  const localUrl = rememberFile(id, file)
  const localEntry = {
    id,
    type: 'photo',
    destination,
    displayName: participant?.displayName || '',
    participantId: safeParticipantId(participant),
    createdAt: new Date().toISOString(),
    remoteStatus: 'local-only',
    url: localUrl,
    filePath: '',
    withFerenc: Boolean(withFerenc),
  }
  addContribution(localEntry)

  const localPhoto = normalizePhoto(
    {
      id,
      participant_name: localEntry.displayName,
      created_at: localEntry.createdAt,
      destination,
      with_ferenc: withFerenc,
      url: localUrl,
    },
    { source: 'local', url: localUrl },
  )

  const client = getSupabaseClient()
  if (!client || !isSupabaseConfigured()) {
    return { ok: false, remote: false, code: 'notConfigured', photo: localPhoto }
  }

  const participantId = safeParticipantId(participant)
  const filePath =
    destination === 'today'
      ? `${participantId}/${id}${extensionForFile(file)}`
      : `${destination}/${participantId}/${id}${extensionForFile(file)}`

  try {
    const { error: uploadError } = await client.storage.from(PHOTO_BUCKET).upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })

    if (uploadError) {
      return { ok: false, remote: false, code: mapStorageError(uploadError), photo: localPhoto }
    }

    const fullRow = {
      participant_id: participantId,
      participant_name: participant?.displayName || '',
      file_path: filePath,
      destination,
      with_ferenc: Boolean(withFerenc),
    }

    let inserted = await client.from(PHOTO_TABLE).insert(fullRow).select(PHOTO_COLUMNS).maybeSingle()
    let row = inserted.data
    let insertError = inserted.error

    if (insertError && (isMissingColumnError(insertError, 'with_ferenc') || isMissingColumnError(insertError, 'destination'))) {
      if (destination === 'capsule') {
        await client.storage.from(PHOTO_BUCKET).remove([filePath])
        return { ok: true, remote: false, code: 'localDestination', photo: localPhoto }
      }
      const retry = await client
        .from(PHOTO_TABLE)
        .insert({
          participant_id: participantId,
          participant_name: participant?.displayName || '',
          file_path: filePath,
        })
        .select(PHOTO_COLUMNS_MIN)
        .maybeSingle()
      row = retry.data
      insertError = retry.error
    }

    if (insertError && /column .*id/i.test(String(insertError.message || ''))) {
      const retry = await client
        .from(PHOTO_TABLE)
        .insert({
          participant_id: participantId,
          participant_name: participant?.displayName || '',
          file_path: filePath,
        })
        .select(PHOTO_COLUMNS_MIN)
        .maybeSingle()
      row = retry.data
      insertError = retry.error
    }

    if (insertError) {
      await client.storage.from(PHOTO_BUCKET).remove([filePath])
      return { ok: false, remote: false, code: 'failed', photo: localPhoto }
    }

    updateContribution(id, {
      remoteStatus: 'synced',
      filePath,
      url: localUrl,
      withFerenc: Boolean(withFerenc),
    })

    const remoteUrl = await resolvePhotoUrl(filePath)

    return {
      ok: true,
      remote: true,
      photo: normalizePhoto(row || { ...localEntry, file_path: filePath, id, destination, with_ferenc: withFerenc }, {
        url: remoteUrl || localUrl,
        source: 'remote',
      }),
    }
  } catch {
    return { ok: false, remote: false, code: 'failed', photo: localPhoto }
  }
}

export function stopPhotoRealtime() {
  if (!photoChannel) return
  const client = getSupabaseClient()
  if (client) {
    void client.removeChannel(photoChannel)
  }
  photoChannel = null
}

export function subscribePhotoInserts(onInsert) {
  if (typeof onInsert === 'function') photoListeners.add(onInsert)
  ensurePhotoChannel()
  return () => photoListeners.delete(onInsert)
}

function ensurePhotoChannel() {
  if (photoChannel) return
  const client = getSupabaseClient()
  if (!client || !isSupabaseConfigured()) return

  photoChannel = client
    .channel('photos-inserts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: PHOTO_TABLE },
      async (payload) => {
        const row = payload.new
        if (!row) return
        const photo = normalizePhoto(row, {
          url: await resolvePhotoUrl(row.file_path),
          source: 'remote',
        })
        photoListeners.forEach((listener) => listener(photo))
      },
    )
    .subscribe()
}
