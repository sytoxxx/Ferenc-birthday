/**
 * Private owner gift content.
 * Only an authenticated owner session may read this helper.
 */
export function getOwnerGiftReveal(session, i18n) {
  if (!session || typeof session.isOwner !== 'function' || !session.isOwner()) {
    return null
  }

  return {
    wish: i18n.t('gift.revealWish'),
    message: i18n.t('gift.message'),
    signOff: i18n.t('gift.signOff'),
    note: i18n.t('gift.note'),
  }
}
