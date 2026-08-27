import { el } from '../lib/dom.js'
import { createReactionBar, spawnReaction } from '../ui/reactions.js'
import { subscribeReactions } from '../app/live-reactions.js'
import { getSupabaseClient } from '../lib/supabase.js'

export function renderLive({ i18n, session }) {
  const stage = el('div', { className: 'reaction-stage reaction-stage--live', 'aria-hidden': 'true' })
  const countNode = el('p', { className: 'live-count', textContent: '1' })
  const initial = session.getParticipant()?.displayName?.slice(0, 1).toUpperCase() || ''

  subscribeReactions((reaction) => {
    if (!stage.isConnected) return
    spawnReaction(stage, reaction.id)
  })

  void getSupabaseClient()
    ?.from('participants')
    .select('id', { count: 'exact', head: true })
    .then((result) => {
      if (!countNode.isConnected) return
      if (typeof result?.count === 'number' && result.count > 0) {
        countNode.textContent = String(result.count)
      }
    })

  return el('section', { className: 'screen screen--live' }, [
    el('p', { className: 'eyebrow', textContent: i18n.t('live.now') }),
    countNode,
    el('p', { className: 'support', textContent: i18n.t('live.people') }),
    initial
      ? el('div', { className: 'presence' }, [
          el('span', { className: 'presence__initial', textContent: initial }),
        ])
      : null,
    el('h2', { className: 'block-title', textContent: i18n.t('live.reactions') }),
    createReactionBar({ i18n, showLabel: false, session, stage }),
  ])
}
