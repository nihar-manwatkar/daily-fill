/**
 * Vercel Serverless — Trigger Vercel redeploy via Deploy Hook
 * Requires X-Admin-Password header matching ADMIN_PASSWORD env
 * Set VERCEL_DEPLOY_HOOK_URL in Vercel env (from Project Settings → Git → Deploy Hooks)
 */
const ADMIN_PW = process.env.ADMIN_PASSWORD || 'dailyfill2026'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-Admin-Password')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const pw = req.headers['x-admin-password'] || ''
  if (pw !== ADMIN_PW) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL
  if (!hookUrl) {
    return res.status(500).json({
      error: 'Deploy hook not configured. Add VERCEL_DEPLOY_HOOK_URL in Vercel project env.',
    })
  }

  try {
    const r = await fetch(hookUrl, { method: 'POST' })
    if (!r.ok) throw new Error(`Deploy hook returned ${r.status}`)
    const data = await r.json().catch(() => ({}))
    return res.status(200).json({ ok: true, job: data })
  } catch (err) {
    console.error('Deploy hook error:', err)
    return res.status(500).json({ error: err.message })
  }
}
