import { useState, useMemo, useCallback, useEffect } from 'react'
import { FaTrash, FaSync } from 'react-icons/fa'
import { COLORS, FONTS } from '../utils/styles.js'
import PuzzleCreatorTab from './PuzzleCreatorTab.jsx'
import ClientsTab from './ClientsTab.jsx'
import { getIstDatePlusDays, getIstDateStr, gridSignature } from '../utils/helpers.js'
import { getRegisteredUsersForAdmin, deleteUserForAdmin, triggerDeployForAdmin } from '../api/auth.js'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { getPuzzleForDate, getAdminPuzzleEdits, setAdminPuzzleEdits, getBasePuzzleForDate, mergePuzzleEdits } from '../data/puzzleCalendar.js'
import { fetchPuzzleOverride, savePuzzleOverride, fixClue } from '../api/puzzle.js'
import { fetchPuzzleHomeGate, setPuzzleHomeGate } from '../api/homeGate.js'
import { getCurrentTenantSlug, tenantFetch } from '../lib/tenant.js'

/**
 * "Clients" tab is rendered ONLY on the main-site admin (www.dailyfill.club/#admin).
 * Tenant subdomains (e.g. acme.dailyfill.club/#admin) MUST NOT see it — that
 * dashboard is scoped to a single tenant's data and has no business creating
 * other tenants. We resolve once at module load (the slug doesn't change without
 * a navigation), and the AdminScreen reads `IS_MAIN_SITE_ADMIN` below.
 */
const IS_MAIN_SITE_ADMIN = getCurrentTenantSlug() === null

// Product launch date (IST). Every date from here to today is one puzzle day.
const LAUNCH_DATE = '2026-03-07'

function puzzleDateKey(raw) {
  if (raw == null) return ''
  const s = typeof raw === 'string' ? raw : String(raw)
  return s.slice(0, 10)
}

function normalizeDifficultyBucket(raw) {
  if (raw == null || raw === '') return null
  const t = String(raw).trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  if (t === 'easy' || t === 'too_easy') return 'easy'
  if (t === 'just_right' || t === 'justright') return 'just_right'
  if (t === 'challenging' || t === 'too_hard' || t === 'hard') return 'challenging'
  return null
}

/** Per-day rows from raw `scores` rows (same shape as /api/admin/stats). Uses IST calendar dates. */
function buildPuzzleStatsRowsFromScores(scores) {
  const byDate = {}
  for (const s of scores || []) {
    const d = puzzleDateKey(s.puzzle_date)
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
    if (!byDate[d]) byDate[d] = { attempts: 0, completions: 0, totalScore: 0, perfect: 0, easy: 0, just_right: 0, challenging: 0 }
    byDate[d].attempts++
    byDate[d].completions++
    byDate[d].totalScore += Number(s.score) || 0
    if (s.completed_correct) byDate[d].perfect++
    const bucket = normalizeDifficultyBucket(s.difficulty)
    if (bucket === 'easy') byDate[d].easy++
    else if (bucket === 'just_right') byDate[d].just_right++
    else if (bucket === 'challenging') byDate[d].challenging++
  }
  const today = getIstDateStr()
  const dates = []
  let cur = new Date(today + 'T00:00:00Z')
  const launch = new Date(LAUNCH_DATE + 'T00:00:00Z')
  let dayNum = Math.round((cur - launch) / 86400000) + 1
  while (cur >= launch) {
    const d = cur.toISOString().slice(0, 10)
    const row = byDate[d] || { attempts: 0, completions: 0, totalScore: 0, perfect: 0, easy: 0, just_right: 0, challenging: 0 }
    dates.push({
      date: d,
      day: dayNum,
      attempts: row.attempts,
      completions: row.completions,
      avgScore: row.completions > 0 ? Math.round(row.totalScore / row.completions) : 0,
      perfect: row.perfect,
      avgTimeMin: 0,
      difficulty: { easy: row.easy, just_right: row.just_right, challenging: row.challenging },
    })
    cur.setUTCDate(cur.getUTCDate() - 1)
    dayNum--
  }
  return dates
}

const SCORES_PAGE_SIZE = 1000

/**
 * Default `since` window mirrors the server: last 90 days, never before launch.
 * Keeps API + client fallback paths byte-for-byte aligned so users see identical
 * archive numbers regardless of which path served the request.
 */
function resolveAdminSinceWindow() {
  const today = new Date(getIstDateStr() + 'T00:00:00Z')
  today.setUTCDate(today.getUTCDate() - 90)
  const ninety = today.toISOString().slice(0, 10)
  return ninety < LAUNCH_DATE ? LAUNCH_DATE : ninety
}

/** Client fallback for puzzle archive — same as /api/admin/stats (combined select first, then split + merge). */
async function fetchAllScoresForAdminFallback(supabase, since) {
  const fetchPages = async (cols) => {
    const rows = []
    let from = 0
    while (true) {
      let q = supabase.from('scores').select(cols)
      if (since) q = q.gte('puzzle_date', since)
      const { data, error } = await q
        .order('id', { ascending: true })
        .range(from, from + SCORES_PAGE_SIZE - 1)
      if (error) return { error, rows: null }
      if (!data?.length) break
      rows.push(...data)
      if (data.length < SCORES_PAGE_SIZE) break
      from += SCORES_PAGE_SIZE
    }
    return { error: null, rows }
  }

  const combined = await fetchPages('id, puzzle_date, score, completed_correct, difficulty')
  if (!combined.error) {
    const merged = (combined.rows || []).map((r) => ({
      puzzle_date: r.puzzle_date,
      score: r.score,
      completed_correct: r.completed_correct,
      difficulty: r.difficulty ?? null,
    }))
    return { error: null, rows: merged }
  }

  const cmsg = `${combined.error?.message || ''} ${combined.error?.details || ''}`.toLowerCase()
  const missingDifficulty =
    cmsg.includes('difficulty') || (cmsg.includes('column') && cmsg.includes('schema cache'))
  if (!missingDifficulty) return { error: combined.error, rows: null }

  const base = await fetchPages('id, puzzle_date, score, completed_correct')
  if (base.error) return { error: base.error, rows: null }

  let diffById = new Map()
  const diff = await fetchPages('id, difficulty')
  if (!diff.error) {
    diffById = new Map((diff.rows || []).map((r) => [String(r.id), r.difficulty]))
  } else {
    const dmsg = `${diff.error.message || ''} ${diff.error.details || ''}`.toLowerCase()
    const md = dmsg.includes('difficulty') || (dmsg.includes('column') && dmsg.includes('schema cache'))
    if (!md) return { error: diff.error, rows: null }
  }

  const merged = (base.rows || []).map((r) => ({
    puzzle_date: r.puzzle_date,
    score: r.score,
    completed_correct: r.completed_correct,
    difficulty: diffById.get(String(r.id)) ?? null,
  }))
  return { error: null, rows: merged }
}

function buildPuzzleArchive(statsOverride = null) {
  const today = getIstDateStr()
  const dates = []
  let cur = new Date(today + 'T00:00:00Z')
  const launch = new Date(LAUNCH_DATE + 'T00:00:00Z')
  let dayNum = Math.round((cur - launch) / 86400000) + 1
  const list = Array.isArray(statsOverride) ? statsOverride : []
  const statsByDate = list.reduce((acc, s) => { acc[s.date] = s; return acc }, {})
  while (cur >= launch) {
    const d = cur.toISOString().slice(0, 10)
    const s = statsByDate[d]
    dates.push({
      date:        d,
      day:         dayNum,
      attempts:    s?.attempts ?? 0,
      completions: s?.completions ?? 0,
      avgScore:    s?.avgScore ?? 0,
      perfect:     s?.perfect ?? 0,
      avgTimeMin:  s?.avgTimeMin ?? 0,
      difficulty:  s?.difficulty ?? { easy: 0, just_right: 0, challenging: 0 },
    })
    cur.setUTCDate(cur.getUTCDate() - 1)
    dayNum--
  }
  return dates
}

const maskEmail = e => {
  if (!e) return '—'
  const [local, domain] = e.split('@')
  if (!domain) return e.slice(0, 3) + '•••'
  return (local?.slice(0, 2) || '') + '•••@' + domain
}

// ─── ADMIN SCREEN ─────────────────────────────────────────────────────────────
export default function AdminScreen() {
  const [authed,   setAuthed]   = useState(false)
  const [pw,       setPw]       = useState('')
  const [pwError,  setPwError]  = useState(false)
  const [tab,      setTab]      = useState('users')
  const [search,   setSearch]   = useState('')
  const [sortKey,  setSortKey]  = useState('lastActive')
  const [sortAsc,  setSortAsc]  = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [showPhone, setShowPhone] = useState({})
  const [users,    setUsers]    = useState([])
  const [puzzleStats, setPuzzleStats] = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deployStatus, setDeployStatus] = useState(null)
  const [hoveredDelete, setHoveredDelete] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [archivePuzzles, setArchivePuzzles] = useState({}) // dateStr -> { grid, clues } from server overrides
  const [usersViewMode, setUsersViewMode] = useState('today') // 'today' | 'alltime'
  const [selectedDate, setSelectedDate] = useState(() => getIstDateStr()) // For date-by-date view (IST)
  const [feedbackList, setFeedbackList] = useState([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackUnreadCount, setFeedbackUnreadCount] = useState(0)
  const [feedbackMarkingRead, setFeedbackMarkingRead] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState('unresolved') // 'unresolved' | 'resolved'
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState('all') // 'all' | 'report_bug' | 'dispute_score' | 'new_suggestion'
  const [feedbackSort, setFeedbackSort] = useState('newest') // 'newest' | 'oldest'
  const [feedbackResolvingId, setFeedbackResolvingId] = useState(null) // id being marked resolved
  const [feedbackImagePopup, setFeedbackImagePopup] = useState(null) // signed URL for full-size image
  /** Community clue ideas — admin list + USED toggle */
  const [clueIdeasList, setClueIdeasList] = useState([])
  const [clueIdeasLoading, setClueIdeasLoading] = useState(false)
  const [clueIdeasTogglingId, setClueIdeasTogglingId] = useState(null)
  /** null = loading; number = logged-in users with ≥1 letter entered (synced progress), no score (API) */
  const [incompleteAttemptsCount, setIncompleteAttemptsCount] = useState(null)

  const ADMIN_PW = 'dailyfill2026'

  const goPrevDate = () => {
    const t = new Date(selectedDate + 'T12:00:00Z')
    t.setUTCDate(t.getUTCDate() - 1)
    const next = t.toISOString().slice(0, 10)
    setSelectedDate(next < LAUNCH_DATE ? LAUNCH_DATE : next)
  }
  const goNextDate = () => {
    const today = getIstDateStr()
    if (selectedDate >= today) return
    const t = new Date(selectedDate + 'T12:00:00Z')
    t.setUTCDate(t.getUTCDate() + 1)
    const next = t.toISOString().slice(0, 10)
    setSelectedDate(next > today ? today : next)
  }

  const PUZZLE_ARCHIVE = useMemo(() => buildPuzzleArchive(puzzleStats), [puzzleStats])

  // Load server puzzle overrides for the archive so "today" shows the pushed puzzle
  useEffect(() => {
    if (tab !== 'puzzles' || !PUZZLE_ARCHIVE.length) return
    let cancelled = false
    const dates = PUZZLE_ARCHIVE.map(p => p.date)
    Promise.all(dates.map(d => fetchPuzzleOverride(d))).then(results => {
      if (cancelled) return
      const next = {}
      results.forEach((puzzle, i) => {
        if (puzzle?.grid) next[dates[i]] = puzzle
      })
      setArchivePuzzles(prev => ({ ...prev, ...next }))
    })
    return () => { cancelled = true }
  }, [tab, PUZZLE_ARCHIVE])

  const refreshPuzzleStats = useCallback(async () => {
    if (!authed) return

    const applyFallbackFromScores = async () => {
      if (!isSupabaseConfigured()) {
        console.warn('Puzzle stats fallback skipped: set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY for client-side fallback')
        return
      }
      const since = resolveAdminSinceWindow()
      const { error: scoresErr, rows: scores } = await fetchAllScoresForAdminFallback(supabase, since)
      if (scoresErr) {
        console.warn('Puzzle stats fallback failed:', scoresErr)
        return
      }
      setPuzzleStats(buildPuzzleStatsRowsFromScores(scores || []))
    }

    try {
      const r = await fetch('/api/admin/stats', {
        headers: { 'X-Admin-Password': pw },
      })
      const data = await r.json().catch(() => ({}))
      const apiStats = data?.stats
      if (r.ok && Array.isArray(apiStats) && apiStats.length > 0) {
        setPuzzleStats(apiStats)
        return
      }
      await applyFallbackFromScores()
    } catch (e) {
      console.warn('Puzzle stats fetch failed:', e)
      try {
        await applyFallbackFromScores()
      } catch (e2) {
        console.warn('Puzzle stats fallback after fetch error failed:', e2)
      }
    }
  }, [authed, pw])

  const refreshUsers = useCallback(async () => {
    const dateParam = usersViewMode === 'today' ? selectedDate : getIstDateStr()
    const list = await getRegisteredUsersForAdmin(authed ? pw : '', dateParam)
    setUsers(list)
  }, [authed, pw, usersViewMode, selectedDate])

  const refreshIncompleteAttempts = useCallback(async () => {
    if (!authed || !isSupabaseConfigured()) {
      setIncompleteAttemptsCount(0)
      return
    }
    try {
      const r = await fetch(
        '/api/admin/stats?' + new URLSearchParams({ light: '1', incompleteFor: selectedDate }),
        { headers: { 'X-Admin-Password': pw } }
      )
      const data = await r.json().catch(() => ({}))
      const n = data?.incompleteNotSubmitted?.count
      if (r.ok && typeof n === 'number') setIncompleteAttemptsCount(n)
      else setIncompleteAttemptsCount(0)
    } catch {
      setIncompleteAttemptsCount(0)
    }
  }, [authed, pw, selectedDate])

  useEffect(() => {
    if (authed && tab === 'users') refreshUsers()
  }, [authed, tab, refreshUsers])

  useEffect(() => {
    if (!authed || tab !== 'users' || usersViewMode !== 'today') return
    let cancelled = false
    setIncompleteAttemptsCount(null)
    if (!isSupabaseConfigured()) {
      setIncompleteAttemptsCount(0)
      return
    }
    ;(async () => {
      try {
        const r = await fetch(
          '/api/admin/stats?' + new URLSearchParams({ light: '1', incompleteFor: selectedDate }),
          { headers: { 'X-Admin-Password': pw } }
        )
        const data = await r.json().catch(() => ({}))
        if (cancelled) return
        const n = data?.incompleteNotSubmitted?.count
        if (r.ok && typeof n === 'number') setIncompleteAttemptsCount(n)
        else setIncompleteAttemptsCount(0)
      } catch {
        if (!cancelled) setIncompleteAttemptsCount(0)
      }
    })()
    return () => { cancelled = true }
  }, [authed, tab, usersViewMode, selectedDate, pw])

  useEffect(() => {
    if (authed && tab === 'puzzles') refreshPuzzleStats()
  }, [authed, tab, refreshPuzzleStats])

  const refreshFeedback = useCallback(async () => {
    if (!authed) return
    setFeedbackLoading(true)
    try {
      const r = await fetch('/api/admin/feedback', { headers: { 'X-Admin-Password': pw } })
      const data = await r.json().catch(() => ({}))
      if (r.ok) {
        setFeedbackList(data.list || [])
        setFeedbackUnreadCount(data.unreadCount ?? 0)
      } else {
        setFeedbackList([])
        setFeedbackUnreadCount(0)
      }
    } catch {
      setFeedbackList([])
      setFeedbackUnreadCount(0)
    } finally {
      setFeedbackLoading(false)
    }
  }, [authed, pw])

  useEffect(() => {
    if (authed && tab === 'feedback') refreshFeedback()
  }, [authed, tab, refreshFeedback])

  const refreshClueIdeas = useCallback(async () => {
    if (!authed) return
    setClueIdeasLoading(true)
    try {
      const r = await tenantFetch('/api/clue-ideas?admin=1', { headers: { 'X-Admin-Password': pw } })
      const data = await r.json().catch(() => ({}))
      if (r.ok) setClueIdeasList(data.list || [])
      else setClueIdeasList([])
    } catch {
      setClueIdeasList([])
    } finally {
      setClueIdeasLoading(false)
    }
  }, [authed, pw])

  useEffect(() => {
    if (authed && tab === 'clueIdeas') refreshClueIdeas()
  }, [authed, tab, refreshClueIdeas])

  // Fetch feedback unread count when admin first loads (so badge shows)
  useEffect(() => {
    if (!authed) return
    let cancelled = false
    fetch('/api/admin/feedback', { headers: { 'X-Admin-Password': pw } })
      .then(r => r.json().catch(() => ({})))
      .then(data => { if (!cancelled && data.unreadCount != null) setFeedbackUnreadCount(data.unreadCount) })
    return () => { cancelled = true }
  }, [authed, pw])

  // Arrow keys for date navigation when in Today view
  useEffect(() => {
    if (tab !== 'users' || usersViewMode !== 'today') return
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); if (selectedDate > LAUNCH_DATE) goPrevDate() }
      if (e.key === 'ArrowRight') { e.preventDefault(); if (selectedDate < getIstDateStr()) goNextDate() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, usersViewMode, selectedDate])

  // Refresh users when localStorage changes (e.g. new signup in another tab)
  useEffect(() => {
    if (!authed) return
    const onStorage = (e) => {
      if (e.key === 'df_registered_users') refreshUsers()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [authed, refreshUsers])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        refreshUsers(),
        refreshPuzzleStats(),
        tab === 'feedback' ? refreshFeedback() : Promise.resolve(),
        tab === 'clueIdeas' ? refreshClueIdeas() : Promise.resolve(),
        tab === 'users' && usersViewMode === 'today' ? refreshIncompleteAttempts() : Promise.resolve(),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [refreshUsers, refreshPuzzleStats, refreshFeedback, refreshClueIdeas, refreshIncompleteAttempts, tab, usersViewMode])

  const handleLogin = () => {
    if (pw === ADMIN_PW) { setAuthed(true); setPwError(false) }
    else { setPwError(true); setPw('') }
  }

  const handleDeploy = useCallback(async () => {
    setDeployStatus('loading')
    try {
      await triggerDeployForAdmin(pw)
      setDeployStatus('success')
      setTimeout(() => setDeployStatus(null), 5000)
    } catch (e) {
      setDeployStatus(e.message)
      setTimeout(() => setDeployStatus(null), 6000)
    }
  }, [pw])

  // ── Derived user data ──────────────────────────────────────────────────────
  const todayStr = getIstDateStr()
  const usersPlayedToday = users.filter(u => u.todayPlayed)
  const activeTodayCount = usersPlayedToday.length
  const avgScoreToday = activeTodayCount > 0
    ? Math.round(usersPlayedToday.reduce((s, u) => s + (u.todayScore ?? 0), 0) / activeTodayCount)
    : '—'
  const topScoreToday = usersPlayedToday.length > 0
    ? Math.max(...usersPlayedToday.map(u => u.todayScore ?? 0))
    : '—'

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase()
    let rows = usersViewMode === 'today'
      ? users.filter(u => u.todayPlayed && (
          (u.username || '').toLowerCase().includes(q) ||
          (u.email || u.phone || '').includes(q)
        ))
      : users.filter(u =>
          (u.username || '').toLowerCase().includes(q) ||
          (u.email || u.phone || '').includes(q)
        )
    const key = usersViewMode === 'today' ? 'todayScore' : sortKey
    rows = [...rows].sort((a, b) => {
      const av = usersViewMode === 'today' ? (a.todayScore ?? -1) : a[sortKey]
      const bv = usersViewMode === 'today' ? (b.todayScore ?? -1) : b[sortKey]
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortAsc ? (av - bv) : (bv - av)
    })
    return rows
  }, [users, search, sortKey, sortAsc, usersViewMode])

  const totalUsers    = users.length
  const activeToday   = users.filter(u => u.lastActive === todayStr).length
  const avgScore      = totalUsers > 0 ? Math.round(users.reduce((s, u) => s + (u.avgScore || 0), 0) / totalUsers) : '—'
  const totalGames    = users.reduce((s, u) => s + (u.games || 0), 0)
  // Admin-only aggregate: account age from profile `joined` (IST calendar compare)
  const signupCutoff7d = getIstDatePlusDays(-7)
  const signupsLast7Days = users.filter(u => (u.joined || '') >= signupCutoff7d).length

  // ── Derived puzzle data ────────────────────────────────────────────────────
  const daysActive    = PUZZLE_ARCHIVE.length
  const totalAttempts = PUZZLE_ARCHIVE.reduce((s, p) => s + p.attempts, 0)
  const overallCR     = totalAttempts > 0
    ? Math.round(PUZZLE_ARCHIVE.reduce((s, p) => s + p.completions, 0) / totalAttempts * 100)
    : 0
  const scoredPuzzles = PUZZLE_ARCHIVE.filter(p => p.attempts > 0)
  const overallAvgSc  = scoredPuzzles.length > 0
    ? Math.round(scoredPuzzles.reduce((s, p) => s + p.avgScore, 0) / scoredPuzzles.length)
    : '—'

  const handleSort = key => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const togglePhone = id => setShowPhone(prev => ({ ...prev, [id]: !prev[id] }))

  const handleDeleteUser = useCallback(async (u) => {
    try {
      await deleteUserForAdmin(u.id, pw)
      setDeleteConfirm(null)
      refreshUsers()
    } catch (e) {
      setDeleteConfirm(prev => prev ? { ...prev, error: e.message } : null)
    }
  }, [pw, refreshUsers])

  // ─────────────────────────────────────────────────────────────────────────────
  // PASSWORD GATE
  // ─────────────────────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={styles.gateWrap}>
      <div style={styles.gateCard}>
        <div style={styles.gateLogo}>
          <span style={styles.gateLogoText}>DF</span>
        </div>
        <h1 style={styles.gateTitle}>Admin Panel</h1>
        <p style={styles.gateSub}>DailyFill · Internal Dashboard</p>
        <div style={styles.gateField}>
          <input
            type="password"
            placeholder="Enter admin password"
            value={pw}
            onChange={e => { setPw(e.target.value); setPwError(false) }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ ...styles.gateInput, ...(pwError ? styles.gateInputErr : {}) }}
            autoFocus
          />
          {pwError && <p style={styles.gateErrMsg}>Incorrect password. Try again.</p>}
        </div>
        <button onClick={handleLogin} style={styles.gateBtn}>Unlock Dashboard</button>
        <p style={styles.gateHint}>Authorised personnel only</p>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.wrap}>
      {/* ── Top bar ── */}
      <div style={styles.topbar}>
        <div style={styles.topbarInner}>
          <div style={styles.topbarLeft}>
            <span style={styles.topbarLogo}>DF</span>
            <div>
              <div style={styles.topbarTitle}>DailyFill Admin</div>
              <div style={styles.topbarSub}>Internal Dashboard · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{ ...styles.refreshBtn, opacity: refreshing ? 0.7 : 1 }}
              title="Refresh users and stats"
            >
              <FaSync size={14} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}} />
            </button>
            <button
              type="button"
              onClick={handleDeploy}
              disabled={deployStatus === 'loading'}
              style={{
                ...styles.deployBtn,
                opacity: deployStatus === 'loading' ? 0.6 : 1,
              }}
              title="Trigger a new deployment on Vercel"
            >
              {deployStatus === 'loading' ? '⏳ Deploying…' : '🚀 Deploy to Vercel'}
            </button>
            {deployStatus === 'success' && (
              <span style={{ fontSize: 12, color: COLORS.successText, fontWeight: 600 }}>✓ Deploy triggered</span>
            )}
            {deployStatus && deployStatus !== 'loading' && deployStatus !== 'success' && (
              <span style={{ fontSize: 12, color: COLORS.error }}>{deployStatus}</span>
            )}
            <button onClick={() => setAuthed(false)} style={styles.logoutBtn}>Sign out</button>
          </div>
        </div>
      </div>

      {/* ── Tab nav ── */}
      <div style={styles.tabBar}>
        <div style={styles.tabBarInner}>
          {[
            { id: 'users',     label: 'Users',            icon: '👤' },
            { id: 'puzzles',   label: 'Puzzle Archive',   icon: '📋' },
            { id: 'upcoming',  label: 'Upcoming Puzzles', icon: '📅' },
            { id: 'creator',   label: 'Puzzle Creator',   icon: '🧩' },
            { id: 'feedback',  label: 'Feedback',         icon: '💬', unreadCount: feedbackUnreadCount },
            { id: 'clueIdeas', label: 'Clue ideas',       icon: '💡' },
            ...(IS_MAIN_SITE_ADMIN ? [{ id: 'clients', label: 'Clients', icon: '🏢' }] : []),
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ ...styles.tabBtn, ...(tab === t.id ? styles.tabBtnActive : {}) }}
            >
              <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
              {t.unreadCount != null && t.unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    minWidth: 20,
                    height: 20,
                    padding: '0 6px',
                    borderRadius: 10,
                    background: COLORS.error,
                    color: COLORS.white,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: FONTS.sans,
                  }}
                >
                  {t.unreadCount > 99 ? '99+' : t.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.content}>
        {/* ══════════════════════════════════════════════════════════════════════
            USERS TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'users' && (
          <>
            {/* View mode toggle + date selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '0 4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: COLORS.textMuted, marginRight: 4 }}>View:</span>
              <button
                onClick={() => { setUsersViewMode('today'); setSortKey('todayScore'); setSortAsc(false); setSelectedDate(getIstDateStr()) }}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontFamily: FONTS.sans, fontWeight: 600,
                  border: `1px solid ${usersViewMode === 'today' ? '#1a6080' : '#ddd'}`,
                  background: usersViewMode === 'today' ? '#e8f4f8' : '#fff',
                  color: usersViewMode === 'today' ? '#1a6080' : COLORS.textMuted,
                  cursor: 'pointer',
                }}
              >
                Today
              </button>
              <button
                onClick={() => { setUsersViewMode('alltime'); setSortKey('lastActive'); setSortAsc(false) }}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontFamily: FONTS.sans, fontWeight: 600,
                  border: `1px solid ${usersViewMode === 'alltime' ? '#5020a0' : '#ddd'}`,
                  background: usersViewMode === 'alltime' ? '#f3eff8' : '#fff',
                  color: usersViewMode === 'alltime' ? '#5020a0' : COLORS.textMuted,
                  cursor: 'pointer',
                }}
              >
                All time
              </button>
              {usersViewMode === 'today' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16, paddingLeft: 16, borderLeft: '1px solid #e0e0e0' }}>
                  <button
                    onClick={goPrevDate}
                    disabled={selectedDate <= LAUNCH_DATE}
                    title="Previous day"
                    style={{
                      width: 32, height: 32, borderRadius: 6, border: '1px solid #ddd', background: '#fff',
                      cursor: selectedDate <= LAUNCH_DATE ? 'not-allowed' : 'pointer', opacity: selectedDate <= LAUNCH_DATE ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontFamily: FONTS.sans,
                    }}
                  >
                    ←
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    min={LAUNCH_DATE}
                    max={getIstDateStr()}
                    onChange={(e) => setSelectedDate(e.target.value.slice(0, 10))}
                    style={{
                      padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, fontFamily: FONTS.sans,
                      cursor: 'pointer',
                    }}
                    title="Pick date"
                  />
                  <button
                    onClick={goNextDate}
                    disabled={selectedDate >= getIstDateStr()}
                    title="Next day"
                    style={{
                      width: 32, height: 32, borderRadius: 6, border: '1px solid #ddd', background: '#fff',
                      cursor: selectedDate >= getIstDateStr() ? 'not-allowed' : 'pointer', opacity: selectedDate >= getIstDateStr() ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontFamily: FONTS.sans,
                    }}
                  >
                    →
                  </button>
                </div>
              )}
            </div>

            {/* Stat cards */}
            <div style={styles.cardRow}>
              {usersViewMode === 'today' ? (
                <>
                  <StatCard label={selectedDate === todayStr ? 'Players Today' : `Players on ${selectedDate}`} value={activeTodayCount} sub={activeTodayCount > 0 ? (selectedDate === todayStr ? 'Played today' : 'That day') : 'No activity'} color="#1a6080" />
                  <StatCard label="Avg Score" value={avgScoreToday} sub={activeTodayCount > 0 ? (selectedDate === todayStr ? "Today's average" : "That day's average") : 'No games yet'} color="#805020" />
                  <StatCard label="Top Score" value={topScoreToday} sub={activeTodayCount > 0 ? (selectedDate === todayStr ? "Today's best" : "That day's best") : '—'} color="#5020a0" />
                  <StatCard
                    label="Started, no submit"
                    value={incompleteAttemptsCount === null ? '…' : incompleteAttemptsCount}
                    sub="Logged in · ≥1 letter entered · no score"
                    color="#8B4513"
                  />
                  <StatCard label="Total Users" value={totalUsers} sub="Registered" color="#2C4A3E" />
                </>
              ) : (
                <>
                  <StatCard label="Total Users"  value={totalUsers}  sub="Waiting for first sign-ups"    color="#2C4A3E" />
                  <StatCard label="New signups"  value={signupsLast7Days} sub="Last 7 days (IST)"           color="#0d6e4d" />
                  <StatCard label="Active Today" value={activeToday} sub={activeToday > 0 ? 'Played today' : 'No activity yet'} color="#1a6080" />
                  <StatCard label="Avg Score"    value={avgScore}    sub="No games played yet"            color="#805020" />
                  <StatCard label="Total Games"  value={totalGames}  sub="Lifetime plays"                 color="#5020a0" />
                </>
              )}
            </div>

            {/* Search + table */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>{usersViewMode === 'today' ? (selectedDate === todayStr ? 'Players Today' : `Players on ${selectedDate}`) : 'All Users'}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => {
                      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
                      const rows = users
                        .map(u => ({
                          email: (u.email || u.phone || '').trim(),
                          joined: u.joined || '',
                        }))
                        .filter(r => r.email)
                      if (rows.length === 0) return
                      const header = 'email,date_joined'
                      const body = rows.map(r => `${esc(r.email)},${esc(r.joined)}`).join('\n')
                      const csv = `${header}\n${body}`
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `dailyfill-users-${new Date().toISOString().slice(0, 10)}.csv`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    disabled={users.length === 0}
                    style={{
                      padding: '8px 14px', background: users.length === 0 ? '#f0f0f0' : '#e8f4f8', border: `1px solid ${users.length === 0 ? '#ddd' : '#1a6080'}`,
                      borderRadius: 6, fontSize: 12, cursor: users.length === 0 ? 'not-allowed' : 'pointer', fontFamily: FONTS.sans, color: users.length === 0 ? COLORS.textMuted : '#1a6080', fontWeight: 600,
                    }}
                    title={users.length === 0 ? 'No users to export' : 'Download CSV for Excel: email and date joined (YYYY-MM-DD)'}
                  >
                    📥 Export list (CSV)
                  </button>
                  <button
                    onClick={refreshUsers}
                    style={{
                      padding: '8px 14px', background: '#f0f0f0', border: '1px solid #ddd',
                      borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: FONTS.sans,
                    }}
                  >
                    ↻ Refresh
                  </button>
                  <input
                    type="text"
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={styles.searchInput}
                  />
                </div>
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {usersViewMode === 'today' ? (
                        ['username', 'email', 'joined', 'todayScore', '_actions'].map(col => (
                          <th
                            key={col}
                            onClick={col === 'todayScore' ? () => handleSort('todayScore') : undefined}
                            style={{
                              ...styles.th,
                              cursor: col === 'todayScore' ? 'pointer' : 'default',
                            }}
                          >
                            {col === 'todayScore' ? (selectedDate === todayStr ? "Today's Score" : 'Score') : col === '_actions' ? '' : col.charAt(0).toUpperCase() + col.slice(1)}
                            {col === 'todayScore' && sortKey === 'todayScore' && (
                              <span style={{ marginLeft: 4, opacity: 0.6 }}>{sortAsc ? '↑' : '↓'}</span>
                            )}
                          </th>
                        ))
                      ) : (
                        [
                          { key: 'username',   label: 'Username'      },
                          { key: 'email',      label: 'Email'         },
                          { key: 'joined',     label: 'Joined'        },
                          { key: 'games',      label: 'Games'         },
                          { key: 'bestScore',  label: 'Best Score'    },
                          { key: 'avgScore',   label: 'Avg Score'     },
                          { key: 'lastActive', label: 'Last Active'   },
                          { key: '_actions',   label: ''              },
                        ].map(col => (
                          <th
                            key={col.key}
                            onClick={() => !['email', '_actions'].includes(col.key) && handleSort(col.key)}
                            style={{
                              ...styles.th,
                              cursor: !['email', '_actions'].includes(col.key) ? 'pointer' : 'default',
                            }}
                          >
                            {col.label}
                            {sortKey === col.key && (
                              <span style={{ marginLeft: 4, opacity: 0.6 }}>{sortAsc ? '↑' : '↓'}</span>
                            )}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={u.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafaf9' }}>
                        <td style={styles.td}>
                          <span style={styles.avatarChip}>{u.username[0]}</span>
                          <span style={styles.tdName}>{u.username}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.phoneText}>
                            {showPhone[u.id] ? (u.email || u.phone) : maskEmail(u.email || u.phone)}
                          </span>
                          <button
                            onClick={() => togglePhone(u.id)}
                            style={styles.revealPhoneBtn}
                          >
                            {showPhone[u.id] ? 'Hide' : 'Show'}
                          </button>
                        </td>
                        <td style={{ ...styles.td, color: COLORS.textMuted }}>{u.joined}</td>
                        {usersViewMode === 'today' ? (
                          <td style={styles.td}>
                            <ScoreBadge score={u.todayScore ?? 0} />
                          </td>
                        ) : (
                          <>
                            <td style={styles.td}><strong>{u.games}</strong></td>
                            <td style={styles.td}><ScoreBadge score={u.bestScore} /></td>
                            <td style={styles.td}><ScoreBadge score={u.avgScore} dim /></td>
                            <td style={{ ...styles.td, color: u.lastActive === todayStr ? COLORS.successText : COLORS.textMuted }}>
                              {u.lastActive === todayStr ? '🟢 Today' : u.lastActive}
                            </td>
                          </>
                        )}
                        <td style={styles.td}>
                          {isSupabaseConfigured() && (
                            <button
                              onClick={() => setDeleteConfirm(u)}
                              onMouseEnter={() => setHoveredDelete(u.id)}
                              onMouseLeave={() => setHoveredDelete(null)}
                              style={{
                                ...styles.deleteBtn,
                                ...(hoveredDelete === u.id ? styles.deleteBtnHover : {}),
                              }}
                              title="Delete user permanently"
                            >
                              <FaTrash size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div style={styles.emptyState}>
                    {users.length === 0 ? (
                      <>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
                        <div style={{ fontWeight: 700, marginBottom: 6, color: COLORS.textPrimary }}>No users yet</div>
                        <div style={{ color: COLORS.textMuted, fontSize: 13, maxWidth: 340 }}>
                          Users will appear here once they sign up (email + OTP + alias).
                        </div>
                      </>
                    ) : usersViewMode === 'today' ? (
                      <>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                        <div style={{ fontWeight: 700, marginBottom: 6, color: COLORS.textPrimary }}>No players today</div>
                        <div style={{ color: COLORS.textMuted, fontSize: 13, maxWidth: 340 }}>
                          {activeTodayCount === 0 ? 'No one has completed today\'s puzzle yet.' : 'No players match your search.'}
                        </div>
                      </>
                    ) : 'No users match your search.'}
                  </div>
                )}
              </div>
              <div style={styles.tableFooter}>
                {usersViewMode === 'today'
                  ? `Showing ${filteredUsers.length} of ${activeTodayCount} players${selectedDate === todayStr ? ' today' : ` on ${selectedDate}`}`
                  : `Showing ${filteredUsers.length} of ${users.length} users`}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            PUZZLE ARCHIVE TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'puzzles' && (
          <>
            {/* Stat cards */}
            <div style={styles.cardRow}>
              <StatCard label="Days Active"     value={daysActive}      sub={`Since ${LAUNCH_DATE} launch`}   color="#2C4A3E" />
              <StatCard label="Completion Rate" value={totalAttempts > 0 ? `${overallCR}%` : '—'} sub={totalAttempts > 0 ? 'Avg across all days' : 'No plays recorded yet'} color="#1a6080" />
              <StatCard label="Avg Score"       value={overallAvgSc}    sub={totalAttempts > 0 ? 'When completed' : 'No plays recorded yet'} color="#805020" />
              <StatCard label="Total Attempts"  value={totalAttempts}   sub={totalAttempts > 0 ? 'All puzzle days' : 'No plays yet'} color="#5020a0" />
            </div>

            {/* Puzzle list */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Daily Puzzle Archive</h2>
                <span style={styles.archiveHint}>
                  {daysActive} day{daysActive !== 1 ? 's' : ''} since launch · Click any day for details
                </span>
              </div>

              {isSupabaseConfigured() && (
                <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={refreshPuzzleStats}
                    style={{
                      padding: '6px 12px', background: '#f0f0f0', border: '1px solid #ddd',
                      borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: FONTS.sans,
                    }}
                  >
                    ↻ Refresh stats
                  </button>
                </div>
              )}

              <div style={styles.puzzleList}>
                {PUZZLE_ARCHIVE.map(p => {
                  const cr = p.attempts > 0 ? Math.round(p.completions / p.attempts * 100) : 0
                  const isOpen = expanded === p.date
                  const isToday = p.date === getIstDateStr()
                  const isLaunch = p.date === LAUNCH_DATE
                  return (
                    <div key={p.date} style={styles.puzzleCard}>
                      <button
                        onClick={() => setExpanded(isOpen ? null : p.date)}
                        style={styles.puzzleCardHeader}
                      >
                        <div style={styles.puzzleCardLeft}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={styles.puzzleDate}>
                                {new Date(p.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              {isToday && (
                                <span style={{ ...styles.catBadge, background: '#d4ede1', color: COLORS.successText }}>Today</span>
                              )}
                              {isLaunch && !isToday && (
                                <span style={{ ...styles.catBadge, background: '#e8f4f8', color: '#1a6080' }}>Launch Day</span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONTS.sans, marginTop: 2 }}>
                              Day {p.day} · {p.date}
                            </div>
                          </div>
                        </div>
                        <div style={styles.puzzleCardRight}>
                          <MiniStat label="Attempts"    value={p.attempts}    />
                          <MiniStat label="Completed"   value={p.completions} />
                          <MiniStat label="Finish Rate" value={p.attempts > 0 ? `${cr}%` : '—'} color={COLORS.textMuted} />
                          <MiniStat label="Avg Score"   value={p.attempts > 0 ? p.avgScore : '—'} color={COLORS.textMuted} />
                          <span style={{ ...styles.expandIcon, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            ▾
                          </span>
                        </div>
                      </button>

                      {isOpen && (() => {
                        const pz       = archivePuzzles[p.date] ?? getPuzzleForDate(p.date)
                        const pzRows   = pz?.grid?.length || 0
                        const pzCols   = pz?.grid?.[0]?.length || 0
                        const cellPx   = pzCols > 0 ? Math.min(15, Math.floor(240 / pzCols)) : 12
                        const totalPzCells = pzRows * pzCols
                        const blackPzCells = pz ? pz.grid.flat().filter(c => !c).length : 0
                        const blackPzPct   = totalPzCells > 0 ? Math.round(blackPzCells / totalPzCells * 100) : 0
                        const nAcross  = pz?.clues?.across?.length || 0
                        const nDown    = pz?.clues?.down?.length   || 0
                        return (
                          <div style={styles.puzzleExpanded}>
                            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                              {/* ── Mini grid preview ── */}
                              {pz && (
                                <div style={{ flexShrink: 0 }}>
                                  <div style={{
                                    display: 'inline-grid',
                                    gridTemplateColumns: `repeat(${pzCols}, ${cellPx}px)`,
                                    gridTemplateRows: `repeat(${pzRows}, ${cellPx}px)`,
                                    gap: 1,
                                    border: '2px solid #111',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                    background: '#111',
                                  }}>
                                    {pz.grid.flatMap((row, r) =>
                                      row.map((cell, c) => (
                                        <div key={`${r}-${c}`} style={{
                                          width: cellPx,
                                          height: cellPx,
                                          background: cell ? '#ffffff' : '#111111',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: Math.max(6, Math.floor(cellPx * 0.62)),
                                          fontFamily: FONTS.serif,
                                          fontWeight: 700,
                                          color: '#111',
                                          lineHeight: 1,
                                        }}>
                                          {cell || ''}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FONTS.serif, color: COLORS.textPrimary }}>
                                        {pzRows}×{pzCols}
                                      </span>
                                      <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONTS.sans }}>grid</span>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, fontFamily: FONTS.sans }}>·</span>
                                      <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONTS.sans }}>{blackPzPct}% black</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 14 }}>
                                      <span style={{ fontSize: 12, fontFamily: FONTS.sans, color: COLORS.textMid }}>
                                        <strong>{nAcross + nDown}</strong> <span style={{ color: COLORS.textMuted }}>words</span>
                                      </span>
                                      <span style={{ fontSize: 12, fontFamily: FONTS.sans, color: COLORS.textMid }}>
                                        <strong>{nAcross}</strong> <span style={{ color: COLORS.textMuted }}>across</span>
                                      </span>
                                      <span style={{ fontSize: 12, fontFamily: FONTS.sans, color: COLORS.textMid }}>
                                        <strong>{nDown}</strong> <span style={{ color: COLORS.textMuted }}>down</span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* ── Stats ── */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={styles.expandedGrid}>
                                  <ExpandedStat icon="📅" label="Date"             value={p.date} />
                                  <ExpandedStat icon="🗓" label="Day Number"       value={`Day ${p.day}`} />
                                  <ExpandedStat icon="🎯" label="Total Attempts"   value={p.attempts} />
                                  <ExpandedStat icon="✅" label="Completions"      value={p.completions} />
                                  <ExpandedStat icon="📊" label="Completion Rate"  value={p.attempts > 0 ? `${cr}%` : '—'} color={COLORS.textMuted} />
                                  <ExpandedStat icon="⭐" label="Average Score"    value={p.attempts > 0 ? p.avgScore : '—'} color={COLORS.textMuted} />
                                  <ExpandedStat icon="💯" label="Perfect Solves"   value={p.attempts > 0 ? p.perfect : '—'} color={COLORS.textMuted} />
                                  <ExpandedStat icon="❌" label="Abandoned"        value={p.attempts > 0 ? p.attempts - p.completions : '—'} color={p.attempts > 0 ? COLORS.error : COLORS.textMuted} />
                                  {/* Difficulty feedback — compact pills + bar; real data only */}
                                  {(() => {
                                    const diff = p.difficulty || { easy: 0, just_right: 0, challenging: 0 }
                                    const easy = diff.easy || 0
                                    const justRight = diff.just_right || 0
                                    const challenging = diff.challenging || 0
                                    const total = easy + justRight + challenging
                                    if (total === 0) {
                                      return (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                          <ExpandedStat icon="📐" label="Difficulty feedback" value="No responses yet" color={COLORS.textMuted} />
                                          {p.attempts > 0 ? (
                                            <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONTS.sans, lineHeight: 1.45, marginTop: 6, maxWidth: 420 }}>
                                              If players finished puzzles but this stays empty, the database may be missing the <strong style={{ color: COLORS.textMid }}>scores.difficulty</strong> column. In Supabase → SQL Editor, run the migration file <strong style={{ color: COLORS.textMid }}>004_scores_difficulty.sql</strong> from the project, then ask players to tap a difficulty again (or new finishes will save it).
                                            </div>
                                          ) : null}
                                        </div>
                                      )
                                    }
                                    const pill = (label, count, bg, color) => (
                                      <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: FONTS.sans }}>
                                        {label} <span style={{ opacity: 0.9 }}>{count}</span>
                                      </span>
                                    )
                                    return (
                                      <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: COLORS.textMuted, fontFamily: FONTS.sans, marginBottom: 8, textTransform: 'uppercase' }}>Difficulty feedback</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                                          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: COLORS.border, width: 140, minWidth: 140, flexShrink: 0 }}>
                                            <div style={{ width: `${(easy / total) * 100}%`, background: '#22c55e', minWidth: easy ? 4 : 0 }} />
                                            <div style={{ width: `${(justRight / total) * 100}%`, background: '#3b82f6', minWidth: justRight ? 4 : 0 }} />
                                            <div style={{ width: `${(challenging / total) * 100}%`, background: '#f97316', minWidth: challenging ? 4 : 0 }} />
                                          </div>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                            {pill('Too easy', easy, '#dcfce7', '#166534')}
                                            {pill('Just right', justRight, '#dbeafe', '#1e40af')}
                                            {pill('Too hard', challenging, '#ffedd5', '#c2410c')}
                                          </div>
                                        </div>
                                        <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONTS.sans, marginTop: 4 }}>{total} response{total !== 1 ? 's' : ''}</div>
                                      </div>
                                    )
                                  })()}
                                </div>
                                <div style={styles.completionBar}>
                                  <div style={styles.completionBarLabel}>
                                    <span>Completion Rate</span>
                                    <span style={{ fontWeight: 700, color: COLORS.textMuted }}>
                                      {p.attempts > 0 ? `${cr}%` : 'No plays yet'}
                                    </span>
                                  </div>
                                  <div style={styles.completionBarTrack}>
                                    <div style={{
                                      ...styles.completionBarFill,
                                      width: `${cr}%`,
                                      background: COLORS.accent,
                                    }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            UPCOMING PUZZLES TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════════════════════════════
            FEEDBACK TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'feedback' && (
          <>
            <div style={{ ...styles.section, width: '100%', maxWidth: '100%' }}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>User Feedback</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={refreshFeedback}
                    disabled={feedbackLoading}
                    style={{
                      padding: '6px 12px', background: '#f0f0f0', border: '1px solid #ddd',
                      borderRadius: 6, fontSize: 12, cursor: feedbackLoading ? 'wait' : 'pointer', fontFamily: FONTS.sans,
                    }}
                  >
                    {feedbackLoading ? 'Loading…' : '↻ Refresh'}
                  </button>
                  {feedbackUnreadCount > 0 && (
                    <button
                      onClick={async () => {
                        setFeedbackMarkingRead(true)
                        try {
                          const r = await fetch('/api/admin/feedback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'X-Admin-Password': pw },
                            body: JSON.stringify({ action: 'mark-read', markAll: true }),
                          })
                          if (r.ok) await refreshFeedback()
                        } finally {
                          setFeedbackMarkingRead(false)
                        }
                      }}
                      disabled={feedbackMarkingRead}
                      style={{
                        padding: '6px 12px', background: COLORS.accent, color: COLORS.white, border: 'none',
                        borderRadius: 6, fontSize: 12, cursor: feedbackMarkingRead ? 'wait' : 'pointer', fontFamily: FONTS.sans, fontWeight: 600,
                      }}
                    >
                      {feedbackMarkingRead ? '…' : 'Mark all as read'}
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-nav: Unresolved | Resolved */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, padding: '0 24px' }}>
                {['unresolved', 'resolved'].map(status => (
                  <button
                    key={status}
                    onClick={() => setFeedbackStatus(status)}
                    style={{
                      padding: '8px 16px', borderRadius: 8, fontSize: 13, fontFamily: FONTS.sans, fontWeight: 600,
                      border: `1px solid ${feedbackStatus === status ? COLORS.accent : '#ddd'}`,
                      background: feedbackStatus === status ? (COLORS.clueHighlight || '#d4e8df') : '#fff',
                      color: feedbackStatus === status ? COLORS.accent : COLORS.textMuted,
                      cursor: 'pointer',
                    }}
                  >
                    {status === 'unresolved' ? 'Unresolved' : 'Resolved'}
                  </button>
                ))}
              </div>

              {/* Type filter: All · Report Bug · Dispute Score · New Suggestion */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap', padding: '0 24px' }}>
                <span style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: FONTS.sans }}>Type:</span>
                {[
                  { value: 'all', label: 'All' },
                  { value: 'report_bug', label: 'Report Bug' },
                  { value: 'new_suggestion', label: 'Suggestions' },
                  { value: 'dispute_score', label: 'Dispute Score' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFeedbackTypeFilter(opt.value)}
                    style={{
                      padding: '6px 12px', borderRadius: 6, fontSize: 12, fontFamily: FONTS.sans,
                      border: `1px solid ${feedbackTypeFilter === opt.value ? COLORS.accent : '#ddd'}`,
                      background: feedbackTypeFilter === opt.value ? (COLORS.clueHighlight || '#d4e8df') : '#fff',
                      color: feedbackTypeFilter === opt.value ? COLORS.accent : COLORS.textPrimary,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Sort: Newest first | Oldest first */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 24px' }}>
                <span style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: FONTS.sans }}>Sort:</span>
                <select
                  value={feedbackSort}
                  onChange={e => setFeedbackSort(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: 12, fontFamily: FONTS.sans,
                    border: '1px solid #ddd', background: '#fff', cursor: 'pointer',
                  }}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>

              {/* Table: one row per feedback */}
              {feedbackLoading && feedbackList.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: COLORS.textMuted, fontFamily: FONTS.sans }}>Loading feedback…</div>
              ) : (() => {
                const filtered = feedbackList
                  .filter(f => (feedbackStatus === 'unresolved' ? !f.resolvedAt : f.resolvedAt))
                  .filter(f => feedbackTypeFilter === 'all' || f.type === feedbackTypeFilter)
                const sorted = [...filtered].sort((a, b) => {
                  const ta = new Date(a.createdAt).getTime()
                  const tb = new Date(b.createdAt).getTime()
                  return feedbackSort === 'newest' ? tb - ta : ta - tb
                })
                if (sorted.length === 0) {
                  return (
                    <div style={{ padding: 40, textAlign: 'center', color: COLORS.textMuted, fontFamily: FONTS.sans }}>
                      {feedbackStatus === 'unresolved' ? 'No unresolved feedback.' : 'No resolved feedback yet.'}
                    </div>
                  )
                }
                return (
                  <div style={{ overflowX: 'auto', width: '100%', padding: '0 24px 24px' }}>
                    <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13, fontFamily: FONTS.sans }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${COLORS.border}`, background: COLORS.paper || '#f5f3ee' }}>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>Name</th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>Email</th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>Date & time</th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>Type</th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>Comment</th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>Attachment</th>
                          {feedbackStatus === 'unresolved' && (
                            <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map(f => {
                          const typeLabel = f.type === 'report_bug' ? 'Report Bug' : f.type === 'dispute_score' ? 'Dispute Score' : 'New Suggestion'
                          const createdAt = f.createdAt ? new Date(f.createdAt) : null
                          const istDate = createdAt ? createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                          const istTime = createdAt ? createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'
                          const commentPreview = (f.comment || '').length > 80 ? (f.comment || '').slice(0, 80) + '…' : (f.comment || '')
                          return (
                            <tr key={f.id} style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.white }}>
                              <td style={{ padding: '8px', verticalAlign: 'middle', fontWeight: 600, color: COLORS.textPrimary }}>{f.who}</td>
                              <td style={{ padding: '8px', verticalAlign: 'middle', color: COLORS.textMuted, fontSize: 12 }}>{f.email ? maskEmail(f.email) : '—'}</td>
                              <td style={{ padding: '8px', verticalAlign: 'middle', color: COLORS.textMuted, fontSize: 12, whiteSpace: 'nowrap' }}>{istDate} · {istTime} IST</td>
                              <td style={{ padding: '8px', verticalAlign: 'middle' }}>
                                <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: COLORS.clueHighlight || '#d4e8df', color: COLORS.accent, fontWeight: 600 }}>
                                  {typeLabel}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', verticalAlign: 'middle', minWidth: 200 }} title={f.comment || ''}>
                                <span style={{ color: COLORS.textPrimary }}>{commentPreview}</span>
                              </td>
                              <td style={{ padding: '8px', verticalAlign: 'middle', width: 44 }}>
                                {f.attachmentUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setFeedbackImagePopup(f.attachmentUrl)}
                                    style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'block' }}
                                    title="View screenshot"
                                  >
                                    <img src={f.attachmentUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                                  </button>
                                ) : (
                                  <span style={{ color: COLORS.textFaint, fontSize: 11 }}>—</span>
                                )}
                              </td>
                              {feedbackStatus === 'unresolved' && (
                                <td style={{ padding: '8px', verticalAlign: 'middle', textAlign: 'right' }}>
                                  <button
                                    onClick={async () => {
                                      setFeedbackResolvingId(f.id)
                                      try {
                                        const r = await fetch('/api/admin/feedback', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json', 'X-Admin-Password': pw },
                                          body: JSON.stringify({ action: 'mark-resolved', id: f.id }),
                                        })
                                        if (r.ok) await refreshFeedback()
                                      } finally {
                                        setFeedbackResolvingId(null)
                                      }
                                    }}
                                    disabled={feedbackResolvingId === f.id}
                                    style={{
                                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontFamily: FONTS.sans, fontWeight: 600,
                                      background: COLORS.accent, color: COLORS.white, border: 'none', cursor: feedbackResolvingId === f.id ? 'wait' : 'pointer',
                                    }}
                                  >
                                    {feedbackResolvingId === f.id ? '…' : 'Mark resolved'}
                                  </button>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          </>
        )}

        {tab === 'clueIdeas' && (
          <>
            <div style={{ ...styles.section, width: '100%', maxWidth: '100%' }}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Clue ideas</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={refreshClueIdeas}
                    disabled={clueIdeasLoading}
                    style={{
                      padding: '6px 12px', background: '#f0f0f0', border: '1px solid #ddd',
                      borderRadius: 6, fontSize: 12, cursor: clueIdeasLoading ? 'wait' : 'pointer', fontFamily: FONTS.sans,
                    }}
                  >
                    {clueIdeasLoading ? 'Loading…' : '↻ Refresh'}
                  </button>
                </div>
              </div>
              <p style={{ padding: '0 24px 12px', margin: 0, fontSize: 13, color: COLORS.textMuted, fontFamily: FONTS.sans, lineHeight: 1.5 }}>
                Reader submissions (answer + clue + optional trivia). Mark <strong>Used</strong> when you&apos;ve copied the idea elsewhere — this does not change live puzzles automatically.
              </p>
              {clueIdeasLoading && clueIdeasList.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: COLORS.textMuted, fontFamily: FONTS.sans }}>Loading…</div>
              ) : clueIdeasList.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: COLORS.textMuted, fontFamily: FONTS.sans }}>No submissions yet.</div>
              ) : (
                <div style={{ overflowX: 'auto', width: '100%', padding: '0 24px 24px' }}>
                  <table style={{ width: '100%', minWidth: 960, borderCollapse: 'collapse', fontSize: 13, fontFamily: FONTS.sans }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${COLORS.border}`, background: COLORS.paper || '#f5f3ee' }}>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>When (IST)</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>Who</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>Word</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>Clue</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>Trivia</th>
                        <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600, color: COLORS.textMid }}>Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clueIdeasList.map(row => {
                        const createdAt = row.createdAt ? new Date(row.createdAt) : null
                        const istDate = createdAt ? createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                        const istTime = createdAt ? createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'
                        const cluePreview = (row.clue || '').length > 100 ? `${(row.clue || '').slice(0, 100)}…` : (row.clue || '')
                        const triviaPreview = row.trivia
                          ? ((row.trivia || '').length > 60 ? `${(row.trivia || '').slice(0, 60)}…` : row.trivia)
                          : '—'
                        return (
                          <tr key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}`, background: row.used ? 'rgba(0,0,0,0.02)' : COLORS.white }}>
                            <td style={{ padding: '8px', verticalAlign: 'top', color: COLORS.textMuted, fontSize: 12, whiteSpace: 'nowrap' }}>{istDate} · {istTime}</td>
                            <td style={{ padding: '8px', verticalAlign: 'top', fontWeight: 600, color: COLORS.textPrimary }}>{row.who}</td>
                            <td style={{ padding: '8px', verticalAlign: 'top', fontWeight: 700, color: COLORS.accent }}>{row.word}</td>
                            <td style={{ padding: '8px', verticalAlign: 'top', minWidth: 200 }} title={row.clue || ''}>{cluePreview}</td>
                            <td style={{ padding: '8px', verticalAlign: 'top', fontSize: 12, color: COLORS.textMuted }} title={row.trivia || ''}>{triviaPreview}</td>
                            <td style={{ padding: '8px', verticalAlign: 'middle', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={!!row.used}
                                disabled={clueIdeasTogglingId === row.id}
                                onChange={async () => {
                                  const next = !row.used
                                  setClueIdeasTogglingId(row.id)
                                  try {
                                    const r = await tenantFetch('/api/clue-ideas', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': pw },
                                      body: JSON.stringify({ id: row.id, used: next }),
                                    })
                                    if (r.ok) await refreshClueIdeas()
                                  } finally {
                                    setClueIdeasTogglingId(null)
                                  }
                                }}
                                style={{ width: 18, height: 18, accentColor: COLORS.accent, cursor: clueIdeasTogglingId === row.id ? 'wait' : 'pointer' }}
                                aria-label={row.used ? 'Mark as not used' : 'Mark as used'}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'upcoming' && (
          <UpcomingPuzzlesSection adminPassword={authed ? pw : ''} />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            PUZZLE CREATOR TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'creator' && (
          <PuzzleCreatorTab adminPassword={authed ? pw : ''} />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            CLIENTS TAB (main-site admin only)
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'clients' && IS_MAIN_SITE_ADMIN && (
          <ClientsTab pw={authed ? pw : ''} />
        )}
      </div>

      {/* ── Feedback attachment full-size popup ── */}
      {feedbackImagePopup && (
        <div
          style={styles.modalOverlay}
          onClick={e => { if (e.target === e.currentTarget) setFeedbackImagePopup(null) }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <button
              type="button"
              onClick={() => setFeedbackImagePopup(null)}
              style={{
                position: 'absolute', top: 8, right: 8, zIndex: 10,
                width: 36, height: 36, borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff',
                cursor: 'pointer', fontSize: 18, lineHeight: 1, fontFamily: FONTS.sans,
              }}
              aria-label="Close"
            >
              ×
            </button>
            <img src={feedbackImagePopup} alt="Feedback attachment" style={{ display: 'block', maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
          </div>
        </div>
      )}

      {/* ── Delete user confirm modal ── */}
      {deleteConfirm && (
        <div
          style={styles.modalOverlay}
          onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null) }}
        >
          <div style={styles.modalCard}>
            <div style={styles.modalTitle}>Delete user?</div>
            <div style={{ marginBottom: 16, color: COLORS.textMid, fontSize: 14 }}>
              <strong>{deleteConfirm.username}</strong> ({deleteConfirm.email}) will be permanently removed. Their scores will be deleted. This cannot be undone.
            </div>
            {deleteConfirm.error && (
              <div style={{ marginBottom: 12, padding: 10, background: '#fde8e6', borderRadius: 8, fontSize: 13, color: COLORS.error }}>
                {deleteConfirm.error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={styles.modalCancelBtn}>Cancel</button>
              <button onClick={() => handleDeleteUser(deleteConfirm)} style={styles.modalDeleteBtn}>Delete permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── UPCOMING PUZZLES (today + next 4 days, editable) ─────────────────────────────────

function getWordFromGrid(grid, cl, dir) {
  let s = ''
  for (let i = 0; i < cl.len; i++) {
    const r = dir === 'across' ? cl.r : cl.r + i
    const c = dir === 'across' ? cl.c + i : cl.c
    s += grid[r]?.[c] || ''
  }
  return s
}

const FIX_37_DOWN_CLUE = 'Abu Dhabi\'s "Entertainment Island"'

/** Shared clue/grid editor used for “today” hero + past/upcoming collapsible rows. */
function UpcomingPuzzleEditorBody({
  dateStr,
  puzzle,
  istTodayStr,
  saving,
  saveFeedback,
  saveEdits,
  updateClue,
}) {
  if (!puzzle?.grid || !puzzle?.clues) return null
  const sig = gridSignature(puzzle.grid)
  const isToday = dateStr === istTodayStr
  return (
    <>
      {(() => {
        const rows = puzzle.grid.length
        const cols = puzzle.grid[0]?.length || 0
        const total = rows * cols
        const black = puzzle.grid.flat().filter(c => !c).length
        const blackPct = total > 0 ? Math.round(black / total * 100) : 0
        const nAcross = puzzle.clues.across.length
        const nDown = puzzle.clues.down.length
        return (
          <div style={upcomingStyles.statsBar}>
            <PuzzleStat label="Grid Size" value={`${rows}×${cols}`} />
            <div style={upcomingStyles.statDivider} />
            <PuzzleStat label="Black Cells" value={`${blackPct}%`} sub={`${black} of ${total}`} />
            <div style={upcomingStyles.statDivider} />
            <PuzzleStat label="Total Words" value={nAcross + nDown} accent />
            <div style={upcomingStyles.statDivider} />
            <PuzzleStat label="Across" value={nAcross} />
            <div style={upcomingStyles.statDivider} />
            <PuzzleStat label="Down" value={nDown} />
          </div>
        )
      })()}
      <div style={upcomingStyles.gridPreview}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: COLORS.textMuted }}>Grid preview</div>
        <div style={{
          display: 'inline-grid',
          gridTemplateColumns: `repeat(${puzzle.grid[0]?.length || 5}, 1fr)`,
          gap: 2,
          fontFamily: 'monospace',
          fontSize: 12,
        }}>
          {puzzle.grid.flatMap((row, r) =>
            row.map((cell, c) => (
              <div key={`${sig}-${r}-${c}`} style={{
                width: 24, height: 24,
                background: cell ? '#e8f4ee' : '#ddd',
                border: '1px solid #ccc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {cell || ''}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={upcomingStyles.clueSection}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: COLORS.textPrimary }}>Across</div>
        {puzzle.clues.across.map((cl) => {
          const word = getWordFromGrid(puzzle.grid, cl, 'across')
          return (
            <div key={`${sig}-a-${cl.n}-${cl.r}-${cl.c}`} style={upcomingStyles.clueRow}>
              <span style={upcomingStyles.clueNum}>{cl.n}.</span>
              <input
                type="text"
                placeholder="Word"
                defaultValue={word}
                onBlur={e => { const v = e.target.value.trim().toUpperCase(); if (v.length === cl.len) updateClue(dateStr, 'across', cl, 'word', v) }}
                style={{ ...upcomingStyles.input, width: 80, fontFamily: 'monospace' }}
              />
              <input
                type="text"
                placeholder="Clue"
                defaultValue={cl.clue}
                onBlur={e => updateClue(dateStr, 'across', cl, 'clue', e.target.value)}
                style={{ ...upcomingStyles.input, flex: 1 }}
              />
              <input
                type="text"
                placeholder="Trivia (optional)"
                defaultValue={cl.trivia || ''}
                onBlur={e => updateClue(dateStr, 'across', cl, 'trivia', e.target.value)}
                style={{ ...upcomingStyles.input, flex: 1, fontSize: 12, color: COLORS.textMuted }}
              />
            </div>
          )
        })}
      </div>
      <div style={upcomingStyles.clueSection}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: COLORS.textPrimary }}>Down</div>
        {puzzle.clues.down.map((cl) => {
          const word = getWordFromGrid(puzzle.grid, cl, 'down')
          return (
            <div key={`${sig}-d-${cl.n}-${cl.r}-${cl.c}`} style={upcomingStyles.clueRow}>
              <span style={upcomingStyles.clueNum}>{cl.n}.</span>
              <input
                type="text"
                placeholder="Word"
                defaultValue={word}
                onBlur={e => { const v = e.target.value.trim().toUpperCase(); if (v.length === cl.len) updateClue(dateStr, 'down', cl, 'word', v) }}
                style={{ ...upcomingStyles.input, width: 80, fontFamily: 'monospace' }}
              />
              <input
                type="text"
                placeholder="Clue"
                defaultValue={cl.clue}
                onBlur={e => updateClue(dateStr, 'down', cl, 'clue', e.target.value)}
                style={{ ...upcomingStyles.input, flex: 1 }}
              />
              <input
                type="text"
                placeholder="Trivia (optional)"
                defaultValue={cl.trivia || ''}
                onBlur={e => updateClue(dateStr, 'down', cl, 'trivia', e.target.value)}
                style={{ ...upcomingStyles.input, flex: 1, fontSize: 12, color: COLORS.textMuted }}
              />
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => saveEdits(dateStr)}
          disabled={saving}
          style={{ ...upcomingStyles.saveBtn, opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saveFeedback === dateStr && (
          <span style={{ color: COLORS.successText, fontSize: 13 }}>
            ✓ Saved — {isToday ? 'live now for new loads of today’s puzzle' : 'stored for this calendar day'}
          </span>
        )}
        {saveFeedback === 'browser-' + dateStr && (
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Saved to browser only — log in to save to server</span>
        )}
      </div>
    </>
  )
}

function UpcomingPuzzlesSection({ adminPassword }) {
  const [expanded, setExpanded] = useState(null)
  const [edits, setEdits] = useState({})
  const [saveFeedback, setSaveFeedback] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [serverOverrides, setServerOverrides] = useState({})
  const [fix37Status, setFix37Status] = useState(null)
  const [fix37Loading, setFix37Loading] = useState(false)
  const [homeGateByDate, setHomeGateByDate] = useState({})
  const [gateSaving, setGateSaving] = useState({})
  const [homeGateError, setHomeGateError] = useState(null)
  /** Pulse once per minute so IST “today” + upcoming rows refresh after midnight (long-lived admin tab). */
  const [, setClockPulse] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setClockPulse((n) => n + 1), 60 * 1000)
    return () => clearInterval(id)
  }, [])
  const istToday = getIstDateStr()
  const gateDates = [0, 1, 2, 3, 4, 5].map((d) => getIstDatePlusDays(d))

  const pastDates = useMemo(() => {
    const out = []
    for (let d = -14; d <= -1; d++) {
      const ds = getIstDatePlusDays(d)
      if (ds >= LAUNCH_DATE) out.push(ds)
    }
    return out.sort((a, b) => b.localeCompare(a))
  }, [istToday])

  const futureDates = useMemo(() =>
    [1, 2, 3, 4].map((d) => getIstDatePlusDays(d)),
  [istToday])

  const fetchDates = useMemo(() => {
    const set = new Set([istToday, ...pastDates, ...futureDates])
    return [...set].sort()
  }, [istToday, pastDates, futureDates])

  // Published overrides for past days through upcoming — matches what players see per date.
  useEffect(() => {
    let cancelled = false
    Promise.all(fetchDates.map((d) => fetchPuzzleOverride(d))).then((results) => {
      if (cancelled) return
      const next = {}
      results.forEach((puzzle, i) => {
        if (puzzle?.grid) next[fetchDates[i]] = puzzle
      })
      setServerOverrides(next)
    })
    return () => {
      cancelled = true
    }
  }, [istToday, fetchDates])

  // Load Home-page blocking gate state (public read)
  useEffect(() => {
    let cancelled = false
    Promise.all(gateDates.map(d => fetchPuzzleHomeGate(d))).then(results => {
      if (cancelled) return
      const next = {}
      gateDates.forEach((d, i) => {
        next[d] = results[i] || { block_home: false, message: '' }
      })
      setHomeGateByDate(next)
    }).catch(() => {
      if (cancelled) return
      setHomeGateByDate({})
    })
    return () => {
      cancelled = true
    }
  }, [istToday])

  const toggleHomeGate = useCallback(async (dateStr) => {
    if (!adminPassword) return
    setHomeGateError(null)
    const curBlocked = !!homeGateByDate?.[dateStr]?.block_home
    const nextBlocked = !curBlocked
    setGateSaving(prev => ({ ...prev, [dateStr]: true }))
    try {
      const result = await setPuzzleHomeGate(dateStr, { block_home: nextBlocked }, adminPassword)
      if (!result?.ok) {
        setHomeGateError(result?.error || 'Failed to save')
        return
      }
      setHomeGateByDate(prev => ({
        ...prev,
        [dateStr]: { ...(prev?.[dateStr] || { message: '' }), block_home: nextBlocked },
      }))
    } finally {
      setGateSaving(prev => ({ ...prev, [dateStr]: false }))
    }
  }, [adminPassword, homeGateByDate])

  const [todayReloading, setTodayReloading] = useState(false)

  const reloadTodayFromServer = useCallback(async () => {
    setTodayReloading(true)
    try {
      const p = await fetchPuzzleOverride(istToday)
      if (p?.grid) setServerOverrides(prev => ({ ...prev, [istToday]: p }))
    } finally {
      setTodayReloading(false)
    }
  }, [istToday])

  const handleExpand = useCallback((dateStr, currentlyOpen) => {
    // Don't load localStorage edits — we only show the canonical puzzle (server or base)
    // so we never mix in clues from an older/different puzzle.
    setExpanded(currentlyOpen ? null : dateStr)
  }, [])

  const saveEdits = useCallback(async (dateStr) => {
    const e = edits[dateStr]
    // Use the already-published puzzle for this date as base if it exists (e.g. from Puzzle Creator).
    // Otherwise we'd overwrite it with the pool puzzle and roll back to the old version.
    const base = serverOverrides[dateStr] ?? getBasePuzzleForDate(dateStr)
    const toPublish = e && (e.clues?.across?.length || e.clues?.down?.length)
      ? mergePuzzleEdits(base, e)
      : base

    setSaveError(null)
    setSaveFeedback(null)

    if (adminPassword) {
      setSaving(true)
      const result = await savePuzzleOverride(dateStr, { grid: toPublish.grid, clues: toPublish.clues }, adminPassword)
      setSaving(false)
      if (result.ok) {
        setAdminPuzzleEdits(dateStr, null)
        setSaveFeedback(dateStr)
        setTimeout(() => setSaveFeedback(null), 3000)
        setServerOverrides(prev => ({ ...prev, [dateStr]: toPublish }))
        return
      }
      setSaveError(result.error || 'Save failed')
      return
    }

    // No admin password (e.g. not logged in): fall back to localStorage only
    if (e && (e.clues?.across?.length || e.clues?.down?.length)) {
      setAdminPuzzleEdits(dateStr, e)
    } else {
      setAdminPuzzleEdits(dateStr, null)
    }
    setSaveFeedback('browser-' + dateStr)
    setTimeout(() => setSaveFeedback(null), 2000)
  }, [edits, adminPassword, serverOverrides])

  const updateClue = useCallback((dateStr, dir, baseClue, field, value) => {
    setEdits(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      if (!next[dateStr]) next[dateStr] = { clues: { across: [], down: [] } }
      const list = next[dateStr].clues[dir]
      const existing = list.find(x => x.n === baseClue.n && x.r === baseClue.r && x.c === baseClue.c)
      const entry = { n: baseClue.n, r: baseClue.r, c: baseClue.c, len: baseClue.len, ...(existing || {}), [field]: value }
      if (existing) {
        const i = list.indexOf(existing)
        list[i] = entry
      } else {
        list.push(entry)
      }
      return next
    })
  }, [])

  const handleFix37Down = useCallback(async () => {
    if (!adminPassword) return
    setFix37Status(null)
    setFix37Loading(true)
    const today = getIstDateStr()
    const result = await fixClue(today, 'down', 37, FIX_37_DOWN_CLUE, adminPassword)
    setFix37Loading(false)
    if (result.ok) {
      setFix37Status('Fixed. All users will see the correct clue.')
      setTimeout(() => setFix37Status(null), 5000)
    } else {
      setFix37Status(result.error || 'Failed')
    }
  }, [adminPassword])

  const todayPuzzle = serverOverrides[istToday] ?? getBasePuzzleForDate(istToday)

  const renderExpandableEditorRow = (dateStr, { past }) => {
    const puzzle = serverOverrides[dateStr] ?? getBasePuzzleForDate(dateStr)
    const isOpen = expanded === dateStr
    return (
      <div key={dateStr} style={upcomingStyles.card}>
        <button
          type="button"
          onClick={() => handleExpand(dateStr, isOpen)}
          style={upcomingStyles.cardHeader}
        >
          <span style={upcomingStyles.dateLabel}>
            {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <span style={upcomingStyles.dateBadge}>{dateStr}</span>
          {past && <span style={upcomingStyles.pastDayBadge}>Past</span>}
          {serverOverrides[dateStr] && <span style={upcomingStyles.editedBadge}>Published</span>}
          <span style={{ ...upcomingStyles.expandIcon, transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
        </button>
        {isOpen && puzzle && (
          <div style={upcomingStyles.cardBody}>
            <UpcomingPuzzleEditorBody
              dateStr={dateStr}
              puzzle={puzzle}
              istTodayStr={istToday}
              saving={saving}
              saveFeedback={saveFeedback}
              saveEdits={saveEdits}
              updateClue={updateClue}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Today, past & upcoming puzzles</h2>
        <span style={styles.archiveHint}>
          <strong>Today</strong> is always expanded: full grid, all clues, and trivia — same source players get from the server. Use <strong>Past</strong> / <strong>Upcoming</strong> lists for other days. Edit words or clues, then Save to publish for that date.
        </span>
      </div>
      <div style={{ margin: '0 24px 16px', padding: '14px 16px', border: '1px solid #e5e2da', borderRadius: 10, background: '#fafaf9' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.textPrimary, fontFamily: FONTS.sans, marginBottom: 6 }}>
          Home Gate (block Home → lock gameplay)
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: FONTS.sans, marginBottom: 12, lineHeight: 1.45 }}>
          When enabled for a date, users can&apos;t start or resume that day&apos;s puzzle from Home. Completed players can still view results.
        </div>
        {homeGateError && (
          <div style={{ marginBottom: 10, padding: 10, background: '#fde8e6', borderRadius: 8, color: COLORS.error, fontSize: 13 }}>
            {homeGateError}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {gateDates.map(dateStr => {
            const g = homeGateByDate?.[dateStr] || { block_home: false, message: '' }
            const blocked = !!g.block_home
            const saving = !!gateSaving?.[dateStr]
            const label = new Date(dateStr + 'T12:00:00').toLocaleDateString(
              'en-IN',
              { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
            )
            return (
              <div key={dateStr} style={upcomingStyles.gateRow}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 700, fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textPrimary }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: FONTS.sans }}>{dateStr}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleHomeGate(dateStr)}
                  disabled={saving}
                  style={{
                    ...upcomingStyles.toggleBtn,
                    ...(blocked ? upcomingStyles.toggleBtnOn : upcomingStyles.toggleBtnOff),
                    opacity: saving ? 0.7 : 1,
                    cursor: saving ? 'wait' : 'pointer',
                  }}
                >
                  {saving ? 'Saving…' : blocked ? 'Blocked' : 'Open'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
      {adminPassword && getIstDateStr() === '2026-03-16' && (
        <div style={{ marginBottom: 16, padding: '10px 12px', background: '#f5f5f5', borderRadius: 8, fontSize: 13, fontFamily: FONTS.sans }}>
          <span style={{ color: COLORS.textMid }}>Today&apos;s 37 Down: clue accidentally revealed the answer. Set to: &quot;{FIX_37_DOWN_CLUE}&quot;</span>
          <button type="button" onClick={handleFix37Down} disabled={fix37Loading} style={{ marginLeft: 10, padding: '4px 10px', background: COLORS.accent, color: COLORS.white, border: 'none', borderRadius: 4, cursor: fix37Loading ? 'wait' : 'pointer', fontWeight: 600 }}>
            {fix37Loading ? 'Fixing…' : 'Fix now'}
          </button>
          {fix37Status && <span style={{ marginLeft: 10, color: fix37Status.startsWith('Fixed') ? '#0a0' : COLORS.error }}>{fix37Status}</span>}
        </div>
      )}
      <div style={{ padding: '16px 24px 24px' }}>
        {saveError && (
          <div style={{ marginBottom: 16, padding: 12, background: '#fde8e6', borderRadius: 8, color: COLORS.error, fontSize: 13 }}>
            {saveError}
          </div>
        )}

        <div style={upcomingStyles.todayHeroWrap}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: '1 1 280px' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontFamily: FONTS.serif, fontWeight: 700, color: COLORS.textPrimary }}>
                Today&apos;s live puzzle ({istToday})
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: COLORS.textMuted, fontFamily: FONTS.sans, maxWidth: 720, lineHeight: 1.55 }}>
                Everything below is what the site serves for today: full answer grid, every across/down clue, and trivia. Save applies immediately for players opening today&apos;s puzzle (existing in-progress grids keep their letters until refresh).
              </p>
            </div>
            <button
              type="button"
              onClick={reloadTodayFromServer}
              disabled={todayReloading}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: `1px solid ${COLORS.accent}`,
                background: COLORS.white,
                color: COLORS.accent,
                fontWeight: 700,
                fontSize: 13,
                cursor: todayReloading ? 'wait' : 'pointer',
                fontFamily: FONTS.sans,
                flexShrink: 0,
                opacity: todayReloading ? 0.75 : 1,
              }}
            >
              {todayReloading ? 'Reloading…' : 'Reload from server'}
            </button>
          </div>
          <div style={{ ...upcomingStyles.cardBody, borderTop: 'none' }}>
            <UpcomingPuzzleEditorBody
              dateStr={istToday}
              puzzle={todayPuzzle}
              istTodayStr={istToday}
              saving={saving}
              saveFeedback={saveFeedback}
              saveEdits={saveEdits}
              updateClue={updateClue}
            />
          </div>
        </div>

        {pastDates.length > 0 && (
          <>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: COLORS.textPrimary, fontFamily: FONTS.sans, margin: '0 0 6px' }}>
              Past puzzle days
            </h3>
            <p style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: FONTS.sans, margin: '0 0 14px', lineHeight: 1.45 }}>
              Last two weeks (since launch). Expand a date to see clues and trivia as published — fix typos or wording and Save.
            </p>
            {pastDates.map((d) => renderExpandableEditorRow(d, { past: true }))}
          </>
        )}

        <h3 style={{ fontSize: 14, fontWeight: 800, color: COLORS.textPrimary, fontFamily: FONTS.sans, margin: pastDates.length ? '22px 0 6px' : '0 0 6px' }}>
          Upcoming days
        </h3>
        <p style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: FONTS.sans, margin: '0 0 14px', lineHeight: 1.45 }}>
          Tomorrow through four days out — same editor as today.
        </p>
        {futureDates.map((d) => renderExpandableEditorRow(d, { past: false }))}
      </div>
    </div>
  )
}

const upcomingStyles = {
  todayHeroWrap: {
    marginBottom: 28,
    padding: '18px 20px',
    border: `2px solid ${COLORS.accent}`,
    borderRadius: 12,
    background: 'linear-gradient(180deg, rgba(20,83,45,0.07) 0%, #fff 52%)',
  },
  pastDayBadge: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    background: 'rgba(100,100,120,0.15)',
    color: COLORS.textMuted,
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
  },
  card: { border: '1px solid #e5e2da', borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
  cardHeader: {
    width: '100%', padding: '14px 20px', background: '#fafaf9', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', fontFamily: 'inherit',
  },
  dateLabel: { fontWeight: 600, color: COLORS.textPrimary },
  dateBadge: { background: '#e0e0e0', padding: '2px 8px', borderRadius: 6, fontSize: 12, color: COLORS.textMuted },
  liveTodayBadge: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    background: 'rgba(180,100,30,0.18)',
    color: '#8b4513',
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
  },
  editedBadge: { background: 'rgba(92,138,118,0.2)', color: COLORS.accent, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 },
  expandIcon: { marginLeft: 'auto', color: COLORS.textMuted, fontSize: 12 },
  cardBody: { padding: '20px', borderTop: '1px solid #e5e2da', background: '#fff' },
  gridPreview: { marginBottom: 24 },
  clueSection: { marginBottom: 20 },
  clueRow: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 },
  clueNum: { width: 24, fontSize: 12, fontWeight: 700, color: COLORS.textMuted },
  input: { padding: '8px 12px', border: '1px solid #d4cfc7', borderRadius: 6, fontSize: 14, fontFamily: FONTS.sans },
  saveBtn: { padding: '10px 20px', background: COLORS.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    background: '#111',
    borderRadius: 10,
    padding: '18px 24px',
    marginBottom: 20,
    gap: 0,
    overflow: 'hidden',
  },
  statDivider: {
    width: 1,
    height: 40,
    background: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
    margin: '0 20px',
  },
  gateRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #e5e2da',
    background: '#fff',
  },
  toggleBtn: {
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontFamily: FONTS.sans,
    fontWeight: 800,
    fontSize: 13,
    minWidth: 110,
    color: COLORS.white,
  },
  toggleBtnOn: { background: COLORS.error },
  toggleBtnOff: { background: COLORS.accent },
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statCardAccent, background: color }} />
      <div style={styles.statCardBody}>
        <div style={{ ...styles.statCardValue, color }}>{value}</div>
        <div style={styles.statCardLabel}>{label}</div>
        <div style={styles.statCardSub}>{sub}</div>
      </div>
    </div>
  )
}

function ScoreBadge({ score, dim }) {
  const bg = score >= 90 ? '#d4ede1' : score >= 70 ? '#fff8c5' : '#fde8e6'
  const cl = score >= 90 ? '#1a6640' : score >= 70 ? '#7a6200' : '#c0392b'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      background: dim ? '#f0f0f0' : bg,
      color: dim ? '#555' : cl,
      fontWeight: 700,
      fontSize: 13,
    }}>
      {score}
    </span>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div style={styles.miniStat}>
      <div style={{ ...styles.miniStatValue, color: color || COLORS.textPrimary }}>{value}</div>
      <div style={styles.miniStatLabel}>{label}</div>
    </div>
  )
}

function ExpandedStat({ icon, label, value, color }) {
  return (
    <div style={styles.expandedStat}>
      <span style={styles.expandedStatIcon}>{icon}</span>
      <div>
        <div style={{ ...styles.expandedStatValue, color: color || COLORS.textPrimary }}>{value}</div>
        <div style={styles.expandedStatLabel}>{label}</div>
      </div>
    </div>
  )
}

function PuzzleStat({ label, value, sub, accent }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{
        fontFamily: FONTS.serif,
        fontSize: 32,
        fontWeight: 800,
        lineHeight: 1,
        color: accent ? COLORS.accentLight : '#f4f2ed',
        letterSpacing: -0.5,
        marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        color: 'rgba(255,255,255,0.45)',
        fontFamily: FONTS.sans,
      }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2, fontFamily: FONTS.sans }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatDate(d) {
  const dt = new Date(d)
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function scoreColor(s) {
  return s >= 85 ? COLORS.successText : s >= 70 ? '#7a6200' : COLORS.error
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = {
  // Gate
  gateWrap: {
    minHeight: '100vh',
    background: '#0e1117',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: FONTS.sans,
    padding: 20,
  },
  gateCard: {
    background: '#1a1d26',
    border: '1px solid #2a2d3a',
    borderRadius: 16,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 380,
    textAlign: 'center',
  },
  gateLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: COLORS.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  gateLogoText: {
    color: '#fff',
    fontFamily: FONTS.serif,
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: 1,
  },
  gateTitle: {
    color: '#f4f2ed',
    fontSize: 24,
    fontWeight: 700,
    margin: '0 0 6px',
    fontFamily: FONTS.serif,
  },
  gateSub: {
    color: '#6b7280',
    fontSize: 13,
    margin: '0 0 32px',
  },
  gateField: {
    marginBottom: 16,
  },
  gateInput: {
    width: '100%',
    padding: '12px 16px',
    background: '#0e1117',
    border: '1px solid #2a2d3a',
    borderRadius: 8,
    color: '#f4f2ed',
    fontSize: 15,
    fontFamily: FONTS.sans,
    outline: 'none',
    boxSizing: 'border-box',
  },
  gateInputErr: {
    borderColor: COLORS.error,
  },
  gateErrMsg: {
    color: COLORS.error,
    fontSize: 12,
    margin: '8px 0 0',
    textAlign: 'left',
  },
  gateBtn: {
    width: '100%',
    padding: '13px',
    background: COLORS.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: FONTS.sans,
    marginBottom: 16,
  },
  gateHint: {
    color: '#3d4150',
    fontSize: 11,
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Dashboard shell — LOCKED: height + overflow:hidden required for content scroll to work
  wrap: {
    height: '100vh',
    maxHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#f4f2ed',
    fontFamily: FONTS.sans,
  },
  topbar: {
    flexShrink: 0,
    background: '#111111',
    borderBottom: '1px solid #1e1e1e',
  },
  topbarInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  topbarLogo: {
    width: 36,
    height: 36,
    borderRadius: 9,
    background: COLORS.accent,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontFamily: FONTS.serif,
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 1,
    flexShrink: 0,
  },
  topbarTitle: {
    color: '#f4f2ed',
    fontWeight: 700,
    fontSize: 16,
  },
  topbarSub: {
    color: '#666',
    fontSize: 12,
  },
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    padding: 0,
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#aaa',
    cursor: 'pointer',
    fontFamily: FONTS.sans,
  },
  deployBtn: {
    background: COLORS.accent,
    border: 'none',
    color: '#fff',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONTS.sans,
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #333',
    color: '#aaa',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: FONTS.sans,
  },
  deleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    padding: 0,
    background: 'transparent',
    border: '1px solid #f0ccc8',
    borderRadius: 6,
    color: COLORS.error,
    cursor: 'pointer',
    fontFamily: FONTS.sans,
  },
  deleteBtnHover: {
    background: '#fde8e6',
    borderColor: COLORS.error,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modalCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.textPrimary,
    marginBottom: 12,
    fontFamily: FONTS.sans,
  },
  modalCancelBtn: {
    padding: '8px 18px',
    background: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: FONTS.sans,
  },
  modalDeleteBtn: {
    padding: '8px 18px',
    background: COLORS.error,
    border: 'none',
    color: '#fff',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONTS.sans,
  },
  tabBar: {
    flexShrink: 0,
    background: '#fff',
    borderBottom: '1px solid #e5e2da',
  },
  tabBarInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    gap: 4,
  },
  tabBtn: {
    padding: '14px 20px',
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    color: COLORS.textMuted,
    fontFamily: FONTS.sans,
    transition: 'color 0.15s',
  },
  tabBtnActive: {
    color: COLORS.accent,
    borderBottomColor: COLORS.accent,
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: 'scroll',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    width: '100%',
    maxWidth: 1600,
    margin: '0 auto',
    padding: '28px 24px 60px',
    boxSizing: 'border-box',
  },

  // Stat cards
  cardRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e5e2da',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  statCardAccent: {
    height: 4,
  },
  statCardBody: {
    padding: '20px 20px 18px',
  },
  statCardValue: {
    fontSize: 32,
    fontWeight: 800,
    fontFamily: FONTS.serif,
    lineHeight: 1,
    marginBottom: 4,
  },
  statCardLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  statCardSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Section / table
  section: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e5e2da',
    overflow: 'hidden',
  },
  sectionHeader: {
    padding: '18px 24px',
    borderBottom: '1px solid #f0ede6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: COLORS.textPrimary,
  },
  searchInput: {
    padding: '8px 14px',
    border: '1px solid #d4cfc7',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: FONTS.sans,
    outline: 'none',
    minWidth: 240,
    background: '#fafaf9',
    color: COLORS.textPrimary,
  },
  archiveHint: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    padding: '12px 20px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.textMuted,
    background: '#fafaf9',
    borderBottom: '1px solid #f0ede6',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 20px',
    borderBottom: '1px solid #f5f3ef',
    color: COLORS.textPrimary,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    display: undefined,
  },
  avatarChip: {
    display: 'inline-flex',
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: COLORS.accent,
    color: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    marginRight: 10,
    verticalAlign: 'middle',
  },
  tdName: {
    fontWeight: 600,
  },
  phoneText: {
    fontFamily: 'monospace',
    fontSize: 13,
    marginRight: 8,
    color: COLORS.textMid,
  },
  revealPhoneBtn: {
    fontSize: 11,
    padding: '2px 8px',
    border: '1px solid #d4cfc7',
    borderRadius: 4,
    background: 'transparent',
    cursor: 'pointer',
    color: COLORS.textMuted,
    fontFamily: FONTS.sans,
  },
  tableFooter: {
    padding: '12px 20px',
    fontSize: 12,
    color: COLORS.textMuted,
    borderTop: '1px solid #f0ede6',
  },
  emptyState: {
    padding: '40px 24px',
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 14,
  },

  // Puzzle archive
  puzzleList: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  puzzleCard: {
    border: '1px solid #e5e2da',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#fafaf9',
  },
  puzzleCardHeader: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    fontFamily: FONTS.sans,
    gap: 12,
  },
  puzzleCardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 220,
  },
  puzzleDate: {
    fontWeight: 700,
    fontSize: 14,
    color: COLORS.textPrimary,
    whiteSpace: 'nowrap',
  },
  catBadge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  puzzleCardRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    flex: 1,
    justifyContent: 'flex-end',
  },
  miniStat: {
    textAlign: 'center',
    minWidth: 60,
  },
  miniStatValue: {
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1,
  },
  miniStatLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expandIcon: {
    fontSize: 18,
    color: COLORS.textMuted,
    transition: 'transform 0.2s',
    display: 'inline-block',
    marginLeft: 8,
  },
  puzzleExpanded: {
    padding: '16px 18px 18px',
    borderTop: '1px solid #e5e2da',
    background: '#fff',
  },
  expandedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    marginBottom: 16,
  },
  expandedStat: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    background: '#fafaf9',
    borderRadius: 8,
    border: '1px solid #f0ede6',
  },
  expandedStatIcon: {
    fontSize: 20,
    flexShrink: 0,
  },
  expandedStatValue: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
    marginBottom: 2,
  },
  expandedStatLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  completionBar: {
    marginTop: 4,
  },
  completionBarLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: COLORS.textMid,
    marginBottom: 6,
  },
  completionBarTrack: {
    height: 8,
    background: '#f0ede6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  completionBarFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.4s ease',
  },
}
