// ─── UTILITY HELPERS ─────────────────────────────────────────────────────────

/** Returns IST date as 'YYYY-MM-DD' string (reliable across timezones) */
export function getIstDateStr() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  const y = parts.find(p => p.type === 'year').value
  const m = parts.find(p => p.type === 'month').value
  const d = parts.find(p => p.type === 'day').value
  return `${y}-${m}-${d}`
}

/** Returns IST date string for today + N days (0 = today, 1 = tomorrow, etc.) */
export function getIstDatePlusDays(days) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const d = new Date(Date.now() + days * 86400000)
  const parts = formatter.formatToParts(d)
  const y = parts.find(p => p.type === 'year').value
  const m = parts.find(p => p.type === 'month').value
  const day = parts.find(p => p.type === 'day').value
  return `${y}-${m}-${day}`
}

const USER_KEY = 'df_user'
const REGISTERED_USERS_KEY = 'df_registered_users'
const DATA_MIGRATION_KEY = 'df_migrated_to_backend_v1'

/** Hash password for storage (SHA-256). Never store plain passwords. */
export async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Verify password against stored hash */
export async function verifyPassword(password, storedHash) {
  const hash = await hashPassword(password)
  return hash === storedHash
}

/** Returns true if alias has valid format: 3–20 chars, letters/numbers/underscores only, not numbers-only */
export function isAliasValid(alias) {
  const s = (alias || '').trim()
  if (s.length < 3 || s.length > 20) return false
  if (!/^[a-zA-Z0-9_]+$/.test(s)) return false
  if (/^\d+$/.test(s)) return false // numbers only
  return true
}

/** Clears user account data from localStorage (df_user, df_registered_users). Run once when migrating to backend. */
export function clearAllUserData() {
  try {
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(REGISTERED_USERS_KEY)
  } catch { /* ignore */ }
}

/** Marks that we've migrated to backend — prevents re-clearing. */
export function markMigratedToBackend() {
  try {
    localStorage.setItem(DATA_MIGRATION_KEY, '1')
  } catch { /* ignore */ }
}

/** Returns the saved user from localStorage, or null. Used to restore session on app load. */
export function getSavedUser() {
  try {
    const s = localStorage.getItem(USER_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

/** Saves the logged-in user to localStorage. Persists across browser sessions — returning users skip auth. */
export function saveUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch { /* storage unavailable */ }
}

// ─── LOCALSTORAGE FALLBACK (when Supabase not configured) ────────────────────
function getRegisteredUsersMap() {
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

/** Sync isEmailRegistered for localStorage fallback */
export function isEmailRegisteredSync(email) {
  const normalized = String(email || '').trim().toLowerCase()
  return !!getRegisteredUsersMap()[normalized]
}

/** Sync isAliasTaken for localStorage fallback */
export function isAliasTakenSync(alias) {
  const normalized = (alias || '').trim().toLowerCase()
  if (!normalized) return false
  const map = getRegisteredUsersMap()
  return Object.values(map).some(u => (u.username || '').toLowerCase() === normalized)
}

/** Sync getRegisteredUserByEmail for localStorage fallback */
export function getRegisteredUserByEmailSync(email) {
  const normalized = String(email || '').trim().toLowerCase()
  return getRegisteredUsersMap()[normalized] || null
}

/** Sync saveRegisteredUser for localStorage fallback */
export function saveRegisteredUserSync(email, { username, registeredAt }) {
  try {
    const map = getRegisteredUsersMap()
    const normalized = String(email || '').trim().toLowerCase()
    const existing = map[normalized] || {}
    map[normalized] = {
      username,
      registeredAt: registeredAt || existing.registeredAt || new Date().toISOString().slice(0, 10),
    }
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(map))
  } catch { /* storage unavailable */ }
}

/** Sync getRegisteredUsersForAdmin for localStorage fallback */
export function getRegisteredUsersForAdminSync() {
  const map = getRegisteredUsersMap()
  const today = new Date().toISOString().slice(0, 10)
  return Object.entries(map).map(([email, data]) => ({
    id: `user-${email}`,
    username: data.username || '—',
    email,
    phone: email,
    joined: data.registeredAt || today,
    games: 0,
    bestScore: 0,
    avgScore: 0,
    lastActive: data.registeredAt || today,
  }))
}

/** localStorage key for once-per-day play lock */
export function playedKey(cat) {
  return `df_played_${cat}_${getIstDateStr()}`
}

// Bump this version string whenever the rules/scoring content changes significantly.
// A version change causes the modal to reappear for all users (including returning ones).
const RULES_SEEN_KEY = 'df_has_seen_rules_v2'

/** Returns true if the user has seen the current version of the rules onboarding modal.
 *  Always returns false in DEV so the modal is testable without clearing localStorage. */
export function hasSeenRules() {
  if (import.meta.env.DEV) return false
  try {
    return localStorage.getItem(RULES_SEEN_KEY) === '1'
  } catch { return false }
}

/** Marks that the user has seen the current rules version.
 *  No-op in DEV so the state never persists during development. */
export function markSeenRules() {
  if (import.meta.env.DEV) return
  try {
    localStorage.setItem(RULES_SEEN_KEY, '1')
  } catch { /* storage unavailable */ }
}

/** Returns true if user has already played this category today (IST) */
export function hasPlayedToday(cat) {
  try { return localStorage.getItem(playedKey(cat)) === '1' } catch { return false }
}

/** Saves that the user has played this category today */
export function markPlayedToday(cat) {
  try { localStorage.setItem(playedKey(cat), '1') } catch { /* storage unavailable */ }
}

/** Saves the current in-progress game state for today (auto-expires at midnight IST) */
export function saveProgress(data) {
  try {
    localStorage.setItem(`df_progress_${getIstDateStr()}`, JSON.stringify(data))
  } catch { /* storage unavailable */ }
}

/** Returns the saved in-progress game state for today, or null if none exists */
export function loadProgress() {
  try {
    const raw = localStorage.getItem(`df_progress_${getIstDateStr()}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** Returns HH:MM:SS countdown until midnight IST */
export function getCountdown() {
  const now = new Date()
  const istMs = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getTime()
  const istDate = new Date(istMs)
  const mid = new Date(istDate)
  mid.setHours(24, 0, 0, 0)
  const d = mid - istDate
  const h = Math.max(0, Math.floor(d / 3600000))
  const m = Math.max(0, Math.floor((d % 3600000) / 60000))
  const s = Math.max(0, Math.floor((d % 60000) / 1000))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Returns the tight bounding box of non-null cells in a grid.
 * { r0, r1, c0, c1 }
 */
export function bounds(grid) {
  if (!grid?.length) return { r0: 0, r1: 0, c0: 0, c1: 0 }
  const cols = grid[0]?.length ?? 0
  let r0 = grid.length, r1 = 0, c0 = cols, c1 = 0
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r]?.length ?? cols); c++) {
      if (grid[r]?.[c]) {
        r0 = Math.min(r0, r); r1 = Math.max(r1, r)
        c0 = Math.min(c0, c); c1 = Math.max(c1, c)
      }
    }
  }
  if (r0 > r1) return { r0: 0, r1: 0, c0: 0, c1: 0 }
  return { r0, r1, c0, c1 }
}

/**
 * Returns { across, down } clue objects that contain cell (r, c).
 */
export function pairFor(puzzle, r, c) {
  const across = puzzle.clues.across.find(
    cl => cl.r === r && c >= cl.c && c < cl.c + cl.len
  ) || null
  const down = puzzle.clues.down.find(
    cl => cl.c === c && r >= cl.r && r < cl.r + cl.len
  ) || null
  return { across, down }
}

/**
 * Returns the clue number that starts at (r, c), or null.
 */
export function numAt(puzzle, r, c) {
  return [...puzzle.clues.across, ...puzzle.clues.down]
    .find(cl => cl.r === r && cl.c === c)?.n ?? null
}
