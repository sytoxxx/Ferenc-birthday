const prefix = 'ferenc.'

function withPrefix(key) {
  return key.startsWith(prefix) ? key : `${prefix}${key}`
}

export function readString(key) {
  try {
    return window.localStorage.getItem(withPrefix(key))
  } catch {
    return null
  }
}

export function writeString(key, value) {
  try {
    window.localStorage.setItem(withPrefix(key), value)
    return true
  } catch {
    return false
  }
}

export function removeItem(key) {
  try {
    window.localStorage.removeItem(withPrefix(key))
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

export function readJson(key) {
  const raw = readString(key)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function writeJson(key, value) {
  try {
    return writeString(key, JSON.stringify(value))
  } catch {
    return false
  }
}
