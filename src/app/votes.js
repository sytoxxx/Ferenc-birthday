import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js'

export const VOTE_TABLE = 'photo_votes'

function safeParticipantId(participant) {
  const raw = String(participant?.localId || 'guest')
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '')
  return cleaned || 'guest'
}

export async function listRemoteVotes() {
  const client = getSupabaseClient()
  if (!client || !isSupabaseConfigured()) {
    return { ok: false, votes: [] }
  }

  const { data, error } = await client.from(VOTE_TABLE).select('photo_id, participant_id')
  if (error) return { ok: false, votes: [] }
  return { ok: true, votes: data || [] }
}

export function tallyVotes(votes) {
  const counts = {}
  for (const vote of votes) {
    const id = String(vote.photo_id || '')
    if (!id) continue
    counts[id] = (counts[id] || 0) + 1
  }
  return counts
}

export function votedPhotoIdsFor(votes, participant) {
  const id = safeParticipantId(participant)
  return votes.filter((vote) => vote.participant_id === id).map((vote) => String(vote.photo_id))
}

export async function sendPhotoVote({ photoId, participant }) {
  const client = getSupabaseClient()
  const participantId = safeParticipantId(participant)
  if (!photoId || !participantId) {
    return { ok: false, code: 'failed' }
  }

  if (!client || !isSupabaseConfigured()) {
    return { ok: false, code: 'notConfigured' }
  }

  const { error } = await client.from(VOTE_TABLE).insert({
    photo_id: String(photoId),
    participant_id: participantId,
  })

  if (error) {
    const text = String(error.message || '').toLowerCase()
    if (error.code === '23505' || text.includes('duplicate')) {
      return { ok: false, code: 'alreadyVoted' }
    }
    return { ok: false, code: 'failed' }
  }

  return { ok: true }
}
