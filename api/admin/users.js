/**
 * Vercel Serverless — Admin users list (Supabase service role)
 * Requires X-Admin-Password header matching ADMIN_PASSWORD env
 */
import { createClient } from '@supabase/supabase-js'

const ADMIN_PW = process.env.ADMIN_PASSWORD || 'dailyfill2026'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const pw = req.headers['x-admin-password'] || ''
  if (pw !== ADMIN_PW) {
    return res.status(401).json({ error: 'Unauthorized', users: [] })
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase not configured', users: [] })
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const today = new Date().toISOString().slice(0, 10)

  try {
    const { data: profiles, error: pe } = await supabase
      .from('profiles')
      .select('id, email, username, created_at')
      .order('created_at', { ascending: false })
    if (pe) throw pe

    const { data: scores } = await supabase.from('scores').select('user_id, puzzle_date, score, completed_correct')
    const scoresByUser = {}
    for (const s of scores || []) {
      if (!scoresByUser[s.user_id]) scoresByUser[s.user_id] = { games: 0, total: 0, best: 0, lastActive: '' }
      scoresByUser[s.user_id].games++
      scoresByUser[s.user_id].total += s.score
      scoresByUser[s.user_id].best = Math.max(scoresByUser[s.user_id].best, s.score)
      const d = s.puzzle_date?.slice(0, 10)
      if (d && (!scoresByUser[s.user_id].lastActive || d > scoresByUser[s.user_id].lastActive)) {
        scoresByUser[s.user_id].lastActive = d
      }
    }

    const users = (profiles || []).map(p => {
      const stats = scoresByUser[p.id] || { games: 0, total: 0, best: 0, lastActive: p.created_at?.slice(0, 10) || today }
      return {
        id: p.id,
        username: p.username || '—',
        email: p.email,
        phone: p.email,
        joined: p.created_at?.slice(0, 10) || today,
        games: stats.games,
        bestScore: stats.best,
        avgScore: stats.games > 0 ? Math.round(stats.total / stats.games) : 0,
        lastActive: stats.lastActive || today,
      }
    })

    return res.status(200).json({ ok: true, users })
  } catch (err) {
    console.error('Admin users error:', err)
    return res.status(500).json({ error: err.message, users: [] })
  }
}
