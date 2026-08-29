/**
 * Private owner gift content.
 * Only an owner session may read this helper.
 */
export function getOwnerGiftReveal(session, i18n) {
  if (!session || typeof session.isOwner !== 'function' || !session.isOwner()) {
    return null
  }

  return {
    wish: i18n.t('gift.revealWish'),
  }
}
