import { el } from '../lib/dom.js'
import { ROUTES } from '../app/router.js'

export function renderOwner({ session, router }) {
  if (session.isOwner()) {
    router.replace(ROUTES.gift)
  } else if (session.isParticipant()) {
    router.replace(ROUTES.today)
  } else {
    router.replace(ROUTES.landing)
  }

  return el('section', { className: 'screen screen--owner' })
}
