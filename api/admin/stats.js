/**
 * Vercel Serverless — Admin puzzle stats (Supabase)
 * Returns per-date stats: attempts, completions, avgScore, perfect, etc.
 */
import { createClient } from '@supabase/supabase-js'

const ADMIN_PW = process.env.ADMIN_PASSWORD || 'dailyfill2026'
const LAUNCH_DATE = '2026-03-07'

function getIstToday() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return ist.toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const pw = req.headers['x-admin-password'] || ''
  if (pw !== ADMIN_PW) {
    return res.status(401).json({ error: 'Unauthorized', stats: {} })
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase not configured', stats: {} })
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  try {
    const { data: scores, error } = await supabase
      .from('scores')
      .select('puzzle_date, score, completed_correct')
    if (error) throw error

    const byDate = {}
    for (const s of scores || []) {
      const d = s.puzzle_date?.slice(0, 10)
      if (!d) continue
      if (!byDate[d]) byDate[d] = { attempts: 0, completions: 0, totalScore: 0, perfect: 0 }
      byDate[d].attempts++
      byDate[d].completions++
      byDate[d].totalScore += s.score
      if (s.completed_correct) byDate[d].perfect++
    }

    const today = getIstToday()
    const dates = []
    let cur = new Date(today + 'T00:00:00Z')
    const launch = new Date(LAUNCH_DATE + 'T00:00:00Z')
    let dayNum = Math.round((cur - launch) / 86400000) + 1
    while (cur >= launch) {
      const d = cur.toISOString().slice(0, 10)
      const s = byDate[d] || { attempts: 0, completions: 0, totalScore: 0, perfect: 0 }
      dates.push({
        date: d,
        day: dayNum,
        attempts: s.attempts,
        completions: s.completions,
        avgScore: s.completions > 0 ? Math.round(s.totalScore / s.completions) : 0,
        perfect: s.perfect,
        avgTimeMin: 0,
      })
      cur.setUTCDate(cur.getUTCDate() - 1)
      dayNum--
    }

    return res.status(200).json({ ok: true, stats: dates })
  } catch (err) {
    console.error('Admin stats error:', err)
    return res.status(500).json({ error: err.message, stats: [] })
  }
}
