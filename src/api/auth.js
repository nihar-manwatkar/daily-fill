/**
 * Auth API — Supabase Auth when configured, else Express server fallback
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

const API = '/api'

async function fetchJson(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Request failed')
  return data
}

/** Check if email exists in system */
export async function checkEmailExists(email) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.rpc('check_email_exists', {
      check_email: String(email || '').trim().toLowerCase(),
    })
    if (error) throw error
    return !!data
  }
  const data = await fetchJson(`${API}/auth/check-email`, {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  })
  return data.exists
}

/** Register new user — returns { id?, email, username } when Supabase (only when session exists, i.e. email confirmation disabled) */
export async function register(email, password, username) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { username: username.trim() } },
    })
    if (error) throw error
    if (data?.user && data?.session) {
      const uname = data.user.user_metadata?.username || username.trim()
      return {
        id: data.user.id,
        email: data.user.email || email.trim().toLowerCase(),
        username: uname,
      }
    }
    if (data?.user) return {} // Email confirmation required
    return {}
  }
  await fetchJson(`${API}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      username: username.trim(),
    }),
  })
}

/** Login returning user — returns { id?, email, username } */
export async function login(email, password) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
    const userId = data.user?.id
    if (!userId) throw new Error('Login failed')
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()
    return {
      id: userId,
      email: email.trim().toLowerCase(),
      username: profile?.username || 'user',
    }
  }
  const data = await fetchJson(`${API}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  })
  return { email: email.trim().toLowerCase(), username: data.username }
}

/** Request password reset email (Supabase sends the link) */
export async function requestPasswordReset(email) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}${window.location.pathname}#recovery`,
    })
    if (error) throw error
    return
  }
  throw new Error('Password reset requires Supabase. Use the Express server for local dev.')
}

/** Set new password after recovery link (call when URL has type=recovery) */
export async function updatePassword(newPassword) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

/** Reset password (forgot password flow) — Express fallback only */
export async function resetPassword(email, newPassword) {
  if (isSupabaseConfigured()) {
    throw new Error('Use requestPasswordReset for Supabase. Recovery link will be sent to your email.')
  }
  await fetchJson(`${API}/auth/reset-password`, {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      newPassword,
    }),
  })
}

/** Check if alias is taken */
export async function isAliasTaken(alias) {
  if (isSupabaseConfigured()) {
    const normalized = (alias || '').trim()
    if (!normalized) return false
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', normalized)
      .limit(1)
    if (error) throw error
    return (data?.length ?? 0) > 0
  }
  const data = await fetchJson(
    `${API}/auth/alias-taken?alias=${encodeURIComponent((alias || '').trim())}`
  )
  return data.taken
}

/** Get users for Admin dashboard — uses API when Supabase (needs service role for full stats). Pass adminPassword when Supabase. */
export async function getRegisteredUsersForAdmin(adminPassword = '') {
  if (isSupabaseConfigured()) {
    try {
      const r = await fetch('/api/admin/users', {
        headers: { 'X-Admin-Password': adminPassword || '' },
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Failed to fetch users')
      return data.users || []
    } catch (e) {
      console.warn('Admin users API failed, falling back to profiles:', e.message)
      const { data, error } = await supabase.from('profiles').select('id, email, username, created_at')
      if (error) throw error
      const today = new Date().toISOString().slice(0, 10)
      return (data || []).map(u => ({
        id: u.id,
        username: u.username || '—',
        email: u.email,
        phone: u.email,
        joined: u.created_at?.slice(0, 10) || today,
        games: 0,
        bestScore: 0,
        avgScore: 0,
        lastActive: u.created_at?.slice(0, 10) || today,
      }))
    }
  }
  const data = await fetchJson(`${API}/auth/users`)
  return (data.users || []).map(u => ({ ...u, phone: u.email }))
}

/** Delete user (Admin only) — requires admin password. Uses Supabase Auth Admin when configured. */
export async function deleteUserForAdmin(userId, adminPassword = '') {
  const r = await fetch('/api/admin/delete-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': adminPassword || '',
    },
    body: JSON.stringify({ userId }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Failed to delete user')
  return data
}

/** Trigger Vercel redeploy (Admin only) — requires admin password and VERCEL_DEPLOY_HOOK_URL env. */
export async function triggerDeployForAdmin(adminPassword = '') {
  const r = await fetch('/api/admin/deploy', {
    method: 'POST',
    headers: { 'X-Admin-Password': adminPassword || '' },
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Failed to trigger deploy')
  return data
}
