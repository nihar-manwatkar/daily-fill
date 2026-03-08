import { useState, useMemo, useCallback, useEffect } from 'react'
import { FaTrash } from 'react-icons/fa'
import { COLORS, FONTS } from '../utils/styles.js'
import PuzzleCreatorTab from './PuzzleCreatorTab.jsx'
import { getIstDatePlusDays } from '../utils/helpers.js'
import { getRegisteredUsersForAdmin, deleteUserForAdmin, triggerDeployForAdmin } from '../api/auth.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { getPuzzleForDate, getAdminPuzzleEdits, setAdminPuzzleEdits } from '../data/puzzleCalendar.js'

// Product launch date (IST). Every date from here to today is one puzzle day.
const LAUNCH_DATE = '2026-03-07'

function getIstToday() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return ist.toISOString().slice(0, 10)
}

function buildPuzzleArchive(statsOverride = null) {
  const today = getIstToday()
  const dates = []
  let cur = new Date(today + 'T00:00:00Z')
  const launch = new Date(LAUNCH_DATE + 'T00:00:00Z')
  let dayNum = Math.round((cur - launch) / 86400000) + 1
  const statsByDate = (statsOverride || []).reduce((acc, s) => { acc[s.date] = s; return acc }, {})
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

  const ADMIN_PW = 'dailyfill2026'

  const PUZZLE_ARCHIVE = useMemo(() => buildPuzzleArchive(puzzleStats), [puzzleStats])

  const refreshPuzzleStats = useCallback(async () => {
    if (!isSupabaseConfigured() || !authed) return
    try {
      const r = await fetch('/api/admin/stats', {
        headers: { 'X-Admin-Password': pw },
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok && data.stats) setPuzzleStats(data.stats)
    } catch (e) { console.warn('Puzzle stats fetch failed:', e) }
  }, [authed, pw])

  const refreshUsers = useCallback(async () => {
    const list = await getRegisteredUsersForAdmin(authed ? pw : '')
    setUsers(list)
  }, [authed, pw])

  useEffect(() => {
    if (authed && tab === 'users') refreshUsers()
  }, [authed, tab, refreshUsers])

  useEffect(() => {
    if (authed && tab === 'puzzles') refreshPuzzleStats()
  }, [authed, tab, refreshPuzzleStats])

  // Refresh users when localStorage changes (e.g. new signup in another tab)
  useEffect(() => {
    if (!authed) return
    const onStorage = (e) => {
      if (e.key === 'df_registered_users') refreshUsers()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [authed, refreshUsers])

  const handleLogin = () => {
    if (pw === ADMIN_PW) { setAuthed(true); setPwError(false) }
    else { setPwError(true); setPw('') }
  }

  // ── Derived user data ──────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase()
    let rows = users.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || u.phone || '').includes(q)
    )
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortAsc ? (av - bv) : (bv - av)
    })
    return rows
  }, [users, search, sortKey, sortAsc])

  const todayStr = getIstToday()
  const totalUsers    = users.length
  const activeToday   = users.filter(u => u.lastActive === todayStr).length
  const avgScore      = totalUsers > 0 ? Math.round(users.reduce((s, u) => s + (u.avgScore || 0), 0) / totalUsers) : '—'
  const totalGames    = users.reduce((s, u) => s + (u.games || 0), 0)

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
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ ...styles.tabBtn, ...(tab === t.id ? styles.tabBtnActive : {}) }}
            >
              <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
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
            {/* Stat cards */}
            <div style={styles.cardRow}>
              <StatCard label="Total Users"  value={totalUsers}  sub="Waiting for first sign-ups"    color="#2C4A3E" />
              <StatCard label="Active Today" value={activeToday} sub={activeToday > 0 ? 'Played today' : 'No activity yet'} color="#1a6080" />
              <StatCard label="Avg Score"    value={avgScore}    sub="No games played yet"            color="#805020" />
              <StatCard label="Total Games"  value={totalGames}  sub="Lifetime plays"                 color="#5020a0" />
            </div>

            {/* Search + table */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>All Users</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                      {[
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
                      ))}
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
                        <td style={styles.td}><strong>{u.games}</strong></td>
                        <td style={styles.td}>
                          <ScoreBadge score={u.bestScore} />
                        </td>
                        <td style={styles.td}>
                          <ScoreBadge score={u.avgScore} dim />
                        </td>
                        <td style={{ ...styles.td, color: u.lastActive === todayStr ? COLORS.successText : COLORS.textMuted }}>
                          {u.lastActive === todayStr ? '🟢 Today' : u.lastActive}
                        </td>
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
                    ) : 'No users match your search.'}
                  </div>
                )}
              </div>
              <div style={styles.tableFooter}>
                Showing {filteredUsers.length} of {users.length} users
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
                  const isToday = p.date === getIstToday()
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
                        const pz       = getPuzzleForDate(p.date)
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
        {tab === 'upcoming' && (
          <UpcomingPuzzlesSection />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            PUZZLE CREATOR TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'creator' && (
          <PuzzleCreatorTab />
        )}
      </div>

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

// ─── UPCOMING PUZZLES (next 5 days, editable) ─────────────────────────────────

function getWordFromGrid(grid, cl, dir) {
  let s = ''
  for (let i = 0; i < cl.len; i++) {
    const r = dir === 'across' ? cl.r : cl.r + i
    const c = dir === 'across' ? cl.c + i : cl.c
    s += grid[r]?.[c] || ''
  }
  return s
}

function UpcomingPuzzlesSection() {
  const [expanded, setExpanded] = useState(null)
  const [edits, setEdits] = useState({})
  const [saveFeedback, setSaveFeedback] = useState(null)

  const handleExpand = useCallback((dateStr, currentlyOpen) => {
    if (!currentlyOpen) {
      const existing = getAdminPuzzleEdits(dateStr)
      if (existing) setEdits(prev => ({ ...prev, [dateStr]: existing }))
    }
    setExpanded(currentlyOpen ? null : dateStr)
  }, [])

  const dates = useMemo(() =>
    [1, 2, 3, 4, 5].map(d => getIstDatePlusDays(d)),
    []
  )

  const saveEdits = useCallback((dateStr) => {
    const e = edits[dateStr]
    if (!e || (!e.clues?.across?.length && !e.clues?.down?.length)) {
      setAdminPuzzleEdits(dateStr, null)
    } else {
      setAdminPuzzleEdits(dateStr, e)
    }
    setSaveFeedback(dateStr)
    setTimeout(() => setSaveFeedback(null), 2000)
  }, [edits])

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

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Upcoming Puzzles (Next 5 Days)</h2>
        <span style={styles.archiveHint}>Unpublished. Edit clues or words, then Save.</span>
      </div>
      <div style={{ padding: '16px 24px 24px' }}>
        {dates.map(dateStr => {
          const puzzle = getPuzzleForDate(dateStr)
          const existingEdits = getAdminPuzzleEdits(dateStr)
          const isOpen = expanded === dateStr

          return (
            <div key={dateStr} style={upcomingStyles.card}>
              <button
                onClick={() => handleExpand(dateStr, isOpen)}
                style={upcomingStyles.cardHeader}
              >
                <span style={upcomingStyles.dateLabel}>
                  {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span style={upcomingStyles.dateBadge}>{dateStr}</span>
                {existingEdits && <span style={upcomingStyles.editedBadge}>Edited</span>}
                <span style={{ ...upcomingStyles.expandIcon, transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
              </button>

              {isOpen && puzzle && (
                <div style={upcomingStyles.cardBody}>

                  {/* ── Puzzle stats bar ── */}
                  {(() => {
                    const rows     = puzzle.grid.length
                    const cols     = puzzle.grid[0]?.length || 0
                    const total    = rows * cols
                    const black    = puzzle.grid.flat().filter(c => !c).length
                    const blackPct = total > 0 ? Math.round(black / total * 100) : 0
                    const nAcross  = puzzle.clues.across.length
                    const nDown    = puzzle.clues.down.length
                    return (
                      <div style={upcomingStyles.statsBar}>
                        <PuzzleStat label="Grid Size"    value={`${rows}×${cols}`}       />
                        <div style={upcomingStyles.statDivider} />
                        <PuzzleStat label="Black Cells"  value={`${blackPct}%`}          sub={`${black} of ${total}`} />
                        <div style={upcomingStyles.statDivider} />
                        <PuzzleStat label="Total Words"  value={nAcross + nDown}         accent />
                        <div style={upcomingStyles.statDivider} />
                        <PuzzleStat label="Across"       value={nAcross}                 />
                        <div style={upcomingStyles.statDivider} />
                        <PuzzleStat label="Down"         value={nDown}                   />
                      </div>
                    )
                  })()}
                  {/* Mini grid preview */}
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
                          <div key={`${r}-${c}`} style={{
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

                  {/* Editable clues */}
                  <div style={upcomingStyles.clueSection}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: COLORS.textPrimary }}>Across</div>
                    {puzzle.clues.across.map((cl) => {
                      const word = getWordFromGrid(puzzle.grid, cl, 'across')
                      return (
                        <div key={`a-${cl.n}`} style={upcomingStyles.clueRow}>
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
                        <div key={`d-${cl.n}`} style={upcomingStyles.clueRow}>
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

                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      onClick={() => saveEdits(dateStr)}
                      style={upcomingStyles.saveBtn}
                    >
                      Save changes
                    </button>
                    {saveFeedback === dateStr && (
                      <span style={{ color: COLORS.successText, fontSize: 13 }}>✓ Saved to browser</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const upcomingStyles = {
  card: { border: '1px solid #e5e2da', borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
  cardHeader: {
    width: '100%', padding: '14px 20px', background: '#fafaf9', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', fontFamily: 'inherit',
  },
  dateLabel: { fontWeight: 600, color: COLORS.textPrimary },
  dateBadge: { background: '#e0e0e0', padding: '2px 8px', borderRadius: 6, fontSize: 12, color: COLORS.textMuted },
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

  // Dashboard shell
  wrap: {
    minHeight: '100vh',
    background: '#f4f2ed',
    fontFamily: FONTS.sans,
  },
  topbar: {
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
    maxWidth: 1200,
    margin: '0 auto',
    padding: '28px 24px 60px',
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
