import { prefersReducedMotion } from '../lib/motion.js'

const STEPS = [
  [80, 'is-light'],
  [320, 'is-date'],
  [980, 'is-name'],
  [1680, 'is-age'],
  [2580, 'is-line'],
  [3720, 'is-identity'],
]

export function applyIntroSequence(section, { onComplete } = {}) {
  const reducedMotion = prefersReducedMotion()

  if (reducedMotion) {
    section.classList.add('is-light', 'is-date', 'is-name', 'is-age', 'is-line', 'is-identity', 'is-static')
    onComplete?.()
    return () => {}
  }

  const timers = STEPS.map(([delay, className]) =>
    window.setTimeout(() => {
      if (!section.isConnected) return
      section.classList.add(className)
      if (className === 'is-identity') onComplete?.()
    }, delay),
  )

  return () => timers.forEach((timer) => window.clearTimeout(timer))
}
