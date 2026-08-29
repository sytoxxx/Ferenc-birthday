import { readString, writeString } from '../lib/storage.js'
import de from './de.js'
import en from './en.js'

export const SUPPORTED_LOCALES = ['de', 'en']
export const DEFAULT_LOCALE = 'de'
export const LOCALE_STORAGE_KEY = 'locale'

const dictionaries = { de, en }

function normalizeLocaleTag(tag) {
  if (!tag || typeof tag !== 'string') return ''
  return tag.trim().toLowerCase().replace('_', '-')
}

function primaryLanguage(tag) {
  return normalizeLocaleTag(tag).split('-')[0]
}

export function isSupportedLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale)
}

/**
 * Maps browser locales such as de-AT, de-DE, en-US, en-GB
 * onto the supported languages. Unsupported languages fall back to German.
 */
export function detectBrowserLocale() {
  const candidates = []

  if (Array.isArray(navigator.languages)) {
    candidates.push(...navigator.languages)
  }

  if (navigator.language) {
    candidates.push(navigator.language)
  }

  for (const tag of candidates) {
    const language = primaryLanguage(tag)
    if (isSupportedLocale(language)) {
      return language
    }
  }

  return DEFAULT_LOCALE
}

function lookup(dictionary, key) {
  return key.split('.').reduce((value, part) => {
    if (value && typeof value === 'object' && part in value) {
      return value[part]
    }
    return undefined
  }, dictionary)
}

function interpolate(template, vars) {
  if (!vars || typeof template !== 'string') return template
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return String(vars[name])
    }
    return match
  })
}

export function createI18n() {
  const saved = readString(LOCALE_STORAGE_KEY)
  if (saved === 'hu') {
    writeString(LOCALE_STORAGE_KEY, DEFAULT_LOCALE)
  }
  const normalizedSaved = saved === 'hu' ? DEFAULT_LOCALE : saved
  let locale = isSupportedLocale(normalizedSaved) ? normalizedSaved : detectBrowserLocale()
  const listeners = new Set()

  const applyDocumentLanguage = () => {
    document.documentElement.lang = locale
    const title = lookup(dictionaries[locale], 'meta.title')
    const description = lookup(dictionaries[locale], 'meta.description')
    if (typeof title === 'string') {
      document.title = title
    }

    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.append(meta)
    }
    if (typeof description === 'string') {
      meta.setAttribute('content', description)
    }
  }

  applyDocumentLanguage()

  return {
    getLocale() {
      return locale
    },
    t(key, vars) {
      const value = lookup(dictionaries[locale], key)
      if (typeof value !== 'string') {
        return key
      }
      return interpolate(value, vars)
    },
    setLocale(nextLocale) {
      if (!isSupportedLocale(nextLocale) || nextLocale === locale) {
        return
      }

      locale = nextLocale
      writeString(LOCALE_STORAGE_KEY, locale)
      applyDocumentLanguage()
      listeners.forEach((listener) => listener(locale))
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
