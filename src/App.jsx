import { useState, useEffect, useRef, useCallback } from 'react'
import { S, COLORS, FONTS } from './utils/styles.js'
import { getCountdown, pairFor, numAt, hasPlayedToday, markPlayedToday, getIstDateStr, saveUser, getSavedUser, hasSeenRules, markSeenRules, saveProgress, loadProgress } from './utils/helpers.js'
import { checkEmailExists, register, login, resetPassword, requestPasswordReset, updatePassword, isAliasTaken } from './api/auth.js'
import { submitScore, getLeaderboard, hasScoreForDate, getScoreForDate } from './api/scores.js'
import { supabase, isSupabaseConfigured } from './lib/supabase.js'

// Once-per-day lock: disabled in dev (allow replay for testing); enabled in production builds.
const ONCE_PER_DAY_ENABLED = !import.meta.env.DEV
import { PENALTY, getScoringRulesItems } from './data/puzzles.js'
import { getPuzzleForDate } from './data/puzzleCalendar.js'

import SplashScreen        from './screens/SplashScreen.jsx'
import AuthScreen          from './screens/AuthScreen.jsx'
import PasswordScreen      from './screens/PasswordScreen.jsx'
import ForgotPasswordScreen from './screens/ForgotPasswordScreen.jsx'
import UsernameScreen      from './screens/UsernameScreen.jsx'
import HomeScreen        from './screens/HomeScreen.jsx'
import GameScreen        from './screens/GameScreen.jsx'
import LeaderboardScreen from './screens/LeaderboardScreen.jsx'
import AdminScreen       from './screens/AdminScreen.jsx'
import RecoveryPasswordScreen from './screens/RecoveryPasswordScreen.jsx'

export default function App() {
  // ── Admin panel — render immediately if URL hash is #admin ──────────────────
  if (typeof window !== 'undefined' && window.location.hash === '#admin') {
    return <AdminScreen />
  }

  // ── All state must be declared before any conditional returns ───────────────
  const [screen, setScreen] = useState('splash')

  // ── Auth ────────────────────────────────────────────────────────────────────
  const [email,   setEmail]   = useState('')
  const [alias,   setAlias]   = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [authError, setAuthError] = useState('')
  const [user,    setUser]    = useState(() => getSavedUser())

  // ── Puzzle ──────────────────────────────────────────────────────────────────
  const [puzzle, setPuzzle] = useState(null)
  const [puzzleDate, setPuzzleDate] = useState(null) // Date when puzzle was loaded (IST) — used to avoid submitting when day has reset

  // ── Once-per-day lock (localStorage + Supabase for cross-device sync) ─────────
  const [hasPlayedFromServer, setHasPlayedFromServer] = useState(false)
  const hasPlayed = hasPlayedToday('classic', user?.id) || hasPlayedFromServer

  // ── In-progress game resume state (keyed by user ID so new users never see previous user's progress) ──
  const [hasProgress, setHasProgress] = useState(() => {
    const u = getSavedUser()
    const saved = loadProgress(u?.id)
    return !!(saved && !saved.completed)
  })

  // ── Game state ──────────────────────────────────────────────────────────────
  const [ug,  setUg]  = useState([])   // user grid [r][c] = typed letter
  const [rev, setRev] = useState([])   // revealed cells [r][c] = bool
  const [chk, setChk] = useState([])   // checked cells [r][c] = bool

  const [sc,  setSc]  = useState(null) // selected cell [r, c]
  const [dir, setDir] = useState('across')
  const [clue, setClue] = useState(null)

  const [errors, setErrors] = useState(0)
  const [pen,    setPen]    = useState(0)

  // ── Completion state ─────────────────────────────────────────────────────────
  const [allFilled,       setAllFilled]       = useState(false)
  const [completed,       setCompleted]       = useState(false)
  const [submittedScore,  setSubmittedScore]  = useState(null)
  const [completedCorrect,setCompletedCorrect]= useState(false)
  const [showComplete,    setShowComplete]    = useState(false)

  // ── UI overlays ─────────────────────────────────────────────────────────────
  const [showRevMenu, setShowRevMenu] = useState(false)
  const [showScore,   setShowScore]   = useState(false)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [showScoringRules, setShowScoringRules] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false)

  // ── Recovery password (Supabase reset link) — after all state declared ───────
  if (showRecoveryPassword) {
    return (
      <RecoveryPasswordScreen
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmNewPassword}
        setConfirmPassword={setConfirmNewPassword}
        error={authError}
        setError={setAuthError}
        onSubmit={async () => {
          try {
            await updatePassword(newPassword)
            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', window.location.pathname + window.location.search)
            }
            setNewPassword('')
            setConfirmNewPassword('')
            setAuthError('')
            setShowRecoveryPassword(false)
            setScreen('auth')
          } catch (err) {
            setAuthError(err?.message || 'Failed to update password')
          }
        }}
      />
    )
  }

  // ── Countdown timer ─────────────────────────────────────────────────────────
  const [cd, setCd] = useState('00:00:00')
  useEffect(() => {
    const t = setInterval(() => setCd(getCountdown()), 1000)
    return () => clearInterval(t)
  }, [])


  // ── Auto-advance from splash: check Supabase session or localStorage ──
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    if (hash.includes('type=recovery')) {
      setShowRecoveryPassword(true)
      setScreen('auth')
      return
    }
    setTimeout(async () => {
      try {
        if (isSupabaseConfigured()) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).single()
            const u = { id: session.user.id, email: session.user.email, username: profile?.username || 'user' }
            setUser(u)
            saveUser(u)
            setScreen('home')
            return
          }
        }
      } catch (e) {
        console.warn('Session check failed:', e.message)
      }
      const saved = getSavedUser()
      if (saved) {
        setUser(saved)
        setScreen('home')
      } else {
        setScreen('auth')
      }
    }, 1600)
  }, [])

  const logout = useCallback(async () => {
    if (isSupabaseConfigured()) await supabase.auth.signOut()
    saveUser(null)
    setUser(null)
    setEmail('')
    setAlias('')
    setPassword('')
    setConfirmPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
    setAuthError('')
    setHasPlayedFromServer(false)
    // Clear game state so next user doesn't inherit previous user's score/state
    setPuzzle(null)
    setPuzzleDate(null)
    setUg([])
    setRev([])
    setChk([])
    setSc(null)
    setDir('across')
    setClue(null)
    setErrors(0)
    setPen(0)
    setAllFilled(false)
    setCompleted(false)
    setSubmittedScore(null)
    setCompletedCorrect(false)
    setShowComplete(false)
    setLeaderboard([])
    setScreen('auth')
  }, [])

  // ── Keep document title as DailyFill (overrides any other tab title) ──────────
  useEffect(() => {
    if (typeof document !== 'undefined') document.title = 'DailyFill — Daily Crossword'
  }, [])

  // ── Use a ref for latest state in event handlers (avoids stale closures) ────
  const stateRef = useRef({})
  stateRef.current = { puzzle, ug, rev, chk, sc, dir, clue, pen, user, puzzleDate }

  // ── Fetch leaderboard when on home or leaderboard (so stats show after completing) ─
  useEffect(() => {
    if (screen !== 'home' && screen !== 'leaderboard') return
    getLeaderboard(getIstDateStr()).then(setLeaderboard)
  }, [screen])

  // ── Refetch leaderboard after completing (score may not be in DB yet on first fetch) ─
  useEffect(() => {
    if ((screen === 'home' || screen === 'leaderboard') && completed) {
      const t = setTimeout(() => getLeaderboard(getIstDateStr()).then(setLeaderboard), 800)
      return () => clearTimeout(t)
    }
  }, [screen, completed])

  // ── Reset hasPlayedFromServer when user changes (logout → new account must not inherit) ─
  const prevUserIdRef = useRef(null)
  useEffect(() => {
    if (prevUserIdRef.current !== user?.id) {
      prevUserIdRef.current = user?.id
      setHasPlayedFromServer(false)
    }
  }, [user?.id])

  // ── Cross-device "played today" sync: check Supabase when logged in ────────────
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return
    hasScoreForDate(user.id, getIstDateStr()).then(played => {
      if (played) {
        setHasPlayedFromServer(true)
        setHasProgress(false) // Don't show "Resume" if completed on another device
      }
    })
  }, [user?.id])

  // ── Recompute hasProgress when user changes (fixes new user seeing previous user's "Resume") ──
  useEffect(() => {
    const saved = loadProgress(user?.id)
    setHasProgress(!!(saved && !saved.completed))
  }, [user?.id])

  // ── Auto-save game progress to localStorage (restores on same-day revisit, keyed by user ID) ──
  useEffect(() => {
    if (screen !== 'game' || !puzzle) return
    saveProgress({ ug, rev, chk, pen, errors, allFilled, completed, submittedScore, completedCorrect, sc, dir }, user?.id)
    setHasProgress(!completed)
  }, [screen, puzzle, ug, rev, chk, pen, errors, allFilled, completed, submittedScore, completedCorrect, sc, dir, user?.id])

  // ── Physical keyboard support (letters, backspace, tab, arrow keys) ──────────
  useEffect(() => {
    if (screen !== 'game') return
    const handler = e => {
      if      (e.key === 'Backspace')   { e.preventDefault(); commitKey('⌫') }
      else if (e.key === 'Tab')         { e.preventDefault(); flipDir() }
      else if (e.key === 'ArrowRight')  { e.preventDefault(); moveArrow('right') }
      else if (e.key === 'ArrowLeft')   { e.preventDefault(); moveArrow('left') }
      else if (e.key === 'ArrowDown')   { e.preventDefault(); moveArrow('down') }
      else if (e.key === 'ArrowUp')     { e.preventDefault(); moveArrow('up') }
      else if (/^[a-zA-Z]$/.test(e.key)) commitKey(e.key.toUpperCase())
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [screen])

  // ─────────────────────────────────────────────────────────────────────────────
  // GAME CONTROL
  // ─────────────────────────────────────────────────────────────────────────────

  const doStartGame = useCallback(() => {
    const pz = getPuzzleForDate(getIstDateStr())
    if (!pz?.grid?.length) return
    const R = pz.grid.length
    const C = Math.max(pz.grid[0]?.length ?? 0, ...pz.grid.map(row => row?.length ?? 0))
    if (C < 1) return
    const today = getIstDateStr()
    setPuzzle(pz)
    setPuzzleDate(today)

    const saved = loadProgress(user?.id)
    const canResume = saved && !saved.completed && saved.ug?.length === R

    if (canResume) {
      // ── Restore in-progress game ────────────────────────────────────────────
      setUg(saved.ug)
      setRev(saved.rev)
      setChk(saved.chk)
      setPen(saved.pen ?? 0)
      setErrors(saved.errors ?? 0)
      setAllFilled(saved.allFilled ?? false)
      setCompleted(false)
      setSubmittedScore(null)
      setCompletedCorrect(false)
      setShowComplete(false)
      // Restore cursor position
      if (saved.sc) {
        const pair = pairFor(pz, saved.sc[0], saved.sc[1])
        const restoredDir = saved.dir || 'across'
        setSc(saved.sc)
        setDir(restoredDir)
        setClue(pair[restoredDir] || pair.across || pair.down || null)
      } else {
        setSc(null); setClue(null); setDir('across')
      }
    } else {
      // ── Fresh start ─────────────────────────────────────────────────────────
      setUg(Array.from({ length: R }, () => Array(C).fill('')))
      setRev(Array.from({ length: R }, () => Array(C).fill(false)))
      setChk(Array.from({ length: R }, () => Array(C).fill(false)))
      setErrors(0); setPen(0)
      setAllFilled(false); setCompleted(false); setSubmittedScore(null)
      setCompletedCorrect(false); setShowComplete(false)
      // Auto-select first cell so clue bar shows immediately
      const firstAcross = pz.clues?.across?.length
        ? [...pz.clues.across].sort((a, b) => (a.r - b.r) || (a.c - b.c))[0]
        : null
      if (firstAcross) {
        const pair = pairFor(pz, firstAcross.r, firstAcross.c)
        setSc([firstAcross.r, firstAcross.c])
        setDir('across')
        setClue(pair.across || null)
      } else {
        setSc(null); setClue(null); setDir('across')
      }
    }
    setScreen('game')
  }, [])

  const startGame = useCallback((options) => {
    // Resume Puzzle: skip rules — user already started; rules available via ? in nav
    if (options?.skipRules) {
      doStartGame()
      return
    }
    // Play Today's Puzzle: show rules modal only for first-time players
    if (!hasSeenRules()) {
      setShowRulesModal(true)
      return
    }
    doStartGame()
  }, [doStartGame])

  const onRulesUnderstood = useCallback(() => {
    markSeenRules()
    setShowRulesModal(false)
    doStartGame()
  }, [doStartGame])

  /** Revisit today's completed game to view result and trivia (same session or restored from localStorage) */
  const viewResultAndTrivia = useCallback(async () => {
    // Same session: game state already in App, just navigate
    if (puzzle && completed) {
      setScreen('game')
      return
    }
    // Restore from localStorage (e.g. user closed app and came back later)
    const pz = getPuzzleForDate(getIstDateStr())
    if (!pz?.grid?.length) return
    const R = pz.grid.length
    const C = Math.max(pz.grid[0]?.length ?? 0, ...pz.grid.map(row => row?.length ?? 0))
    if (C < 1) return

    const saved = loadProgress(user?.id)
    const hasCompletedSaved = saved?.completed && saved.ug?.length === R

    if (hasCompletedSaved) {
      setPuzzle(pz)
      setPuzzleDate(getIstDateStr())
      setUg(saved.ug)
      setRev(saved.rev ?? Array.from({ length: R }, () => Array(C).fill(false)))
      setChk(saved.chk ?? Array.from({ length: R }, () => Array(C).fill(false)))
      setPen(saved.pen ?? 0)
      setErrors(saved.errors ?? 0)
      setAllFilled(true)
      setCompleted(true)
      setSubmittedScore(saved.submittedScore ?? null)
      setCompletedCorrect(saved.completedCorrect ?? false)
      setShowComplete(false)
      if (saved.sc) {
        const pair = pairFor(pz, saved.sc[0], saved.sc[1])
        const restoredDir = saved.dir || 'across'
        setSc(saved.sc)
        setDir(restoredDir)
        setClue(pair[restoredDir] || pair.across || pair.down || null)
      } else {
        setSc(null); setClue(null); setDir('across')
      }
    } else if (hasPlayedFromServer || hasPlayedToday('classic', user?.id)) {
      // Completed on another device or localStorage cleared: show solved grid + trivia (no user input)
      let userScore = leaderboard.find(e => e.name === user?.username)?.score ?? submittedScore
      if (userScore == null && user?.id) {
        userScore = await getScoreForDate(user.id, getIstDateStr())
      }
      const solvedGrid = pz.grid.map(row => row.map(v => v || ''))
      const allChk = pz.grid.map(row => row.map(v => !!v))
      setPuzzle(pz)
      setPuzzleDate(getIstDateStr())
      setUg(solvedGrid)
      setRev(Array.from({ length: R }, () => Array(C).fill(false)))
      setChk(allChk)
      setPen(0)
      setErrors(0)
      setAllFilled(true)
      setCompleted(true)
      setSubmittedScore(userScore ?? null)
      setCompletedCorrect(true)
      setShowComplete(false)
      setSc(null); setClue(null); setDir('across')
    } else {
      setPuzzle(pz)
      setPuzzleDate(getIstDateStr())
      setUg(saved?.ug ?? Array.from({ length: R }, () => Array(C).fill('')))
      setRev(saved?.rev ?? Array.from({ length: R }, () => Array(C).fill(false)))
      setChk(saved?.chk ?? Array.from({ length: R }, () => Array(C).fill(false)))
      setPen(saved?.pen ?? 0)
      setErrors(saved?.errors ?? 0)
      setAllFilled(saved?.allFilled ?? false)
      setCompleted(saved?.completed ?? false)
      setSubmittedScore(saved?.submittedScore ?? null)
      setCompletedCorrect(saved?.completedCorrect ?? false)
      setShowComplete(false)
      setSc(null); setClue(null); setDir('across')
    }
    setScreen('game')
  }, [puzzle, completed, hasPlayedFromServer, leaderboard, user?.username, user?.id, submittedScore])

  const pickCell = useCallback((r, c, preferDir) => {
    const { puzzle: pz } = stateRef.current
    if (!pz?.grid[r]?.[c]) return
    const pair = pairFor(pz, r, c)
    let d = preferDir || stateRef.current.dir
    if (!pair[d] && pair[d === 'across' ? 'down' : 'across']) {
      d = d === 'across' ? 'down' : 'across'
    }
    setSc([r, c])
    setDir(d)
    setClue(pair[d] || null)
  }, [])

  const tap = (r, c) => {
    const { puzzle: pz, sc: sel, dir: d } = stateRef.current
    if (!pz?.grid[r]?.[c]) return
    if (sel && sel[0] === r && sel[1] === c) {
      const nd = d === 'across' ? 'down' : 'across'
      const pair = pairFor(pz, r, c)
      if (pair[nd]) { setDir(nd); setClue(pair[nd]) }
    } else {
      pickCell(r, c, d)
    }
  }

  const flipDir = () => {
    const { puzzle: pz, sc: sel, dir: d } = stateRef.current
    if (!sel || !pz) return
    const nd = d === 'across' ? 'down' : 'across'
    const pair = pairFor(pz, sel[0], sel[1])
    if (pair[nd]) { setDir(nd); setClue(pair[nd]) }
  }

  const moveArrow = useCallback((direction) => {
    const { puzzle: pz, sc: sel } = stateRef.current
    if (!sel || !pz) return
    const [r, c] = sel
    const R = pz.grid.length
    const C = pz.grid[0].length
    const dr = direction === 'down' ? 1 : direction === 'up' ? -1 : 0
    const dc = direction === 'right' ? 1 : direction === 'left' ? -1 : 0
    let nr = r + dr, nc = c + dc
    // Skip over black cells until we find the next white cell
    while (nr >= 0 && nr < R && nc >= 0 && nc < C) {
      if (pz.grid[nr]?.[nc]) {
        pickCell(nr, nc, direction === 'right' || direction === 'left' ? 'across' : 'down')
        return
      }
      nr += dr; nc += dc
    }
  }, [pickCell])

  const advance = (r, c, d) => {
    const { puzzle: pz, clue: cl, ug: g } = stateRef.current
    if (!pz) return

    // Returns true if a clue still has at least one empty cell
    const hasEmpty = (clue2, dir2) => {
      for (let i = 0; i < clue2.len; i++) {
        const rr = dir2 === 'across' ? clue2.r : clue2.r + i
        const cc = dir2 === 'across' ? clue2.c + i : clue2.c
        if (!g[rr]?.[cc]) return true
      }
      return false
    }

    const sortedAcross = [...pz.clues.across].sort((a, b) => a.n - b.n)
    const sortedDown   = [...pz.clues.down].sort((a, b) => (a.r - b.r) || (a.c - b.c))

    if (d === 'across') {
      // Step 1: still inside current word — move to next cell
      for (let nc = c + 1; nc < pz.grid[0].length; nc++) {
        if (!pz.grid[r]?.[nc]) break
        if (cl && nc >= cl.c + cl.len) break
        pickCell(r, nc, 'across'); return
      }
      // Step 2: word done — find the next across clue by number that has an empty cell
      const idx = cl ? sortedAcross.findIndex(x => x.n === cl.n) : -1
      for (let i = idx + 1; i < sortedAcross.length; i++) {
        if (hasEmpty(sortedAcross[i], 'across')) {
          pickCell(sortedAcross[i].r, sortedAcross[i].c, 'across'); return
        }
      }
      // Step 3: end of across list — switch direction to down
      for (const dc of sortedDown) {
        if (hasEmpty(dc, 'down')) {
          pickCell(dc.r, dc.c, 'down'); return
        }
      }
      // Step 4: everything filled — stay put
    } else {
      // Step 1: still inside current word — move to next cell
      for (let nr = r + 1; nr < pz.grid.length; nr++) {
        if (!pz.grid[nr]?.[c]) break
        if (cl && nr >= cl.r + cl.len) break
        pickCell(nr, c, 'down'); return
      }
      // Step 2: word done — find the next down clue by number that has an empty cell
      const idx = cl ? sortedDown.findIndex(x => x.n === cl.n) : -1
      for (let i = idx + 1; i < sortedDown.length; i++) {
        if (hasEmpty(sortedDown[i], 'down')) {
          pickCell(sortedDown[i].r, sortedDown[i].c, 'down'); return
        }
      }
      // Step 3: end of down list — switch direction to across
      for (const ac of sortedAcross) {
        if (hasEmpty(ac, 'across')) {
          pickCell(ac.r, ac.c, 'across'); return
        }
      }
      // Step 4: everything filled — stay put
    }
  }

  const recheckAllFilled = (ng, pz) => {
    for (let rr = 0; rr < pz.grid.length; rr++) {
      for (let cc = 0; cc < pz.grid[0].length; cc++) {
        if (pz.grid[rr][cc] && !ng[rr][cc]) { setAllFilled(false); return }
      }
    }
    setAllFilled(true)
  }

  const commitKey = useCallback((ch) => {
    const { puzzle: pz, ug: g, sc: sel, dir: d } = stateRef.current
    if (!sel || !pz) return
    const [r, c] = sel
    const ng = g.map(x => [...x])

    if (ch === '⌫') {
      if (ng[r][c]) { ng[r][c] = ''; setUg(ng); recheckAllFilled(ng, pz); return }
      if (d === 'across' && c > 0 && pz.grid[r][c - 1]) {
        ng[r][c - 1] = ''; setUg(ng); recheckAllFilled(ng, pz); pickCell(r, c - 1, 'across')
      } else if (d === 'down' && r > 0 && pz.grid[r - 1]?.[c]) {
        ng[r - 1][c] = ''; setUg(ng); recheckAllFilled(ng, pz); pickCell(r - 1, c, 'down')
      }
      return
    }

    ng[r][c] = ch
    setUg(ng)
    recheckAllFilled(ng, pz)
    advance(r, c, d)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // MARK COMPLETE
  // ─────────────────────────────────────────────────────────────────────────────

  const markComplete = () => {
    const { puzzle: pz, ug: g, rev: rv, chk: ck, pen: p } = stateRef.current
    if (!pz) return

    let wrongFilled = 0  // wrong letter, unchecked
    let emptyCells = 0   // empty cells (early submit)
    let allRight = true

    for (let rr = 0; rr < pz.grid.length; rr++) {
      for (let cc = 0; cc < pz.grid[0].length; cc++) {
        if (!pz.grid[rr][cc]) continue
        const entered = g[rr]?.[cc]
        const correct = entered === pz.grid[rr][cc]
        if (!correct) allRight = false
        if (rv[rr]?.[cc] || ck[rr]?.[cc]) continue // revealed or checked — no penalty
        if (!entered) emptyCells++
        else wrongFilled++
      }
    }

    const locked = Math.max(0, 100 - wrongFilled * PENALTY.wrongAtSubmit - emptyCells * PENALTY.emptyAtSubmit - p)
    setErrors(wrongFilled + emptyCells)
    setSubmittedScore(locked)
    setCompleted(true)
    setCompletedCorrect(allRight)
    setShowComplete(true)
    // Only submit and mark played if puzzle is still for today (day hasn't reset)
    const today = getIstDateStr()
    if (puzzleDate === today) {
      const { user: u } = stateRef.current
      markPlayedToday('classic', u?.id)
      if (u?.id) submitScore(u.id, today, locked, allRight)
    }
  }

  /** Submit early (incomplete puzzle): −1 pt per empty cell, −2 pts per wrong cell. Only when ≥30% filled. */
  const markCompleteEarly = () => {
    const { puzzle: pz, ug: g, rev: rv, chk: ck, pen: p } = stateRef.current
    if (!pz) return

    let totalCells = 0
    let filledCells = 0
    let wrongFilled = 0
    let allRight = true

    for (let rr = 0; rr < pz.grid.length; rr++) {
      for (let cc = 0; cc < pz.grid[0].length; cc++) {
        if (pz.grid[rr][cc]) {
          totalCells++
          const entered = g[rr]?.[cc]
          if (entered) filledCells++
          if (entered !== pz.grid[rr][cc]) {
            allRight = false
            if (!rv[rr]?.[cc] && !ck[rr]?.[cc] && entered) wrongFilled++
          }
        }
      }
    }

    const emptyCells = totalCells - filledCells
    const locked = Math.max(0, 100 - wrongFilled * PENALTY.wrongAtSubmit - emptyCells * PENALTY.emptyAtSubmit - p)
    setErrors(wrongFilled + emptyCells)
    setSubmittedScore(locked)
    setCompleted(true)
    setCompletedCorrect(allRight)
    setShowComplete(true)
    const today = getIstDateStr()
    if (puzzleDate === today) {
      const { user: u } = stateRef.current
      markPlayedToday('classic', u?.id)
      if (u?.id) submitScore(u.id, today, locked, allRight)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REVEAL HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  const revealLetter = () => {
    const { puzzle: pz, ug: g, rev: rv, sc: sel } = stateRef.current
    if (!sel || !pz) return
    const [r, c] = sel
    const ng = g.map(x => [...x])
    const nr = rv.map(x => [...x])
    if (!nr[r][c]) {
      const wasCorrect = g[r][c] === pz.grid[r][c]
      ng[r][c] = pz.grid[r][c]; nr[r][c] = true
      if (!wasCorrect) setPen(p => p + PENALTY.letter)
    }
    setUg(ng); setRev(nr); recheckAllFilled(ng, pz); setShowRevMenu(false)
  }

  const revealWord = () => {
    const { puzzle: pz, ug: g, rev: rv, clue: cl, dir: d } = stateRef.current
    if (!cl || !pz) return
    const ng = g.map(x => [...x])
    const nr = rv.map(x => [...x])
    let anyWrong = false
    for (let i = 0; i < cl.len; i++) {
      const rr = d === 'across' ? cl.r : cl.r + i
      const cc = d === 'across' ? cl.c + i : cl.c
      if (!nr[rr][cc]) {
        const wasCorrect = g[rr][cc] === pz.grid[rr][cc]
        ng[rr][cc] = pz.grid[rr][cc]; nr[rr][cc] = true
        if (!wasCorrect) anyWrong = true
      }
    }
    setUg(ng); setRev(nr)
    if (anyWrong) setPen(p => p + PENALTY.word)
    recheckAllFilled(ng, pz); setShowRevMenu(false)
  }

  const revealAll = () => {
    const { puzzle: pz, user: u } = stateRef.current
    if (!pz) return
    const ng = pz.grid.map(row => row.map(v => v || ''))
    const nr = pz.grid.map(row => row.map(v => !!v))
    setUg(ng); setRev(nr)
    setPen(PENALTY.all)
    setAllFilled(true); setShowRevMenu(false)
    markPlayedToday('classic', u?.id)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK WORD
  // ─────────────────────────────────────────────────────────────────────────────

  const checkWord = useCallback(() => {
    const { puzzle: pz, ug: g, chk: ck, clue: cl, dir: d } = stateRef.current
    if (!cl || !pz) return
    // Refuse to check if any cell in the word is empty
    for (let i = 0; i < cl.len; i++) {
      const rr = d === 'across' ? cl.r : cl.r + i
      const cc = d === 'across' ? cl.c + i : cl.c
      if (!g[rr]?.[cc]) return
    }
    const nc = ck.map(x => [...x])
    let anyWrong = false
    for (let i = 0; i < cl.len; i++) {
      const rr = d === 'across' ? cl.r : cl.r + i
      const cc = d === 'across' ? cl.c + i : cl.c
      nc[rr][cc] = true
      if (g[rr][cc] && g[rr][cc] !== pz.grid[rr][cc]) anyWrong = true
    }
    setChk(nc)
    if (anyWrong) setPen(p => p + PENALTY.checkWord)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // CELL STATE
  // ─────────────────────────────────────────────────────────────────────────────

  const cellState = (r, c) => {
    if (!puzzle?.grid) return 'black'
    if (!puzzle.grid[r]?.[c]) return 'black'
    const entered = ug[r]?.[c]
    if (rev[r]?.[c]) return 'revealed'
    if (completed && entered && entered !== puzzle.grid[r]?.[c]) return 'complete-wrong'
    if (chk[r]?.[c]) {
      if (!entered) return 'empty'
      return entered === puzzle.grid[r]?.[c] ? 'checked-right' : 'checked-wrong'
    }
    if (!entered) return 'empty'
    return 'plain'
  }

  const isInClue = (r, c) => {
    if (!clue) return false
    if (dir === 'across') return clue.r === r && c >= clue.c && c < clue.c + clue.len
    return clue.c === c && r >= clue.r && r < clue.r + clue.len
  }

  const score = Math.max(0, 100 - pen)

  const goToClue = useCallback((cl, direction) => {
    pickCell(cl.r, cl.c, direction)
  }, [pickCell])

  return (
    <div style={S.pageRoot}>
      {screen === 'splash' && <SplashScreen />}

      {screen === 'auth' && (
        <AuthScreen
          email={email}
          setEmail={setEmail}
          error={authError}
          setError={setAuthError}
          onContinue={async () => {
            const exists = await checkEmailExists(email.trim().toLowerCase())
            setIsNewUser(!exists)
            setPassword('')
            setConfirmPassword('')
            setAuthError('')
            setScreen('password')
          }}
        />
      )}

      {screen === 'password' && (
        <PasswordScreen
          email={email.trim().toLowerCase()}
          isExistingUser={!isNewUser}
          password={password}
          setPassword={setPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          error={authError}
          setError={setAuthError}
          onContinue={async () => {
            if (isNewUser) {
              setAuthError('')
              setScreen('username')
            } else {
              try {
                const u = await login(email.trim().toLowerCase(), password)
                setUser(u)
                saveUser(u)
                setAuthError('')
                setScreen('home')
              } catch (err) {
                setAuthError(err?.message || 'Incorrect password')
              }
            }
          }}
          onForgotPassword={() => {
            setNewPassword('')
            setConfirmNewPassword('')
            setAuthError('')
            setScreen('forgot')
          }}
          onBack={() => { setPassword(''); setConfirmPassword(''); setAuthError(''); setScreen('auth') }}
        />
      )}

      {screen === 'forgot' && (
        <ForgotPasswordScreen
          email={email.trim().toLowerCase()}
          useEmailOnly={isSupabaseConfigured()}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmNewPassword}
          setConfirmPassword={setConfirmNewPassword}
          error={authError}
          setError={setAuthError}
          onSubmit={async () => {
            try {
              if (isSupabaseConfigured()) {
                await requestPasswordReset(email.trim().toLowerCase())
                setAuthError('Check your email for a reset link.')
                setScreen('auth')
                return
              } else {
                await resetPassword(email.trim().toLowerCase(), newPassword)
                setAuthError('')
                setNewPassword('')
                setConfirmNewPassword('')
                setScreen('password')
              }
            } catch (err) {
              setAuthError(err?.message || 'Failed to reset password')
            }
          }}
          onBack={() => {
            setNewPassword('')
            setConfirmNewPassword('')
            setAuthError('')
            setScreen('password')
          }}
        />
      )}

      {screen === 'username' && (
        <UsernameScreen
          alias={alias} setAlias={setAlias}
          error={authError}
          setError={setAuthError}
          onCreate={async () => {
            if (alias.trim().length >= 3) {
              const u = await register(email.trim().toLowerCase(), password, alias.trim())
              if (u?.email) {
                setUser(u)
                saveUser(u)
                setScreen('home')
              } else {
                setAuthError('Check your email to confirm your account.')
                setScreen('auth')
              }
            }
          }}
        />
      )}

      {screen === 'home' && (
        <HomeScreen
          user={user}
          cd={cd}
          hasPlayed={ONCE_PER_DAY_ENABLED ? hasPlayed : false}
          hasProgress={hasProgress}
          startGame={startGame}
          viewResultAndTrivia={viewResultAndTrivia}
          goBoard={() => setScreen('leaderboard')}
          board={leaderboard}
          score={submittedScore ?? (hasPlayedFromServer ? leaderboard.find(e => e.name === user?.username)?.score : null)}
          onLogout={logout}
          onShowScoringRules={() => setShowScoringRules(true)}
        />
      )}

      {screen === 'game' && puzzle && (
        <GameScreen
          puzzle={puzzle} ug={ug} rev={rev} chk={chk}
          sc={sc} dir={dir} clue={clue}
          errors={errors} pen={pen} score={score}
          allFilled={allFilled}
          completed={completed}
          submittedScore={submittedScore}
          completedCorrect={completedCorrect}
          showComplete={showComplete} setShowComplete={setShowComplete}
          markComplete={markComplete}
          markCompleteEarly={markCompleteEarly}
          tap={tap} type={commitKey}
          cellState={cellState} numAt={(r, c) => numAt(puzzle, r, c)} isInClue={isInClue}
          flipDir={flipDir}
          showRevMenu={showRevMenu} setShowRevMenu={setShowRevMenu}
          revLetter={revealLetter} revWord={revealWord} revAll={revealAll}
          checkWord={checkWord}
          showScore={showScore} setShowScore={setShowScore}
          goToClue={goToClue}
          goBack={() => setScreen('home')}
          goBoard={() => setScreen('leaderboard')}
          user={user}
          onLogout={logout}
        />
      )}

      {screen === 'leaderboard' && (
        <LeaderboardScreen
          board={leaderboard}
          cd={cd}
          user={user}
          score={score}
          hasPlayed={ONCE_PER_DAY_ENABLED ? hasPlayed : false}
          goBack={() => setScreen('home')}
          onLogout={logout}
        />
      )}

      {/* ── Scoring rules modal (from home menu or game ?) ───────────────────── */}
      {showScoringRules && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 300, padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowScoringRules(false) }}
        >
          <div style={{
            background: COLORS.white, borderRadius: 16, padding: '32px 28px',
            width: '100%', maxWidth: 420, animation: 'popIn 0.25s ease', position: 'relative',
          }}>
            <button onClick={() => setShowScoringRules(false)} style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textFaint }}>✕</button>
            <div style={{ fontFamily: FONTS.serif, fontSize: 24, color: COLORS.textPrimary, marginBottom: 10 }}>How Scoring Works</div>
            <div style={{ color: '#666', fontSize: 15, marginBottom: 18, fontFamily: FONTS.sans, lineHeight: 1.5 }}>You start at 100 pts.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {getScoringRulesItems().map(({ icon, title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.textPrimary, fontFamily: FONTS.sans }}>{title}</div>
                    <div style={{ fontSize: 15, color: '#666', marginTop: 3, lineHeight: 1.5, fontFamily: FONTS.sans }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── First-time rules modal (shown before first play) ───────────────────── */}
      {showRulesModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 300,
            padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) {} }}
        >
          <div
            style={{
              background: COLORS.white,
              borderRadius: 18,
              padding: '28px 24px 24px',
              width: '100%',
              maxWidth: 440,
              maxHeight: '90vh',
              overflowY: 'auto',
              animation: 'popIn 0.25s ease',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontFamily: FONTS.serif, fontSize: 30, color: COLORS.textPrimary, marginBottom: 8 }}>
              How to Play
            </div>
            <div style={{ color: '#888', fontSize: 17, marginBottom: 24, fontFamily: FONTS.sans, lineHeight: 1.45 }}>
              Fill the grid using the clues. Tab or tap to switch between Across and Down.
            </div>
            <div style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.textPrimary, marginBottom: 8 }}>
              Scoring
            </div>
            <div style={{ color: '#888', fontSize: 14, marginBottom: 14, fontFamily: FONTS.sans, lineHeight: 1.4 }}>
              You start at 100 pts.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {getScoringRulesItems().map(({ icon, title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17, color: COLORS.textPrimary, fontFamily: FONTS.sans }}>{title}</div>
                    <div style={{ fontSize: 15, color: '#666', marginTop: 3, lineHeight: 1.45, fontFamily: FONTS.sans }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={onRulesUnderstood}
              style={{
                ...S.primaryBtn,
                marginTop: 24,
                width: '100%',
                padding: '14px 24px',
                fontSize: 17,
              }}
            >
              I Understand...Let's Go!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
