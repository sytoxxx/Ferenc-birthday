import { prefersReducedMotion } from './motion.js'

const PALETTE = [
  { color: '#c4a574', weight: 34 },
  { color: '#e8d5b0', weight: 22 },
  { color: '#f4eee4', weight: 16 },
  { color: '#e6d5b8', weight: 12 },
  { color: '#7a4e55', weight: 7 },
  { color: '#5c6a7a', weight: 7 },
  { color: '#7a6e86', weight: 6 },
]

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

function pickColor() {
  const total = PALETTE.reduce((sum, item) => sum + item.weight, 0)
  let ticket = Math.random() * total

  for (const item of PALETTE) {
    ticket -= item.weight
    if (ticket <= 0) return item.color
  }

  return PALETTE[0].color
}

/**
 * Sparse gold particles from the gift. Canvas only — not a DOM particle storm.
 */
export function burstConfetti(
  canvas,
  { duration = 1800, count = 36, originX = 0.5, originY = 0.42 } = {},
) {
  if (!canvas || prefersReducedMotion()) {
    return () => {}
  }

  const context = canvas.getContext('2d')
  if (!context) {
    return () => {}
  }

  const ratio = window.devicePixelRatio || 1
  let frameId = 0
  let running = true
  const startedAt = performance.now()
  const particles = Array.from({ length: Math.min(count, 42) }, () => {
    const ribbon = Math.random() > 0.58
    return {
      x: canvas.width * originX + randomBetween(-22, 22) * ratio,
      y: canvas.height * originY,
      vx: randomBetween(-2.4, 2.4) * ratio,
      vy: randomBetween(-7.2, -3.4) * ratio,
      width: (ribbon ? randomBetween(1.3, 2.2) : randomBetween(3, 5.4)) * ratio,
      height: (ribbon ? randomBetween(8, 14) : randomBetween(3.2, 5.8)) * ratio,
      rotation: randomBetween(0, Math.PI * 2),
      rotationSpeed: randomBetween(-0.07, 0.07),
      color: pickColor(),
      gravity: randomBetween(0.06, 0.095) * ratio,
      drag: 0.995,
    }
  })

  const render = (now) => {
    if (!running) return

    const elapsed = now - startedAt
    context.clearRect(0, 0, canvas.width, canvas.height)

    for (const particle of particles) {
      particle.vx *= particle.drag
      particle.vy += particle.gravity
      particle.x += particle.vx
      particle.y += particle.vy
      particle.rotation += particle.rotationSpeed

      context.save()
      context.translate(particle.x, particle.y)
      context.rotate(particle.rotation)
      context.globalAlpha = Math.max(0, 1 - elapsed / duration)
      context.fillStyle = particle.color
      context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height)
      context.restore()
    }

    if (elapsed < duration) {
      frameId = window.requestAnimationFrame(render)
    } else {
      context.clearRect(0, 0, canvas.width, canvas.height)
      running = false
    }
  }

  frameId = window.requestAnimationFrame(render)

  return () => {
    running = false
    window.cancelAnimationFrame(frameId)
    context.clearRect(0, 0, canvas.width, canvas.height)
  }
}

export function sizeCanvasToParent(canvas) {
  const parent = canvas.parentElement
  if (!parent) return

  const rect = parent.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.floor(rect.width * ratio))
  canvas.height = Math.max(1, Math.floor(rect.height * ratio))
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
}
