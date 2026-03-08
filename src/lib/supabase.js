/**
 * Supabase client for DailyFill.
 * When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, returns a configured client.
 * Otherwise returns null (app falls back to localStorage).
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const isSupabaseConfigured = () => !!supabase
