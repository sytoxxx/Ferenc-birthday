export class AppError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

export function toUserMessage(error, i18n) {
  if (error instanceof AppError) {
    const translated = i18n.t(`errors.${error.code}`)
    if (translated && translated !== `errors.${error.code}`) {
      return translated
    }
  }

  return i18n.t('errors.generic')
}

export function createLiveRegion({ polite = true } = {}) {
  const region = document.createElement('p')
  region.className = 'live-region'
  region.setAttribute('role', polite ? 'status' : 'alert')
  region.setAttribute('aria-live', polite ? 'polite' : 'assertive')
  region.setAttribute('aria-atomic', 'true')
  return region
}

export function announce(region, message) {
  if (!region) return
  region.textContent = message || ''
}
