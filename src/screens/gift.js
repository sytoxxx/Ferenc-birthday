import { el } from '../lib/dom.js'
import { getOwnerGiftReveal } from '../app/owner-content.js'
import { burstConfetti, sizeCanvasToParent } from '../lib/confetti.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { createButton } from '../ui/button.js'

const OPEN_MS = 3400

let stopConfetti = () => {}
let openTimers = []

function clearOpenTimers() {
  openTimers.forEach((id) => window.clearTimeout(id))
  openTimers = []
}

function later(fn, ms) {
  const id = window.setTimeout(fn, ms)
  openTimers.push(id)
  return id
}

function setPageCelebrating(isCelebrating) {
  document.documentElement.classList.toggle('is-celebrating', isCelebrating)
}

export function settleGiftCelebration() {
  clearOpenTimers()
  setPageCelebrating(false)
}

export function resetGiftState() {
  stopConfetti()
  settleGiftCelebration()
}

function renderLockedGift({ i18n }) {
  return el('section', { className: 'screen screen--gift-locked' }, [
    el('p', { className: 'eyebrow', textContent: i18n.t('gift.kicker') }),
    el('h1', { className: 'section-title', textContent: i18n.t('gift.locked') }),
    el('p', { className: 'support', textContent: i18n.t('gift.lockedLead') }),
  ])
}

function renderReveal({ i18n, session }) {
  const reveal = getOwnerGiftReveal(session, i18n)
  if (!reveal) {
    return renderLockedGift({ i18n })
  }

  return el('section', { className: 'screen screen--gift screen--reveal' }, [
    el('p', { className: 'eyebrow eyebrow--reveal', textContent: i18n.t('brand.name') }),
    el('p', { className: 'age-display', textContent: i18n.t('brand.age') }),
    el('h1', { className: 'reveal-wish', textContent: reveal.wish }),
  ])
}

export function renderGift({ i18n, session, router }) {
  if (!session.isOwner()) {
    settleGiftCelebration()
    return renderLockedGift({ i18n })
  }

  if (session.hasOpenedGift()) {
    settleGiftCelebration()
    return renderReveal({ i18n, session })
  }

  const reducedMotion = prefersReducedMotion()
  const reveal = getOwnerGiftReveal(session, i18n)

  const canvas = el('canvas', {
    className: 'gift-confetti',
    'aria-hidden': 'true',
  })

  const box = el('div', { className: 'gift-box', 'aria-hidden': 'true' }, [
    el('span', { className: 'gift-box__shadow' }),
    el('span', { className: 'gift-box__reflection' }),
    el('span', { className: 'gift-box__lid' }, [
      el('span', { className: 'gift-box__bow' }),
      el('span', { className: 'gift-box__lid-face' }),
    ]),
    el('span', { className: 'gift-box__body' }, [
      el('span', { className: 'gift-box__glow' }),
      el('span', { className: 'gift-box__beam' }),
      el('span', { className: 'gift-box__shine' }),
      el('span', { className: 'gift-box__ribbon-v' }),
      el('span', { className: 'gift-box__ribbon-h' }),
    ]),
  ])

  const cinematicAge = el('p', {
    className: 'gift-cinematic__age',
    textContent: i18n.t('brand.age'),
    'aria-hidden': 'true',
  })
  const cinematicWish = el('p', {
    className: 'gift-cinematic__wish',
    textContent: reveal?.wish || '',
    'aria-hidden': 'true',
  })

  const openButton = createButton({
    label: i18n.t('gift.openLabel'),
    variant: 'primary',
    className: 'gift-open',
    ariaExpanded: 'false',
  })

  const ready = el('p', { className: 'gift-ready', textContent: i18n.t('gift.ready') })

  const stage = el('div', { className: 'gift-stage' }, [
    el('span', { className: 'gift-ambient', 'aria-hidden': 'true' }),
    el('span', { className: 'gift-flash', 'aria-hidden': 'true' }),
    canvas,
    box,
    cinematicAge,
    cinematicWish,
  ])

  const section = el('section', { className: 'screen screen--gift' }, [
    el('span', { className: 'gift-veil', 'aria-hidden': 'true' }),
    el('p', { className: 'eyebrow', textContent: i18n.t('gift.kicker') }),
    ready,
    el('h1', { className: 'visually-hidden', textContent: i18n.t('gift.nav') }),
    stage,
    openButton,
  ])

  const finishOpen = () => {
    session.markGiftOpened()
    if (typeof router.refresh === 'function') {
      router.refresh()
    }
  }

  const openGift = () => {
    if (session.hasOpenedGift() || section.classList.contains('is-opening-seq')) return

    section.classList.add('is-opening-seq', 'is-focus')
    stage.classList.add('is-focus')
    box.classList.add('is-pressed', 'is-focus')
    openButton.disabled = true
    openButton.setAttribute('aria-expanded', 'true')
    setPageCelebrating(true)

    if (reducedMotion) {
      section.classList.add('is-age', 'is-wish')
      later(finishOpen, 420)
      return
    }

    later(() => box.classList.remove('is-pressed'), 140)

    later(() => {
      section.classList.add('is-tension')
      stage.classList.add('is-tension')
      box.classList.add('is-tension')
    }, 180)

    later(() => {
      section.classList.add('is-opening')
      stage.classList.add('is-opening', 'is-open')
      box.classList.add('is-opening', 'is-open', 'is-celebrating')
    }, 520)

    later(() => {
      section.classList.add('is-peak')
      stage.classList.add('is-peak', 'is-celebrating')
      box.classList.add('is-peak')
    }, 1380)

    later(() => {
      section.classList.add('is-burst')
      stage.classList.add('is-burst')
      box.classList.add('is-burst')
      sizeCanvasToParent(canvas)
      stopConfetti = burstConfetti(canvas, { duration: 1800, count: 36, originX: 0.5, originY: 0.44 })
    }, 1680)

    later(() => {
      section.classList.add('is-transform')
      stage.classList.add('is-transform')
      box.classList.add('is-transform')
    }, 2140)

    later(() => {
      section.classList.add('is-age')
      stage.classList.add('is-age')
    }, 2460)

    later(() => {
      section.classList.add('is-wish')
      stage.classList.add('is-wish')
    }, 2920)

    later(() => {
      setPageCelebrating(false)
      finishOpen()
    }, OPEN_MS)
  }

  openButton.addEventListener('click', openGift)
  box.addEventListener('click', openGift)

  return section
}
