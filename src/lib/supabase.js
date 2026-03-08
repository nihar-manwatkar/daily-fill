/**
 * Supabase client for DailyFill.
 * When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, returns a configured client.
 * Otherwise returns null (app falls back to localStorage).
 */
import { createClient } from '@supabase/supabase-js'

let supabase = null
try {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim()
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (url && anonKey) supabase = createClient(url, anonKey)
} catch (e) {
  console.warn('Supabase init failed:', e.message)
}

export { supabase }
export const isSupabaseConfigured = () => !!supabase
