import { clear } from '../lib/dom.js'
import { createShell } from '../ui/shell.js'
import { isAppSectionPath, ROUTES } from './router.js'
import { renderLanding } from '../screens/landing.js'
import { renderJoin } from '../screens/join.js'
import { renderOwner } from '../screens/owner.js'
import { renderGift, resetGiftState, settleGiftCelebration } from '../screens/gift.js'
import { renderToday } from '../screens/today.js'
import { renderLive } from '../screens/live.js'
import { renderChallenge } from '../screens/challenge.js'
import { renderTimeCapsule } from '../screens/capsule.js'
import { renderAdmin } from '../screens/admin.js'
import { renderNotFound } from '../screens/not-found.js'
import { createI18n } from '../i18n/index.js'
import { createSession } from './session.js'
import { createRouter } from './router.js'
import { toUserMessage } from '../lib/errors.js'
import { el } from '../lib/dom.js'
import { createButton } from '../ui/button.js'
import { closeAllSheets } from '../ui/sheet.js'
import { closePhotoViewer } from '../ui/photo-viewer.js'

const HIDDEN_NAV_PATHS = new Set([
  ROUTES.landing,
  ROUTES.join,
  ROUTES.owner,
  ROUTES.admin,
])

function resolveScreen(path, ctx) {
  switch (path) {
    case ROUTES.landing:
      return renderLanding(ctx)
    case ROUTES.join:
      return renderJoin(ctx)
    case ROUTES.owner:
    case ROUTES.setup:
    case ROUTES.unlock:
      return renderOwner(ctx)
    case ROUTES.gift:
      return renderGift(ctx)
    case ROUTES.today:
      return renderToday(ctx)
    case ROUTES.live:
      return renderLive(ctx)
    case ROUTES.photo:
    case ROUTES.challenge:
      return renderChallenge(ctx)
    case ROUTES.capsule:
      return renderTimeCapsule(ctx)
    case ROUTES.admin:
      return renderAdmin(ctx)
    default:
      return renderNotFound(ctx)
  }
}

function resolveRedirect(path, session) {
  if (path === ROUTES.setup || path === ROUTES.unlock || path === ROUTES.owner) {
    if (session.isOwner()) return ROUTES.gift
    if (session.isParticipant()) return ROUTES.today
    return ROUTES.landing
  }

  if (path === ROUTES.landing && session.isParticipant() && !session.isOwner()) {
    return ROUTES.today
  }

  if (path === ROUTES.join && session.getParticipant()) {
    return session.isOwner() ? ROUTES.gift : ROUTES.today
  }

  if (path === ROUTES.photo) {
    return ROUTES.challenge
  }

  if (path === ROUTES.admin) {
    return null
  }

  if (isAppSectionPath(path) && !session.isParticipant()) {
    return ROUTES.landing
  }

  if (
    session.isOwner() &&
    !session.hasOpenedGift() &&
    isAppSectionPath(path) &&
    path !== ROUTES.gift
  ) {
    return ROUTES.gift
  }

  return null
}

function renderFatalError(root, i18n, error) {
  clear(root)
  root.append(
    el('section', { className: 'screen screen--prepared' }, [
      el('h1', { className: 'section-title', textContent: i18n.t('errors.generic') }),
      el('p', { className: 'prose', textContent: toUserMessage(error, i18n) }),
      createButton({
        label: i18n.t('notFound.home'),
        variant: 'primary',
        onClick: () => {
          window.location.assign(ROUTES.landing)
        },
      }),
    ]),
  )
}

export function renderApp(root, ctx) {
  const { session, router, i18n } = ctx

  const path = router.getPath()
  const redirect = resolveRedirect(path, session)
  if (redirect && redirect !== path) {
    router.replace(redirect)
    return
  }

  closeAllSheets()
  closePhotoViewer()

  if (path !== ROUTES.gift) {
    settleGiftCelebration()
  }

  if (!session.isParticipant()) {
    resetGiftState()
  }

  const showNav =
    session.isParticipant() &&
    !HIDDEN_NAV_PATHS.has(path) &&
    (session.isOwner() ? session.hasOpenedGift() : true)

  const shell = createShell({
    i18n,
    session,
    router,
    currentPath: path,
    showNav,
    cinematic: !showNav,
  })

  const screen = resolveScreen(path, ctx)
  shell.main.append(screen)
  clear(root)
  root.append(shell.root)
}

export function startApp(root) {
  const i18n = createI18n()
  const session = createSession()
  const router = createRouter()
  const ctx = { i18n, session, router }

  const render = () => {
    try {
      renderApp(root, ctx)
    } catch (error) {
      renderFatalError(root, i18n, error)
    }
  }

  i18n.subscribe(render)
  router.subscribe(render)
  render()
}
