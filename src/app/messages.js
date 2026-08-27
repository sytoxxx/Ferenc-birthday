import { APP_CONFIG } from './config.js'
import { createLocalId } from '../lib/id.js'
import { getSupabaseClient } from '../lib/supabase.js'
import { addContribution, listContributions } from './contributions.js'
import { syncParticipantToSupabase } from './participant.js'

export const MESSAGE_TABLE = APP_CONFIG.messageTable
const MESSAGE_COLUMNS_CONTENT = 'id, participant_id, participant_name, content, created_at, destination'
const MESSAGE_COLUMNS_CONTENT_MIN = 'id, participant_id, participant_name, content, created_at'
const MESSAGE_COLUMNS_MESSAGE = 'id, participant_id, participant_name, message, created_at'

let messageChannel = null
const messageListeners = new Set()

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

function messageTextFromRow(row) {
  return String(row?.message || row?.content || row?.text || '')
}

function safeParticipantId(participant) {
  const raw = String(participant?.localId || 'guest')
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '')
  return cleaned || 'guest'
}

export function validateMessageContent(rawValue) {
  const content = String(rawValue ?? '').trim()

  if (!content) {
    return { ok: false, code: 'empty' }
  }

  if (content.length > APP_CONFIG.maxMessageLength) {
    return { ok: false, code: 'tooLong' }
  }

  return { ok: true, content }
}

export function normalizeMessage(row, extras = {}) {
  return {
    id: String(row.id || extras.id || createLocalId()),
    displayName: row.participant_name || row.displayName || '',
    text: messageTextFromRow(row),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    destination: row.destination || extras.destination || 'today',
    source: extras.source || row.source || 'remote',
  }
}

export async function listRemoteMessages() {
  const client = getSupabaseClient()
  if (!client) {
    return { ok: false, reason: 'supabase_not_configured', messages: [] }
  }

  let { data, error } = await client
    .from(MESSAGE_TABLE)
    .select(MESSAGE_COLUMNS_CONTENT)
    .order('created_at', { ascending: false })

  if (error && isMissingColumnError(error, 'destination')) {
    const retry = await client
      .from(MESSAGE_TABLE)
      .select(MESSAGE_COLUMNS_CONTENT_MIN)
      .order('created_at', { ascending: false })
    data = retry.data
    error = retry.error
  }

  if (error && isMissingColumnError(error, 'content')) {
    const fallback = await client
      .from(MESSAGE_TABLE)
      .select(MESSAGE_COLUMNS_MESSAGE)
      .order('created_at', { ascending: false })
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    return { ok: false, reason: error.message, messages: [] }
  }

  return {
    ok: true,
    messages: (data || []).map((row) => normalizeMessage(row, { source: 'remote' })),
  }
}

export function listLocalMessages(destination = 'today') {
  return listContributions({ destination, type: 'message' }).map((item) =>
    normalizeMessage(
      {
        id: item.id,
        participant_name: item.displayName,
        content: item.text,
        created_at: item.createdAt,
      },
      { source: 'local', destination: item.destination || destination },
    ),
  )
}

export function mergeMessages(remoteMessages, localMessages) {
  const seen = new Set()
  const merged = []

  for (const message of [...remoteMessages, ...localMessages]) {
    const key = message.id
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(message)
  }

  merged.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  return merged
}

export async function loadMergedMessages(destination = 'today') {
  const localMessages = listLocalMessages(destination)
  const remote = await listRemoteMessages()
  const remoteForDestination = (remote.messages || []).filter(
    (message) => (message.destination || 'today') === destination,
  )
  return {
    messages: mergeMessages(remoteForDestination, localMessages),
    remoteOk: remote.ok,
  }
}

function persistLocalMessage({ id, participant, content, destination, createdAt, remoteStatus }) {
  const entry = {
    id,
    type: 'message',
    destination,
    displayName: participant?.displayName || '',
    participantId: safeParticipantId(participant),
    createdAt,
    remoteStatus,
    text: content,
  }
  addContribution(entry)
  return entry
}

export async function sendMessage({ content, participant, destination = 'today' }) {
  const parsed = validateMessageContent(content)
  if (!parsed.ok) return parsed

  const client = getSupabaseClient()
  if (!client) {
    if (destination !== 'today') {
      const createdAt = new Date().toISOString()
      const entry = persistLocalMessage({
        id: createLocalId(),
        participant,
        content: parsed.content,
        destination,
        createdAt,
        remoteStatus: 'local-only',
      })
      return {
        ok: true,
        remote: false,
        code: 'localDestination',
        message: normalizeMessage(entry, { source: 'local', destination }),
      }
    }
    return { ok: false, code: 'notConfigured' }
  }

  try {
    const synced = await syncParticipantToSupabase(participant)
    if (synced.status === 'failed') {
      return { ok: false, code: 'failed' }
    }

    const baseRow = {
      participant_id: safeParticipantId(participant),
      participant_name: participant?.displayName || '',
      destination,
    }

    let { data, error } = await client
      .from(MESSAGE_TABLE)
      .insert({ ...baseRow, content: parsed.content })
      .select(MESSAGE_COLUMNS_CONTENT)
      .maybeSingle()

    if (error && isMissingColumnError(error, 'destination')) {
      if (destination === 'capsule') {
        const createdAt = new Date().toISOString()
        const entry = persistLocalMessage({
          id: createLocalId(),
          participant,
          content: parsed.content,
          destination,
          createdAt,
          remoteStatus: 'local-only',
        })
        return {
          ok: true,
          remote: false,
          code: 'localDestination',
          message: normalizeMessage(entry, { source: 'local', destination }),
        }
      }
      const retry = await client
        .from(MESSAGE_TABLE)
        .insert({
          participant_id: baseRow.participant_id,
          participant_name: baseRow.participant_name,
          content: parsed.content,
        })
        .select(MESSAGE_COLUMNS_CONTENT_MIN)
        .maybeSingle()
      data = retry.data
      error = retry.error
    }

    if (error && isMissingColumnError(error, 'content')) {
      const fallback = await client
        .from(MESSAGE_TABLE)
        .insert({
          participant_id: baseRow.participant_id,
          participant_name: baseRow.participant_name,
          message: parsed.content,
        })
        .select(MESSAGE_COLUMNS_MESSAGE)
        .maybeSingle()
      data = fallback.data
      error = fallback.error
    }

    if (error || !data) {
      return { ok: false, code: 'failed' }
    }

    persistLocalMessage({
      id: data.id,
      participant,
      content: messageTextFromRow(data) || parsed.content,
      destination,
      createdAt: data.created_at || new Date().toISOString(),
      remoteStatus: 'synced',
    })

    return {
      ok: true,
      remote: true,
      message: normalizeMessage(data, { source: 'remote', destination }),
    }
  } catch {
    return { ok: false, code: 'failed' }
  }
}

export function stopMessageRealtime() {
  if (!messageChannel) return
  const client = getSupabaseClient()
  if (client) {
    void client.removeChannel(messageChannel)
  }
  messageChannel = null
}

export function subscribeMessageInserts(onInsert) {
  if (typeof onInsert === 'function') messageListeners.add(onInsert)
  ensureMessageChannel()
  return () => messageListeners.delete(onInsert)
}

function ensureMessageChannel() {
  if (messageChannel) return
  const client = getSupabaseClient()
  if (!client) return

  messageChannel = client
    .channel('messages-inserts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: MESSAGE_TABLE },
      (payload) => {
        const row = payload.new
        if (!row) return
        const message = normalizeMessage(row, { source: 'remote' })
        messageListeners.forEach((listener) => listener(message))
      },
    )
    .subscribe()
}
