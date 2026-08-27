export const ROUTES = {
  landing: '/',
  join: '/join',
  owner: '/owner',
  setup: '/setup',
  unlock: '/unlock',
  gift: '/gift',
  today: '/today',
  live: '/live',
  photo: '/photo-of-the-day',
  challenge: '/challenge',
  capsule: '/time-capsule',
  admin: '/admin',
}

export const APP_SECTIONS = [
  { id: 'gift', path: ROUTES.gift, labelKey: 'gift.nav', ownerOnly: true },
  { id: 'today', path: ROUTES.today, labelKey: 'today.nav' },
  { id: 'live', path: ROUTES.live, labelKey: 'live.nav' },
  { id: 'challenge', path: ROUTES.challenge, labelKey: 'challenge.nav' },
  { id: 'capsule', path: ROUTES.capsule, labelKey: 'capsule.nav' },
]

const KNOWN_PATHS = new Set(Object.values(ROUTES))

export function visibleAppSections(isOwner) {
  return APP_SECTIONS.filter((section) => !section.ownerOnly || isOwner)
}

export function isAppSectionPath(path) {
  return APP_SECTIONS.some((section) => section.path === path)
}

export function normalizePath(pathname) {
  if (!pathname || pathname === '') return ROUTES.landing
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export function isKnownPath(path) {
  return KNOWN_PATHS.has(path)
}

export function createRouter() {
  const listeners = new Set()

  const notify = () => {
    listeners.forEach((listener) => listener(normalizePath(window.location.pathname)))
  }

  window.addEventListener('popstate', notify)

  const go = (path, { replace = false } = {}) => {
    const next = normalizePath(path)
    const current = normalizePath(window.location.pathname)
    if (next === current) return

    if (replace) {
      window.history.replaceState({}, '', next)
    } else {
      window.history.pushState({}, '', next)
    }

    notify()
  }

  return {
    getPath() {
      return normalizePath(window.location.pathname)
    },
    navigate(path) {
      go(path, { replace: false })
    },
    replace(path) {
      go(path, { replace: true })
    },
    refresh() {
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
