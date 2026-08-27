import { el } from '../lib/dom.js'
import { createButton } from './button.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { LIVE_REACTIONS, sendLiveReaction } from '../app/live-reactions.js'

export const REACTION_NAMES = LIVE_REACTIONS.map((item) => item.id)

export function spawnReaction(stage, name) {
  if (!stage) return
  const reaction = LIVE_REACTIONS.find((item) => item.id === name) || LIVE_REACTIONS[0]
  const node = el('span', {
    className: `reaction-burst reaction-burst--${reaction.id}`,
    textContent: reaction.emoji,
    'aria-hidden': 'true',
  })
  node.style.left = `${12 + Math.random() * 70}%`
  stage.append(node)
  window.setTimeout(() => node.remove(), prefersReducedMotion() ? 200 : 1400)
}

export function createReactionButtons({ i18n, stage, session }) {
  return LIVE_REACTIONS.map((reaction) =>
    createButton({
      variant: 'choice',
      className: 'reaction-btn',
      ariaLabel: i18n.t(`live.${reaction.id}`),
      children: [el('span', { className: 'reaction-emoji', textContent: reaction.emoji })],
      onClick: () => {
        spawnReaction(stage, reaction.id)
        void sendLiveReaction({ name: reaction.id, participant: session?.getParticipant?.() })
      },
    }),
  )
}

export function createReactionBar({ i18n, showLabel = true, compact = false, session, stage }) {
  const host = stage || el('div', { className: 'reaction-stage', 'aria-hidden': 'true' })

  return el('div', { className: `reaction-block${compact ? ' reaction-block--compact' : ''}` }, [
    showLabel
      ? el('p', {
          className: 'composer__reaction-label',
          textContent: i18n.t('contribute.reaction'),
        })
      : null,
    el('div', { className: 'reaction-row' }, createReactionButtons({ i18n, stage: host, session })),
    host,
  ])
}
