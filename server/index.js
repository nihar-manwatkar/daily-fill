/**
 * DailyFill Auth backend — Email + Password
 * Run: node server/index.js (or npm run server)
 */
import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPaths = [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(process.cwd(), '.env'),
]
for (const p of envPaths) {
  const r = config({ path: p })
  if (r?.parsed) break
}

const app = express()
app.use(cors({ origin: true }))
app.use(express.json())

const PORT = process.env.PORT || 3001
const DATA_DIR = path.resolve(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function loadUsers() {
  ensureDataDir()
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveUsers(users) {
  ensureDataDir()
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8')
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

/** POST /api/auth/check-email — Returns { exists: boolean } */
app.post('/api/auth/check-email', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email address' })
  }
  const users = loadUsers()
  res.json({ ok: true, exists: !!users[email] })
})

/** POST /api/auth/register — New user: email, password, username */
app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const username = String(req.body?.username || '').trim()

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email address' })
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' })
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ ok: false, error: 'Username must be 3–20 characters' })
  }

  const users = loadUsers()
  if (users[email]) {
    return res.status(400).json({ ok: false, error: 'Email already registered' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  users[email] = {
    passwordHash,
    username,
    registeredAt: new Date().toISOString().slice(0, 10),
  }
  saveUsers(users)
  res.json({ ok: true })
})

/** POST /api/auth/login — Returning user: email, password */
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email address' })
  }

  const users = loadUsers()
  const user = users[email]
  if (!user) {
    return res.status(400).json({ ok: false, error: 'Email not found' })
  }

  const match = await bcrypt.compare(password, user.passwordHash)
  if (!match) {
    return res.status(400).json({ ok: false, error: 'Incorrect password' })
  }

  res.json({ ok: true, username: user.username })
})

/** POST /api/auth/reset-password — Forgot password: email, newPassword */
app.post('/api/auth/reset-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const newPassword = String(req.body?.newPassword || '')

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email address' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' })
  }

  const users = loadUsers()
  const user = users[email]
  if (!user) {
    return res.status(400).json({ ok: false, error: 'Email not found' })
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10)
  saveUsers(users)
  res.json({ ok: true })
})

/** GET /api/auth/alias-taken?alias=xxx — Check if alias is taken */
app.get('/api/auth/alias-taken', (req, res) => {
  const alias = String(req.query?.alias || '').trim().toLowerCase()
  if (!alias) return res.json({ ok: true, taken: false })

  const users = loadUsers()
  const taken = Object.values(users).some(
    u => (u.username || '').toLowerCase() === alias
  )
  res.json({ ok: true, taken })
})

/** GET /api/auth/users — Admin: list all users (no auth for dev) */
app.get('/api/auth/users', (req, res) => {
  const users = loadUsers()
  const today = new Date().toISOString().slice(0, 10)
  const list = Object.entries(users).map(([email, data]) => ({
    id: `user-${email}`,
    email,
    username: data.username || '—',
    joined: data.registeredAt || today,
    lastActive: data.registeredAt || today,
    games: 0,
    bestScore: 0,
    avgScore: 0,
  }))
  res.json({ ok: true, users: list })
})

const server = app.listen(PORT, () => {
  console.log(`DailyFill auth server on http://localhost:${PORT}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use. Stop the other process first:`)
    console.error(`   netstat -ano | findstr ":${PORT}"  then  taskkill /PID <pid> /F\n`)
  } else {
    console.error('Server error:', err)
  }
  process.exit(1)
})
