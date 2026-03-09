/**
 * Vercel Serverless — Delete user (Supabase Auth Admin)
 * Requires X-Admin-Password header matching ADMIN_PASSWORD env
 */
import { createClient } from '@supabase/supabase-js'

const ADMIN_PW = process.env.ADMIN_PASSWORD || 'dailyfill2026'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const pw = req.headers['x-admin-password'] || ''
  if (pw !== ADMIN_PW) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const { userId } = req.body || {}
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId required' })
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  try {
    // Delete related records first (scores → profiles) to avoid FK constraint failures
    // that can occur with auth.admin.deleteUser even when cascade is configured
    const { error: scoresErr } = await supabase.from('scores').delete().eq('user_id', userId)
    if (scoresErr) console.warn('Scores delete warning:', scoresErr)

    const { error: profilesErr } = await supabase.from('profiles').delete().eq('id', userId)
    if (profilesErr) console.warn('Profiles delete warning:', profilesErr)

    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) throw error
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Delete user error:', err)
    return res.status(500).json({ error: err.message })
  }
}
