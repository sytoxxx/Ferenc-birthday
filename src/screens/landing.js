import { el } from '../lib/dom.js'
import { ROUTES } from '../app/router.js'
import { getOwnerAuthState, OWNER_AUTH_STATUS } from '../app/owner-auth.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { applyIntroSequence } from '../ui/intro.js'
import { createChoiceCard } from '../ui/button.js'

const INTRO_FLAG = 'ferenc.introDone'

let introState = 'pending'
let welcomeTimer = 0

function readIntroDone() {
  try {
    return window.sessionStorage.getItem(INTRO_FLAG) === '1'
  } catch {
    return false
  }
}

function markIntroDone() {
  introState = 'done'
  try {
    window.sessionStorage.setItem(INTRO_FLAG, '1')
  } catch {
    // Private browsing can block sessionStorage.
  }
}

function goToOwner({ router }) {
  const auth = getOwnerAuthState()
  if (auth.status === OWNER_AUTH_STATUS.authenticated) {
    router.navigate(ROUTES.gift)
    return
  }
  router.navigate(ROUTES.owner)
}

function goToParticipant({ session, router }) {
  if (session.getParticipant() && !session.isOwner()) {
    router.navigate(ROUTES.today)
    return
  }
  router.navigate(ROUTES.join)
}

function renderIdentity(ctx, { withCinematic = false, compact = false } = {}) {
  const { i18n } = ctx
  const question = el('p', {
    className: 'question',
    textContent: i18n.t('landing.question'),
  })

  const identity = el('div', { className: 'intro-identity' }, [
    el('h1', { className: 'landing-welcome', textContent: i18n.t('landing.welcome') }),
    el('p', { className: 'landing-subtitle', textContent: i18n.t('landing.subtitle') }),
    question,
    el('div', { className: 'choice-grid' }, [
      createChoiceCard({
        label: i18n.t('landing.choiceOwner'),
        onClick: () => goToOwner(ctx),
      }),
      createChoiceCard({
        label: i18n.t('landing.choiceParticipant'),
        onClick: () => goToParticipant(ctx),
      }),
    ]),
  ])

  const cinematic = el('div', { className: 'intro-stage', 'aria-hidden': 'true' }, [
    el('span', { className: 'intro-ambient', 'aria-hidden': 'true' }),
    el('p', { className: 'intro-date', textContent: i18n.t('intro.date') }),
    el('h1', { className: 'intro-name', textContent: i18n.t('brand.name') }),
    el('p', { className: 'intro-age', textContent: i18n.t('brand.age') }),
    el('p', { className: 'intro-line', textContent: i18n.t('intro.line') }),
  ])

  const section = el('section', { className: 'screen screen--landing' }, [cinematic, identity])

  if (!withCinematic) {
    if (compact) {
      section.classList.add('is-identity', 'is-settled')
      cinematic.setAttribute('aria-hidden', 'true')
    } else {
      section.classList.add('is-light', 'is-date', 'is-name', 'is-age', 'is-line', 'is-identity', 'is-static')
    }
    return section
  }

  introState = 'running'
  applyIntroSequence(section, {
    onComplete: () => {
      markIntroDone()
    },
  })

  return section
}

function renderWelcomeBack({ i18n, router }) {
  const section = el('section', { className: 'screen screen--welcome-back' }, [
    el('p', { className: 'eyebrow', textContent: i18n.t('brand.name') }),
    el('h1', { className: 'display-title', textContent: i18n.t('owner.welcomeBack') }),
  ])

  window.clearTimeout(welcomeTimer)
  const delay = prefersReducedMotion() ? 60 : 1320
  welcomeTimer = window.setTimeout(() => {
    if (!section.isConnected) return
    router.replace(ROUTES.gift)
  }, delay)

  return section
}

export function renderLanding(ctx) {
  const auth = getOwnerAuthState()
  if (auth.status === OWNER_AUTH_STATUS.authenticated) {
    return renderWelcomeBack(ctx)
  }

  const alreadyPlayed = introState === 'done' || introState === 'running' || readIntroDone()

  if (alreadyPlayed) {
    markIntroDone()
    return renderIdentity(ctx, { withCinematic: false, compact: true })
  }

  if (prefersReducedMotion()) {
    markIntroDone()
    return renderIdentity(ctx, { withCinematic: false, compact: false })
  }

  return renderIdentity(ctx, { withCinematic: true })
}
