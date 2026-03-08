/**
 * User API — Supabase backend.
 * All user operations go through this layer when Supabase is configured.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

/** Returns true if email is already registered */
export async function isEmailRegistered(email) {
  if (!isSupabaseConfigured()) return false
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalizeEmail(email))
    .maybeSingle()
  if (error) throw error
  return !!data
}

/** Returns { username } for login, or null */
export async function getUserByEmail(email) {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from('users')
    .select('username')
    .eq('email', normalizeEmail(email))
    .maybeSingle()
  if (error) throw error
  return data ? { username: data.username } : null
}

/** Returns true if alias is taken (case-insensitive) */
export async function isAliasTaken(alias) {
  if (!isSupabaseConfigured()) return false
  const normalized = (alias || '').trim()
  if (!normalized) return false
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .ilike('username', normalized)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

/** Create new user. Throws on duplicate email/username. */
export async function createUser(email, { username }) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('users')
    .insert({
      email: normalizeEmail(email),
      username: username.trim(),
    })
    .select('id, username, email, registered_at')
    .single()
  if (error) throw error
  return data
}

/** Get all users for Admin dashboard */
export async function getUsersForAdmin() {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('users')
    .select('id, email, username, registered_at')
    .order('registered_at', { ascending: false })
  if (error) throw error
  const today = new Date().toISOString().slice(0, 10)
  return (data || []).map(u => ({
    id: u.id,
    username: u.username || '—',
    email: u.email,
    phone: u.email,
    joined: u.registered_at ? u.registered_at.slice(0, 10) : today,
    games: 0,
    bestScore: 0,
    avgScore: 0,
    lastActive: u.registered_at ? u.registered_at.slice(0, 10) : today,
  }))
}
