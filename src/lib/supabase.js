import { createClient } from '@supabase/supabase-js'

let client = null

function readPublicConfig() {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
  // Dashboard "publishable" and classic "anon" keys are the same public browser key.
  const publishableKey = String(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  ).trim()

  return { url, publishableKey }
}

export function isSupabaseConfigured() {
  const { url, publishableKey } = readPublicConfig()
  return Boolean(url && publishableKey)
}

/**
 * Browser-safe Supabase client.
 * Uses only the public URL and publishable/anon key.
 * Never import a service_role or secret key in frontend code.
 * Shared by photos, messages, and owner auth.
 */
export function getSupabaseClient() {
  if (client) {
    return client
  }

  const { url, publishableKey } = readPublicConfig()

  if (!url || !publishableKey) {
    return null
  }

  client = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}
