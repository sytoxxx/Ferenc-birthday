import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js'

export const REACTION_TABLE = 'reactions'
export const LIVE_REACTIONS = [
  { id: 'heart', emoji: '❤️' },
  { id: 'party', emoji: '🎉' },
  { id: 'laugh', emoji: '😂' },
  { id: 'fire', emoji: '🔥' },
]

let reactionChannel = null
const listeners = new Set()

export function reactionById(id) {
  return LIVE_REACTIONS.find((item) => item.id === id) || LIVE_REACTIONS[0]
}

export async function sendLiveReaction({ name, participant }) {
  const reaction = reactionById(name)
  const client = getSupabaseClient()

  listeners.forEach((listener) => listener(reaction))

  if (!client || !isSupabaseConfigured()) {
    return { ok: true, remote: false, reaction }
  }

  const { error } = await client.from(REACTION_TABLE).insert({
    emoji: reaction.emoji,
    name: reaction.id,
    participant_id: String(participant?.localId || '').replace(/[^a-zA-Z0-9_-]/g, '') || 'guest',
  })

  if (error) {
    return { ok: true, remote: false, reaction, code: 'failed' }
  }

  return { ok: true, remote: true, reaction }
}

export function subscribeReactions(onReaction) {
  if (typeof onReaction === 'function') listeners.add(onReaction)
  ensureChannel()
  return () => listeners.delete(onReaction)
}

function ensureChannel() {
  if (reactionChannel) return
  const client = getSupabaseClient()
  if (!client || !isSupabaseConfigured()) return

  reactionChannel = client
    .channel('reactions-inserts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: REACTION_TABLE },
      (payload) => {
        const row = payload.new
        if (!row) return
        const reaction = LIVE_REACTIONS.find((item) => item.id === row.name || item.emoji === row.emoji)
        if (reaction) listeners.forEach((listener) => listener(reaction))
      },
    )
    .subscribe()
}
