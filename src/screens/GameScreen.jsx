import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { S, COLORS, FONTS, FONT_SCALE } from '../utils/styles.js'
import { PENALTY } from '../data/puzzles.js'
import { numAt, pairFor, hasSeenSwipeHint, markSeenSwipeHint } from '../utils/helpers.js'
import { useIsMobile } from '../utils/useIsMobile.js'
import { FaWhatsapp, FaLinkedinIn, FaInstagram, FaFacebook, FaDownload, FaEllipsisH } from 'react-icons/fa'
import MobileCustomKeyboard from '../components/MobileCustomKeyboard.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getWordStr(puzzle, cl, dir) {
  let s = ''
  for (let i = 0; i < cl.len; i++) {
    const r = dir === 'across' ? cl.r : cl.r + i
    const c = dir === 'across' ? cl.c + i : cl.c
    s += puzzle.grid[r]?.[c] || ''
  }
  return s
}

function isWordCorrect(puzzle, ug, cl, dir) {
  for (let i = 0; i < cl.len; i++) {
    const r = dir === 'across' ? cl.r : cl.r + i
    const c = dir === 'across' ? cl.c + i : cl.c
    if ((ug[r]?.[c] || '') !== (puzzle.grid[r]?.[c] || '')) return false
  }
  return true
}

/** True when the user has filled every cell of a clue (any letters; no right/wrong check) */
function isClueFilled(ug, cl, dir) {
  for (let i = 0; i < cl.len; i++) {
    const r = dir === 'across' ? cl.r : cl.r + i
    const c = dir === 'across' ? cl.c + i : cl.c
    if (!ug[r]?.[c]) return false
  }
  return true
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/** Generates a 9:16 (540×960) branded result card and returns the canvas element. */
function generateShareCard({ submittedScore, score, puzzle, ug }) {
  const W = 540, H = 960
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  const displayScore = submittedScore ?? score
  const allClues = [...puzzle.clues.across, ...puzzle.clues.down]
  const wordsCorrect = allClues.filter(cl => {
    const d = puzzle.clues.across.includes(cl) ? 'across' : 'down'
    return isWordCorrect(puzzle, ug, cl, d)
  }).length
  const wordsWrong = allClues.length - wordsCorrect
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  // ── Background ─────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0d1b0d'
  ctx.fillRect(0, 0, W, H)

  // Subtle crossword grid pattern overlay
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  // Top accent bar
  ctx.fillStyle = '#4ade80'
  ctx.fillRect(0, 0, W, 5)

  // ── Logo ───────────────────────────────────────────────────────────────────
  ctx.font = 'bold 52px Georgia, serif'
  ctx.fillStyle = '#ffffff'
  const dailyW = ctx.measureText('Daily').width
  ctx.fillText('Daily', 48, 102)
  ctx.fillStyle = '#4ade80'
  ctx.fillText('Fill', 48 + dailyW, 102)

  // Date
  ctx.fillStyle = 'rgba(255,255,255,0.38)'
  ctx.font = '17px Arial, sans-serif'
  ctx.fillText(dateStr, 48, 134)

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(48, 160); ctx.lineTo(W - 48, 160); ctx.stroke()

  // ── Score section ──────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.38)'
  ctx.font = '13px Arial, sans-serif'
  ctx.fillText('Y O U R   S C O R E', 48, 212)

  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 168px Georgia, serif'
  const scoreStr = String(displayScore)
  ctx.fillText(scoreStr, 48, 408)
  const scoreTextW = ctx.measureText(scoreStr).width

  ctx.fillStyle = 'rgba(255,255,255,0.32)'
  ctx.font = 'bold 36px Georgia, serif'
  ctx.fillText('/ 100', 48 + scoreTextW + 14, 390)

  // Score progress bar
  const barX = 48, barY = 432, barW = W - 96, barH = 8
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  roundRect(ctx, barX, barY, barW, barH, 4); ctx.fill()
  ctx.fillStyle = '#4ade80'
  const filled = Math.max(6, Math.round(barW * Math.min(displayScore, 100) / 100))
  roundRect(ctx, barX, barY, filled, barH, 4); ctx.fill()

  // ── Words chips ────────────────────────────────────────────────────────────
  const chipY = 472, chipH = 58, chipW = 214

  ctx.fillStyle = '#166534'
  roundRect(ctx, 48, chipY, chipW, chipH, 29); ctx.fill()
  ctx.fillStyle = '#4ade80'
  ctx.font = 'bold 21px Arial, sans-serif'
  ctx.fillText(`✓  ${wordsCorrect} Correct`, 48 + 22, chipY + 37)

  ctx.fillStyle = wordsWrong > 0 ? '#7f1d1d' : '#166534'
  roundRect(ctx, 278, chipY, chipW, chipH, 29); ctx.fill()
  ctx.fillStyle = wordsWrong > 0 ? '#fca5a5' : '#4ade80'
  ctx.font = 'bold 21px Arial, sans-serif'
  ctx.fillText(`✕  ${wordsWrong} Wrong`, 278 + 22, chipY + 37)

  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.font = '15px Arial, sans-serif'
  ctx.fillText(`${allClues.length} words total`, 48, 572)

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(48, 618); ctx.lineTo(W - 48, 618); ctx.stroke()

  // ── CTA section ────────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '22px Arial, sans-serif'
  ctx.fillText('Can you beat my score?', 48, 692)

  ctx.fillStyle = '#4ade80'
  ctx.font = 'bold 30px Georgia, serif'
  ctx.fillText('dailyfill.app', 48, 738)

  ctx.font = '48px Arial, sans-serif'
  ctx.fillText('😈', W - 102, 742)

  // Bottom accent bar
  ctx.fillStyle = '#4ade80'
  ctx.fillRect(0, H - 5, W, 5)

  return canvas
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function GameScreen({
  puzzle, ug, rev, chk,
  sc, dir, clue,
  errors, pen, score,
  allFilled, completed, submittedScore, completedCorrect,
  showComplete, setShowComplete,
  markComplete,
  markCompleteEarly,
  tap, type,
  cellState, isInClue,
  flipDir,
  showRevMenu, setShowRevMenu,
  revLetter, revWord, revAll,
  checkWord,
  showScore, setShowScore,
  goToClue,
  cat = 'classic',
  goBack, goBoard,
  user,
  onLogout,
}) {
  const isMobile = useIsMobile()
  // Use full grid dimensions (not tight bounds) so 13×13 puzzles display correctly
  const R = puzzle?.grid?.length ?? 0
  const C = Math.max(0, ...(puzzle?.grid ?? []).map(r => r?.length ?? 0))
  const visR = Math.max(1, R)
  const visC = Math.max(1, C)
  const r0 = 0
  const c0 = 0
  const containerRef = useRef(null)
  const nativeInputRef = useRef(null)
  const [cellSize, setCellSize] = useState(36)

  // Tab state for clue panel: 'across' | 'down' | 'trivia'
  const [clueTab, setClueTab] = useState('clues')
  // Toggle between user's grid and the correct answer grid (post-completion)
  const [showAnswerGrid, setShowAnswerGrid] = useState(false)
  // Mobile header: burger menu dropdown open/close
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)
  // Mobile swipe: 0 = puzzle, 1 = clues, 2 = trivia
  const [mobilePage, setMobilePage] = useState(0)
  const swipeStartX = useRef(0)

  // First-time swipe hint: gently peek at clues, then return (mobile only)
  useEffect(() => {
    if (!isMobile || hasSeenSwipeHint() || completed) return
    const t1 = setTimeout(() => setMobilePage(1), 900)
    const t2 = setTimeout(() => {
      setMobilePage(0)
      markSeenSwipeHint()
    }, 2400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isMobile, completed])
  // Pre-generated share blob (ready before click) — avoids user-gesture expiration with async toBlob
  const shareBlobRef = useRef(null)
  const [shareToast, setShareToast] = useState(null)

  const maxCell = isMobile ? 52 : 56
  useEffect(() => {
    const measure = () => {
      const el = containerRef.current
      if (!el || visC < 1) return
      const w = Math.max(0, el.clientWidth - 24)
      const size = w > 0 ? Math.floor(w / visC) : 36
      setCellSize(Math.max(24, Math.min(maxCell, size || 36)))
    }
    measure()
    const t = setTimeout(measure, 100)
    const observer = new ResizeObserver(measure)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => { clearTimeout(t); observer.disconnect() }
  }, [visC, maxCell])

  // Mobile: custom keyboard — no native input focus

  // Pre-generate share blob when game completes — keeps share within user gesture when clicked
  useEffect(() => {
    if (!completed || !puzzle?.grid) return
    shareBlobRef.current = null
    const canvas = generateShareCard({ submittedScore, score, puzzle, ug })
    canvas.toBlob((blob) => { shareBlobRef.current = blob }, 'image/png')
  }, [completed, submittedScore, score, puzzle, ug])

  // Category display info — puzzle.meta injected by the generator when available
  const catInfo = puzzle?.meta?.catInfo || { icon: '📰', label: 'DailyFill' }
  const displayScore = completed ? submittedScore : score

  // ── Cell colours (normal play mode) ──────────────────────────────────────
  const cellBg = (r, c) => {
    if (showAnswerGrid) {
      // Answer grid: green = user was right, red = user was wrong
      const userLetter = ug[r]?.[c] || ''
      const correctLetter = puzzle.grid[r]?.[c] || ''
      if (!correctLetter) return COLORS.headerBg
      if (userLetter === correctLetter) return '#22c55e'
      return '#ef4444'
    }
    const state = cellState(r, c)
    const isSel = sc && sc[0] === r && sc[1] === c
    if (state === 'black') return COLORS.headerBg
    if (isSel) return COLORS.gold
    if (state === 'revealed') return COLORS.revealBg
    if (state === 'checked-right') return '#22c55e'
    if (state === 'checked-wrong') return '#ef4444'
    if (state === 'complete-wrong') return COLORS.errorBg
    if (isInClue(r, c)) return COLORS.clueHighlight
    return COLORS.white
  }

  const cellTextColor = (r, c) => {
    if (showAnswerGrid) return '#ffffff'
    const state = cellState(r, c)
    const isSel = sc && sc[0] === r && sc[1] === c
    if (state === 'checked-right') return isSel ? COLORS.textPrimary : '#14532d'
    if (state === 'checked-wrong') return '#ffffff'
    if (state === 'complete-wrong') return COLORS.error
    return COLORS.textPrimary
  }

  // ── Share logic ───────────────────────────────────────────────────────────
  const showShareToast = useCallback((msg) => {
    setShareToast(msg)
    setTimeout(() => setShareToast(null), 2500)
  }, [])

  const handleShare = useCallback(async (platform) => {
    const displayScore = submittedScore ?? score
    const shareText = `Hey I've scored ${displayScore} out of 100 on today's Daily Fill. Think you can beat me? 😈`
    const appUrl = 'https://dailyfill.app'

    if (platform === 'download') {
      const canvas = generateShareCard({ submittedScore, score, puzzle, ug })
      const link = document.createElement('a')
      link.download = `dailyfill-result-${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      showShareToast('Image downloaded')
      return
    }

    // Platform-specific share URLs (used when Web Share fails or isn't available)
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + appUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(appUrl)}&summary=${encodeURIComponent(shareText)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(appUrl)}&quote=${encodeURIComponent(shareText)}`,
      instagram: null, // No web share URL — use download + copy
      other: null,
    }

    const openUrlFallback = (key) => {
      const url = shareUrls[key]
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
        showShareToast(`Opened ${key === 'whatsapp' ? 'WhatsApp' : key === 'linkedin' ? 'LinkedIn' : 'Facebook'}`)
      }
    }

    // Download image + copy text (for platforms where URL fallback can't attach images)
    const downloadAndCopy = () => {
      const canvas = generateShareCard({ submittedScore, score, puzzle, ug })
      const link = document.createElement('a')
      link.download = `dailyfill-result-${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      try { navigator.clipboard.writeText(shareText + ' ' + appUrl) } catch { /* ignore */ }
    }

    // Use pre-generated blob when available; if not ready, generate on-demand (may expire user gesture)
    let blob = shareBlobRef.current
    if (!blob) {
      const canvas = generateShareCard({ submittedScore, score, puzzle, ug })
      blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
    }
    const file = blob ? new File([blob], 'dailyfill-result.png', { type: 'image/png' }) : null

    const tryShare = async () => {
      if (!navigator.share) return false
      // Always try image + text first when we have the file — don't gate on canShare (it can be absent or overly conservative)
      if (file) {
        try {
          await navigator.share({ files: [file], text: shareText })
          showShareToast('Shared!')
          return true
        } catch (e) {
          if (e.name === 'AbortError') return true // user cancelled
          /* fall through to text-only or URL fallback */
        }
      }
      // Fallback: text + URL only (no image)
      try {
        await navigator.share({ text: shareText, url: appUrl })
        showShareToast('Shared!')
        return true
      } catch (e) {
        if (e.name === 'AbortError') return true
      }
      return false
    }

    if (platform === 'instagram') {
      // Instagram has no web share; download image + copy text
      const canvas = generateShareCard({ submittedScore, score, puzzle, ug })
      const link = document.createElement('a')
      link.download = `dailyfill-result-${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      try {
        await navigator.clipboard.writeText(shareText)
        showShareToast('Image downloaded & text copied — paste in Instagram')
      } catch {
        showShareToast('Image downloaded — paste in Instagram')
      }
      return
    }

    if (platform === 'other') {
      const shared = await tryShare()
      if (!shared) {
        try {
          await navigator.clipboard.writeText(shareText + ' ' + appUrl)
          showShareToast('Link copied to clipboard')
        } catch {
          showShareToast('Share not available — try Download')
        }
      }
      return
    }

    // whatsapp, linkedin, facebook: try Web Share first, then fallback
    const shared = await tryShare()
    if (!shared) {
      // WhatsApp: wa.me only supports text — use download + copy so user gets image too
      if (platform === 'whatsapp') {
        downloadAndCopy()
        showShareToast('Image downloaded & text copied — paste in WhatsApp and attach image')
      } else {
        openUrlFallback(platform)
      }
    }
  }, [submittedScore, score, puzzle, ug, showShareToast])

  // Clues in semantic order (by number, then by grid position as fallback)
  const sortedAcross = useMemo(
    () => [...puzzle.clues.across].sort((a, b) => (a.n - b.n) || (a.r - b.r) || (a.c - b.c)),
    [puzzle.clues.across]
  )
  const sortedDown = useMemo(
    () => [...puzzle.clues.down].sort((a, b) => (a.n - b.n) || (a.c - b.c) || (a.r - b.r)),
    [puzzle.clues.down]
  )

  // Sequential clue list for mobile: across first, then down (for prev/next navigation)
  const sequentialClues = useMemo(
    () => [
      ...sortedAcross.map(cl => ({ cl, dir: 'across' })),
      ...sortedDown.map(cl => ({ cl, dir: 'down' })),
    ],
    [sortedAcross, sortedDown]
  )
  const currentClueIndex = clue
    ? sequentialClues.findIndex(
        ({ cl, dir: d }) => cl.n === clue.n && d === dir
      )
    : -1
  const hasPrevClue = currentClueIndex > 0
  const hasNextClue = currentClueIndex >= 0 && currentClueIndex < sequentialClues.length - 1

  // ── Fill percent (for early submit: show option when ≥30%) ─────────────────
  const fillPercent = useMemo(() => {
    if (!puzzle?.grid) return 0
    let total = 0, filled = 0
    for (let r = 0; r < puzzle.grid.length; r++) {
      for (let c = 0; c < (puzzle.grid[r]?.length ?? 0); c++) {
        if (puzzle.grid[r]?.[c]) {
          total++
          if (ug[r]?.[c]) filled++
        }
      }
    }
    return total > 0 ? filled / total : 0
  }, [puzzle?.grid, ug])

  // ── Trivia data for the clue panel tab ──────────────────────────────────
  const allTriviaItems = [
    ...sortedAcross.map(cl => ({ cl, dir: 'across' })),
    ...sortedDown.map(cl => ({ cl, dir: 'down' })),
  ].filter(({ cl }) => cl.trivia)

  // Share icons config — uses real brand icons from react-icons/fa
  const shareIcons = [
    { icon: <FaWhatsapp size={22} color="#fff" />,    label: 'WhatsApp',  key: 'whatsapp',  bg: '#25D366' },
    { icon: <FaLinkedinIn size={20} color="#fff" />,  label: 'LinkedIn',  key: 'linkedin',  bg: '#0A66C2' },
    { icon: <FaInstagram size={21} color="#fff" />,   label: 'Instagram', key: 'instagram', bg: 'linear-gradient(135deg,#fd5949,#d6249f,#285AEB)' },
    { icon: <FaFacebook size={22} color="#fff" />,    label: 'Facebook',  key: 'facebook',  bg: '#1877F2' },
    { icon: <FaEllipsisH size={18} color="#fff" />,   label: 'More',      key: 'other',     bg: '#555' },
    { icon: <FaDownload size={18} color="#fff" />,    label: 'Download',  key: 'download',  bg: '#222' },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      ...S.screen,
      background: COLORS.paper || COLORS.bg,
      userSelect: 'none',
      ...(!isMobile && {
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      }),
    }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ background: COLORS.accent, padding: '10px 16px', flexShrink: 0, borderBottom: `1px solid ${COLORS.accentLight}`, position: 'relative' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={goBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.9)', fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1, flexShrink: 0 }}>
            ← Back
          </button>
          <div style={{ fontFamily: FONTS.serif, fontSize: 20, color: COLORS.white, letterSpacing: 0.5 }}>
            DailyFill
          </div>
          {isMobile ? (
            /* Mobile: Score + burger menu */
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: FONTS.sans }}>Score: {displayScore} pts</span>
                <button
                  onClick={() => setShowScore(true)}
                  style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.22)', border: '1.5px solid rgba(255,255,255,0.55)',
                    color: COLORS.white, fontWeight: 800, fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, flexShrink: 0, fontFamily: FONTS.sans,
                  }}
                  title="How scoring works"
                >
                  ?
                </button>
              </div>
              <div style={{ position: 'relative', zIndex: 100 }}>
                <button
                  onClick={() => setShowHeaderMenu(v => !v)}
                  style={{
                    width: 36, height: 36, borderRadius: 6,
                    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)',
                    color: COLORS.white, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0,
                  }}
                  aria-label="Menu"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
                {showHeaderMenu && (
                  <div
                    style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: 4,
                      background: COLORS.white, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                      overflow: 'hidden', minWidth: 140, zIndex: 100,
                    }}
                  >
                    <button
                      onClick={() => { setShowScore(true); setShowHeaderMenu(false) }}
                      style={{
                        display: 'block', width: '100%', padding: '12px 16px',
                        textAlign: 'left', border: 'none', background: 'none',
                        fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textPrimary,
                        cursor: 'pointer',
                      }}
                    >
                      How scoring works
                    </button>
                    {onLogout && (
                      <button
                        onClick={() => { onLogout(); setShowHeaderMenu(false) }}
                        style={{
                          display: 'block', width: '100%', padding: '12px 16px',
                          textAlign: 'left', border: 'none', background: 'none',
                          fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textPrimary,
                          cursor: 'pointer', borderTop: `1px solid ${COLORS.border}`,
                        }}
                      >
                        Log out
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Desktop: date, score, ?, username, Log out */
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: FONTS.sans, flexWrap: 'wrap' }}>
              <span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span>·</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: 'rgba(255,255,255,0.9)' }}>Score: {displayScore} pts</span>
                <button
                  onClick={() => setShowScore(true)}
                  style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.22)', border: '1.5px solid rgba(255,255,255,0.55)',
                    color: COLORS.white, fontWeight: 800, fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, flexShrink: 0, fontFamily: FONTS.sans,
                  }}
                  title="How scoring works"
                >
                  ?
                </button>
              </div>
              {user?.username && (
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{user.username}</span>
              )}
              {onLogout && (
                <button onClick={onLogout} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.5)', color: 'rgba(255,255,255,0.9)', fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: FONTS.sans }}>Log out</button>
              )}
            </div>
          )}
        </div>
        {isMobile && showHeaderMenu && (
          <div
            onClick={() => setShowHeaderMenu(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* ── Mobile: Page indicator (puzzle | clues | trivia) ──────────────────── */}
      {isMobile && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8, padding: '8px 0 4px',
          flexShrink: 0, background: COLORS.paper || COLORS.bg,
        }}>
          {['Puzzle', 'Clues List', 'Trivia'].map((label, i) => (
            <button
              key={label}
              onClick={() => setMobilePage(i)}
              style={{
                background: 'none', border: 'none', padding: '4px 8px',
                fontSize: 11, fontWeight: 700, fontFamily: FONTS.sans,
                color: mobilePage === i ? COLORS.accent : COLORS.textMuted,
                cursor: 'pointer',
              }}
            >
              <span style={{
                display: 'inline-block',
                width: 8, height: 8, borderRadius: '50%',
                background: mobilePage === i ? COLORS.accent : COLORS.border,
                marginRight: 4, verticalAlign: 'middle',
              }} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Main: grid column + clue panel column (desktop) or swipe (mobile) ─── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          padding: isMobile ? 12 : 16,
          maxWidth: isMobile ? '100%' : 1400,
          margin: '0 auto',
          width: '100%',
        }}
        onTouchStart={e => { if (isMobile) swipeStartX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          if (!isMobile) return
          const dx = e.changedTouches[0].clientX - swipeStartX.current
          if (dx < -50) setMobilePage(p => Math.min(2, p + 1))
          else if (dx > 50) setMobilePage(p => Math.max(0, p - 1))
        }}
      >
        {isMobile ? (
          /* Mobile: 3 separate swipe panels — use 100% to avoid overflow, center content */
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              height: '100%',
              width: '300%',
              flexShrink: 0,
              transform: `translate3d(-${mobilePage * 33.333}%, 0, 0)`,
              transition: 'transform 0.25s ease',
              willChange: 'transform',
              WebkitBackfaceVisibility: 'hidden',
            }}>
              {/* Panel 0: Puzzle only — grid + clue bar + keyboard + action buttons */}
              <div style={{
                width: '33.333%',
                minWidth: '33.333%',
                flexShrink: 0,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingLeft: 12,
                paddingRight: 12,
                boxSizing: 'border-box',
                WebkitOverflowScrolling: 'touch',
              }}>

          {/* Green clue bar (above grid) — desktop only */}
          {clue && !isMobile && (
            <div style={{
              width: visC * cellSize, maxWidth: '100%',
              background: COLORS.accent,
              color: COLORS.white,
              padding: '12px 16px',
              borderRadius: '8px 8px 0 0',
              marginBottom: 0,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: Math.round(14 * FONT_SCALE), fontFamily: FONTS.sans, fontWeight: 600 }}>
                {clue.n} {dir === 'across' ? 'Across' : 'Down'}: {clue.clue}
              </span>
            </div>
          )}

          {/* Grid */}
          <div
            ref={containerRef}
            style={{
              flexShrink: 0,
              width: isMobile ? '100%' : undefined,
              minWidth: isMobile ? undefined : Math.min(700, visC * 42),
              minHeight: visR * cellSize,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
            }}
          >
            <div style={{
              display: 'inline-grid',
              gridTemplateColumns: `repeat(${visC}, ${cellSize}px)`,
              gridTemplateRows:    `repeat(${visR}, ${cellSize}px)`,
              border: `2px solid ${COLORS.textPrimary}`,
              background: COLORS.textPrimary,
              flexShrink: 0,
            }}>
              {Array.from({ length: visR }, (_, ri) =>
                Array.from({ length: visC }, (_, ci) => {
                  const r = ri + r0
                  const c = ci + c0
                  const v = puzzle.grid[r]?.[c]
                  const bg = cellBg(r, c)
                  const n = numAt(puzzle, r, c)
                  // Show correct answer when in answer-grid mode
                  const letter = showAnswerGrid
                    ? (puzzle.grid[r]?.[c] || '')
                    : (ug[r]?.[c] || '')
                  const isSel = sc && sc[0] === r && sc[1] === c

                  if (!v) return (
                    <div key={`${r}-${c}`}
                      style={{ width: cellSize, height: cellSize, background: COLORS.textPrimary, border: 'none' }}
                    />
                  )

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => {
                        if (!completed) {
                          tap(r, c)
                        }
                      }}
                      style={{
                      width: cellSize, height: cellSize, background: bg,
                      border: '1px solid #555', position: 'relative',
                      display: 'flex', flexDirection: 'column',
                      cursor: completed ? 'default' : 'pointer', transition: 'background 0.08s',
                      overflow: 'hidden',
                    }}>
                      {/* ── Top zone: clue number (30% of cell height) ── */}
                      <div style={{
                        height: Math.round(cellSize * 0.3),
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'flex-start',
                        paddingLeft: 2,
                        paddingTop: 1,
                      }}>
                        {n != null && n !== 0 && (
                          <span style={{
                            fontSize: Math.max(7, Math.round(cellSize * 0.24)),
                            fontWeight: 700,
                            lineHeight: 1,
                            fontFamily: FONTS.sans,
                            color: (showAnswerGrid || bg === '#22c55e' || bg === '#ef4444')
                              ? 'rgba(255,255,255,0.8)'
                              : '#444',
                          }}>
                            {n}
                          </span>
                        )}
                      </div>
                      {/* ── Bottom zone: answer letter (remaining 70%) ── */}
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <span style={{
                          fontSize: Math.round(cellSize * 0.48), fontWeight: 700,
                          fontFamily: FONTS.serif, color: cellTextColor(r, c),
                          lineHeight: 1, textTransform: 'uppercase',
                        }}>
                          {letter}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Mobile: Clue bar below grid with prev/next arrows */}
          {isMobile && clue && (
            <div style={{
              width: visC * cellSize, maxWidth: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: COLORS.accent,
              color: COLORS.white,
              padding: '14px 12px',
              borderRadius: 8,
              marginTop: 16,
              flexShrink: 0,
            }}>
              <button
                onClick={() => hasPrevClue && goToClue(sequentialClues[currentClueIndex - 1].cl, sequentialClues[currentClueIndex - 1].dir)}
                disabled={!hasPrevClue}
                style={{
                  width: 40, height: 40, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: hasPrevClue ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                  border: 'none', borderRadius: 8,
                  color: COLORS.white, cursor: hasPrevClue ? 'pointer' : 'not-allowed',
                  opacity: hasPrevClue ? 1 : 0.5,
                }}
                aria-label="Previous clue"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div style={{ flex: 1, minWidth: 0, fontSize: Math.round(15 * FONT_SCALE), fontFamily: FONTS.sans, fontWeight: 600, lineHeight: 1.35 }}>
                {clue.n} {dir === 'across' ? 'Across' : 'Down'}: {clue.clue}
              </div>
              <button
                onClick={() => hasNextClue && goToClue(sequentialClues[currentClueIndex + 1].cl, sequentialClues[currentClueIndex + 1].dir)}
                disabled={!hasNextClue}
                style={{
                  width: 40, height: 40, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: hasNextClue ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                  border: 'none', borderRadius: 8,
                  color: COLORS.white, cursor: hasNextClue ? 'pointer' : 'not-allowed',
                  opacity: hasNextClue ? 1 : 0.5,
                }}
                aria-label="Next clue"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}

          {/* Mobile: Custom keyboard (replaces system) */}
          {isMobile && !completed && (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 16, flexShrink: 0 }}>
              <MobileCustomKeyboard onKey={(ch) => type(ch)} disabled={!sc} />
            </div>
          )}

          {/* ── Action buttons / answer toggle ──────────────────────────────── */}
          <div style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'row',
            gap: 8,
            marginTop: isMobile && !completed ? 12 : 20,
            paddingBottom: isMobile ? 12 : 0,
            width: visC * cellSize,
            maxWidth: '100%',
          }}>
            {completed ? (
              /* Post-completion: hold to peek at answer grid, release to return to your grid */
              <button
                onMouseDown={() => setShowAnswerGrid(true)}
                onMouseUp={() => setShowAnswerGrid(false)}
                onMouseLeave={() => setShowAnswerGrid(false)}
                onTouchStart={e => { e.preventDefault(); setShowAnswerGrid(true) }}
                onTouchEnd={() => setShowAnswerGrid(false)}
                onTouchCancel={() => setShowAnswerGrid(false)}
                style={{
                  ...actionBtnUnderGrid,
                  flex: 1,
                  background: showAnswerGrid ? COLORS.accent : COLORS.white,
                  color: showAnswerGrid ? COLORS.white : COLORS.textPrimary,
                  border: showAnswerGrid ? `2px solid ${COLORS.accent}` : `2px solid ${COLORS.borderDark}`,
                  transition: 'background 0.08s, color 0.08s, border-color 0.08s',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
              >
                {showAnswerGrid ? '📋 Answer Key' : 'Hold to Compare Answer'}
              </button>
            ) : (
              /* During game: Reveal, Check, Complete — same width on mobile */
              <>
                <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
                  <button onClick={() => setShowRevMenu(v => !v)} style={{ ...actionBtnUnderGrid, flex: 1, minWidth: 0 }}>
                    Reveal ▾
                  </button>
                  {showRevMenu && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                      background: COLORS.white, border: `2px solid ${COLORS.borderDark}`,
                      borderRadius: 8, overflow: 'hidden', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}>
                      {[
                        { label: 'Letter', sub: `−${PENALTY.letter} pts`, fn: revLetter },
                        { label: 'Word',   sub: `−${PENALTY.word} pts`, fn: revWord },
                        { label: 'All',    sub: '−100 pts', fn: revAll, warn: true },
                      ].map(({ label, sub, fn, warn }) => (
                        <button key={label} onClick={fn} style={{
                          display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left',
                          background: 'none', border: 'none', fontFamily: FONTS.sans, fontSize: Math.round(16 * FONT_SCALE), fontWeight: 600,
                    color: warn ? COLORS.error : COLORS.textPrimary, cursor: 'pointer',
                  }}>
                    {label} <span style={{ color: COLORS.textFaint, fontSize: Math.round(14 * FONT_SCALE) }}>({sub})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {(() => {
                  // Check is only enabled when every cell of the current word has a letter
                  const wordReady = clue
                    ? Array.from({ length: clue.len }, (_, i) => {
                        const r2 = dir === 'across' ? clue.r : clue.r + i
                        const c2 = dir === 'across' ? clue.c + i : clue.c
                        return ug[r2]?.[c2] || ''
                      }).every(Boolean)
                    : false
                  return (
                    <button
                      onClick={checkWord}
                      style={{
                        ...actionBtnUnderGrid,
                        flex: 1, minWidth: 0,
                        opacity: wordReady ? 1 : 0.4,
                        cursor: wordReady ? 'pointer' : 'not-allowed',
                      }}
                      disabled={!wordReady}
                      title={!clue ? 'Select a word first' : !wordReady ? 'Fill in every cell of the word before checking' : 'Check this word'}
                    >
                      Check
                    </button>
                  )
                })()}
                {allFilled && !completed && (
                  <button onClick={markComplete} style={{ ...actionBtnUnderGrid, flex: '1 1 0', minWidth: 0, background: COLORS.accent, color: COLORS.white, border: 'none' }}>
                    Complete
                  </button>
                )}
                {!allFilled && !completed && fillPercent >= 0.3 && markCompleteEarly && (
                  <button onClick={markCompleteEarly} style={{ ...actionBtnUnderGrid, flex: '1 1 0', minWidth: 0, background: COLORS.accent, color: COLORS.white, border: 'none', fontSize: 13 }}>
                    Submit Early (−5 pts per empty)
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── Post-completion stats + share panel ────────────────────────────── */}
          {completed && (() => {
            const allClues = [...puzzle.clues.across, ...puzzle.clues.down]
            const wordsCorrect = allClues.filter(cl => {
              const d = puzzle.clues.across.includes(cl) ? 'across' : 'down'
              return isWordCorrect(puzzle, ug, cl, d)
            }).length
            const wordsWrong = allClues.length - wordsCorrect
            const finalScore = submittedScore ?? score

            return (
              <div style={{ marginTop: 14, width: visC * cellSize, maxWidth: '100%', animation: 'fadeUp 0.4s ease' }}>

                {/* Stats row */}
                <div style={{
                  display: 'flex', gap: 8, marginBottom: 10,
                }}>
                  {/* Correct */}
                  <div style={{
                    flex: 1, background: '#f0fdf4', borderRadius: 12,
                    border: '1.5px solid #bbf7d0', padding: '12px 8px', textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: FONTS.serif, fontSize: 30, color: '#16a34a', fontWeight: 700, lineHeight: 1 }}>
                      {wordsCorrect}
                    </div>
                    <div style={{ fontSize: 10, color: '#16a34a', fontFamily: FONTS.sans, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Correct
                    </div>
                  </div>

                  {/* Wrong */}
                  <div style={{
                    flex: 1,
                    background: wordsWrong > 0 ? '#fef2f2' : '#f0fdf4',
                    borderRadius: 12,
                    border: `1.5px solid ${wordsWrong > 0 ? '#fecaca' : '#bbf7d0'}`,
                    padding: '12px 8px', textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: FONTS.serif, fontSize: 30, color: wordsWrong > 0 ? '#dc2626' : '#16a34a', fontWeight: 700, lineHeight: 1 }}>
                      {wordsWrong}
                    </div>
                    <div style={{ fontSize: 10, color: wordsWrong > 0 ? '#dc2626' : '#16a34a', fontFamily: FONTS.sans, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Wrong
                    </div>
                  </div>

                  {/* Score */}
                  <div style={{
                    flex: 1, background: '#fffbeb', borderRadius: 12,
                    border: '1.5px solid #fde68a', padding: '12px 8px', textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: FONTS.serif, fontSize: 30, color: '#b45309', fontWeight: 700, lineHeight: 1 }}>
                      {finalScore}
                    </div>
                    <div style={{ fontSize: 10, color: '#b45309', fontFamily: FONTS.sans, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Score/100
                    </div>
                  </div>
                </div>

                {/* Share card section */}
                <div style={{
                  background: COLORS.white, borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  padding: '14px 16px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <div style={{
                    fontSize: 10, letterSpacing: 1.4, color: COLORS.textMuted,
                    fontFamily: FONTS.sans, textTransform: 'uppercase', marginBottom: 12, textAlign: 'center',
                  }}>
                    Share Your Result
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {shareIcons.map(({ icon, label, key, bg }) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => handleShare(key)}
                          style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: bg, border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                            transition: 'transform 0.1s, box-shadow 0.1s',
                            flexShrink: 0,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)' }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.18)' }}
                        >
                          {icon}
                        </button>
                        <span style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: FONTS.sans }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

        </div>

        {/* ── Mobile: Clues panel (swipe panel 1) ─────────────────────────────── */}
        {isMobile && (
          <div style={{
            width: '33.333%', minWidth: '33.333%', flexShrink: 0, minHeight: 0,
            display: 'flex', flexDirection: 'column',
            background: COLORS.white, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ fontSize: Math.round(10 * FONT_SCALE), fontWeight: 700, letterSpacing: 1, color: COLORS.textMuted, marginBottom: 6, marginTop: 2, fontFamily: FONTS.sans }}>ACROSS</div>
              {sortedAcross.map(cl => {
                const isActive = clue && clue.n === cl.n && dir === 'across'
                const filled = isClueFilled(ug, cl, 'across')
                return (
                  <div
                    key={`a-${cl.n}`}
                    onClick={() => goToClue && goToClue(cl, 'across')}
                    style={{
                      padding: '5px 8px', cursor: 'pointer',
                      background: isActive ? COLORS.clueHighlight : 'transparent',
                      borderRadius: 3, marginBottom: 2,
                      opacity: filled ? 0.55 : 1,
                      color: filled ? COLORS.textMuted : COLORS.textPrimary,
                    }}
                  >
                    <span style={{ fontWeight: 700, marginRight: 6, fontFamily: FONTS.serif, fontSize: Math.round(13 * FONT_SCALE) }}>{cl.n}.</span>
                    <span style={{ fontSize: Math.round(14 * FONT_SCALE), fontFamily: FONTS.sans }}>{cl.clue}</span>
                  </div>
                )
              })}
              <div style={{ fontSize: Math.round(10 * FONT_SCALE), fontWeight: 700, letterSpacing: 1, color: COLORS.textMuted, marginBottom: 6, marginTop: 14, fontFamily: FONTS.sans }}>DOWN</div>
              {sortedDown.length > 0 ? sortedDown.map(cl => {
                const isActive = clue && clue.n === cl.n && dir === 'down'
                const filled = isClueFilled(ug, cl, 'down')
                return (
                  <div
                    key={`d-${cl.n}`}
                    onClick={() => goToClue && goToClue(cl, 'down')}
                    style={{
                      padding: '5px 8px', cursor: 'pointer',
                      background: isActive ? COLORS.clueHighlight : 'transparent',
                      borderRadius: 3, marginBottom: 2,
                      opacity: filled ? 0.55 : 1,
                      color: filled ? COLORS.textMuted : COLORS.textPrimary,
                    }}
                  >
                    <span style={{ fontWeight: 700, marginRight: 6, fontFamily: FONTS.serif, fontSize: Math.round(13 * FONT_SCALE) }}>{cl.n}.</span>
                    <span style={{ fontSize: Math.round(14 * FONT_SCALE), fontFamily: FONTS.sans }}>{cl.clue}</span>
                  </div>
                )
              }) : (
                <div style={{ color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.sans, fontStyle: 'italic', paddingTop: 4 }}>No down clues.</div>
              )}
              {clue && sc && (() => {
                const pair = pairFor(puzzle, sc[0], sc[1])
                const hasBoth = pair.across && pair.down
                return hasBoth ? (
                  <div style={{ marginTop: 12 }}>
                    <button onClick={flipDir} style={{ background: 'none', border: 'none', color: COLORS.accent, fontSize: 12, cursor: 'pointer', fontFamily: FONTS.sans, textDecoration: 'underline' }}>
                      {dir === 'across' ? '↕ Switch to Down' : '↔ Switch to Across'}
                    </button>
                  </div>
                ) : null
              })()}
            </div>
          </div>
        )}

        {/* ── Mobile: Trivia panel (swipe panel 2) ─────────────────────────────── */}
        {isMobile && (
          <div style={{
            width: '33.333%', minWidth: '33.333%', flexShrink: 0, minHeight: 0,
            display: 'flex', flexDirection: 'column',
            background: COLORS.white, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px', WebkitOverflowScrolling: 'touch' }}>
              {completed ? (
                <div>
                  {allTriviaItems.length === 0 && (
                    <div style={{ color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.sans, fontStyle: 'italic', paddingTop: 8 }}>No trivia available for this puzzle.</div>
                  )}
                  {allTriviaItems.map(({ cl, dir: d }, idx) => {
                    const word = getWordStr(puzzle, cl, d)
                    const correct = isWordCorrect(puzzle, ug, cl, d)
                    return (
                      <div key={`${cl.n}-${d}`} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: idx < allTriviaItems.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: FONTS.serif, fontSize: 15, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: 0.5, textTransform: 'uppercase' }}>{word}</span>
                          <span style={{ fontSize: 10, fontFamily: FONTS.sans, background: '#f0f0f0', borderRadius: 4, padding: '2px 6px', color: COLORS.textMuted }}>{cl.n}{d === 'across' ? 'A' : 'D'}</span>
                          <span style={{ fontSize: 10, fontFamily: FONTS.sans, background: correct ? '#dcfce7' : '#fee2e2', color: correct ? '#16a34a' : '#dc2626', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>{correct ? '✓' : '✗'}</span>
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONTS.sans, marginBottom: 6, fontStyle: 'italic' }}>{cl.clue}</div>
                        <div style={{ fontSize: 13, color: '#444', fontFamily: FONTS.sans, lineHeight: 1.55 }}>{cl.trivia}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 16px', gap: 12 }}>
                  <div style={{ fontSize: 36 }}>🔒</div>
                  <div style={{ fontFamily: FONTS.serif, fontSize: 16, color: COLORS.textPrimary }}>Trivia Locked</div>
                  <div style={{ fontSize: 13, color: COLORS.textMuted, fontFamily: FONTS.sans, lineHeight: 1.5 }}>Complete the crossword and submit your score to unlock the story behind every word.</div>
                </div>
              )}
            </div>
          </div>
        )}
            </div>
          </div>
        ) : (
          /* Desktop: left column + right clue panel */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 40, minHeight: 0, overflow: 'hidden' }}>
            {/* Left column - puzzle area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
              {clue && (
                <div style={{ width: visC * cellSize, maxWidth: '100%', background: COLORS.accent, color: COLORS.white, padding: '12px 16px', borderRadius: '8px 8px 0 0', marginBottom: 0, flexShrink: 0 }}>
                  <span style={{ fontSize: Math.round(14 * FONT_SCALE), fontFamily: FONTS.sans, fontWeight: 600 }}>{clue.n} {dir === 'across' ? 'Across' : 'Down'}: {clue.clue}</span>
                </div>
              )}
              <div ref={containerRef} style={{ flexShrink: 0, minWidth: Math.min(700, visC * 42), minHeight: visR * cellSize, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                <div style={{ display: 'inline-grid', gridTemplateColumns: `repeat(${visC}, ${cellSize}px)`, gridTemplateRows: `repeat(${visR}, ${cellSize}px)`, border: `2px solid ${COLORS.textPrimary}`, background: COLORS.textPrimary, flexShrink: 0 }}>
                  {Array.from({ length: visR }, (_, ri) => Array.from({ length: visC }, (_, ci) => {
                    const r = ri + r0, c = ci + c0
                    const v = puzzle.grid[r]?.[c]
                    const bg = cellBg(r, c)
                    const n = numAt(puzzle, r, c)
                    const letter = showAnswerGrid ? (puzzle.grid[r]?.[c] || '') : (ug[r]?.[c] || '')
                    if (!v) return <div key={`${r}-${c}`} style={{ width: cellSize, height: cellSize, background: COLORS.textPrimary, border: 'none' }} />
                    return (
                      <div key={`${r}-${c}`} onClick={() => { if (!completed) tap(r, c) }} style={{ width: cellSize, height: cellSize, background: bg, border: '1px solid #555', position: 'relative', display: 'flex', flexDirection: 'column', cursor: completed ? 'default' : 'pointer', transition: 'background 0.08s', overflow: 'hidden' }}>
                        <div style={{ height: Math.round(cellSize * 0.3), flexShrink: 0, display: 'flex', alignItems: 'flex-start', paddingLeft: 2, paddingTop: 1 }}>
                          {n != null && n !== 0 && <span style={{ fontSize: Math.max(7, Math.round(cellSize * 0.24)), fontWeight: 700, lineHeight: 1, fontFamily: FONTS.sans, color: (showAnswerGrid || bg === '#22c55e' || bg === '#ef4444') ? 'rgba(255,255,255,0.8)' : '#444' }}>{n}</span>}
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: Math.round(cellSize * 0.48), fontWeight: 700, fontFamily: FONTS.serif, color: cellTextColor(r, c), lineHeight: 1, textTransform: 'uppercase' }}>{letter}</span>
                        </div>
                      </div>
                    )
                  }))}
                </div>
              </div>
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'row', gap: 8, marginTop: 20, paddingBottom: 0, width: visC * cellSize, maxWidth: '100%' }}>
                {completed ? (
                  <button onMouseDown={() => setShowAnswerGrid(true)} onMouseUp={() => setShowAnswerGrid(false)} onMouseLeave={() => setShowAnswerGrid(false)} onTouchStart={e => { e.preventDefault(); setShowAnswerGrid(true) }} onTouchEnd={() => setShowAnswerGrid(false)} onTouchCancel={() => setShowAnswerGrid(false)} style={{ ...actionBtnUnderGrid, flex: 1, background: showAnswerGrid ? COLORS.accent : COLORS.white, color: showAnswerGrid ? COLORS.white : COLORS.textPrimary, border: showAnswerGrid ? `2px solid ${COLORS.accent}` : `2px solid ${COLORS.borderDark}` }}>{showAnswerGrid ? '📋 Answer Key' : 'Hold to Compare Answer'}</button>
                ) : (
                  <>
                    <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
                      <button onClick={() => setShowRevMenu(v => !v)} style={{ ...actionBtnUnderGrid, flex: 1, minWidth: 0 }}>Reveal ▾</button>
                      {showRevMenu && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: COLORS.white, border: `2px solid ${COLORS.borderDark}`, borderRadius: 8, overflow: 'hidden', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {[{ label: 'Letter', sub: `−${PENALTY.letter} pts`, fn: revLetter }, { label: 'Word', sub: `−${PENALTY.word} pts`, fn: revWord }, { label: 'All', sub: '−100 pts', fn: revAll, warn: true }].map(({ label, sub, fn, warn }) => (
                            <button key={label} onClick={fn} style={{ display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none', fontFamily: FONTS.sans, fontSize: Math.round(16 * FONT_SCALE), fontWeight: 600, color: warn ? COLORS.error : COLORS.textPrimary, cursor: 'pointer' }}>{label} <span style={{ color: COLORS.textFaint, fontSize: Math.round(14 * FONT_SCALE) }}>({sub})</span></button>
                          ))}
                        </div>
                      )}
                    </div>
                    {(() => { const wordReady = clue ? Array.from({ length: clue.len }, (_, i) => { const r2 = dir === 'across' ? clue.r : clue.r + i; const c2 = dir === 'across' ? clue.c + i : clue.c; return ug[r2]?.[c2] || '' }).every(Boolean) : false; return <button onClick={checkWord} style={{ ...actionBtnUnderGrid, flex: 1, minWidth: 0, opacity: wordReady ? 1 : 0.4, cursor: wordReady ? 'pointer' : 'not-allowed' }} disabled={!wordReady}>Check</button> })()}
                    {allFilled && !completed && <button onClick={markComplete} style={{ ...actionBtnUnderGrid, flex: '1 1 0', minWidth: 0, background: COLORS.accent, color: COLORS.white, border: 'none' }}>Complete</button>}
                    {!allFilled && !completed && fillPercent >= 0.3 && markCompleteEarly && <button onClick={markCompleteEarly} style={{ ...actionBtnUnderGrid, flex: '1 1 0', minWidth: 0, background: COLORS.accent, color: COLORS.white, border: 'none', fontSize: 13 }}>Submit Early (−5 pts per empty)</button>}
                  </>
                )}
              </div>
              {completed && (() => {
                const allClues = [...puzzle.clues.across, ...puzzle.clues.down]
                const wordsCorrect = allClues.filter(cl => { const d = puzzle.clues.across.includes(cl) ? 'across' : 'down'; return isWordCorrect(puzzle, ug, cl, d) }).length
                const wordsWrong = allClues.length - wordsCorrect
                const finalScore = submittedScore ?? score
                return (
                  <div style={{ marginTop: 14, width: visC * cellSize, maxWidth: '100%' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 12, border: '1.5px solid #bbf7d0', padding: '12px 8px', textAlign: 'center' }}><div style={{ fontFamily: FONTS.serif, fontSize: 30, color: '#16a34a', fontWeight: 700 }}>{wordsCorrect}</div><div style={{ fontSize: 10, color: '#16a34a', fontFamily: FONTS.sans, fontWeight: 700, marginTop: 4 }}>Correct</div></div>
                      <div style={{ flex: 1, background: wordsWrong > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 12, border: `1.5px solid ${wordsWrong > 0 ? '#fecaca' : '#bbf7d0'}`, padding: '12px 8px', textAlign: 'center' }}><div style={{ fontFamily: FONTS.serif, fontSize: 30, color: wordsWrong > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{wordsWrong}</div><div style={{ fontSize: 10, color: wordsWrong > 0 ? '#dc2626' : '#16a34a', fontFamily: FONTS.sans, fontWeight: 700, marginTop: 4 }}>Wrong</div></div>
                      <div style={{ flex: 1, background: '#fffbeb', borderRadius: 12, border: '1.5px solid #fde68a', padding: '12px 8px', textAlign: 'center' }}><div style={{ fontFamily: FONTS.serif, fontSize: 30, color: '#b45309', fontWeight: 700 }}>{finalScore}</div><div style={{ fontSize: 10, color: '#b45309', fontFamily: FONTS.sans, fontWeight: 700, marginTop: 4 }}>Score/100</div></div>
                    </div>
                    <div style={{ background: COLORS.white, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, letterSpacing: 1.4, color: COLORS.textMuted, fontFamily: FONTS.sans, marginBottom: 12, textAlign: 'center' }}>Share Your Result</div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>{shareIcons.map(({ icon, label, key, bg }) => <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><button onClick={() => handleShare(key)} style={{ width: 44, height: 44, borderRadius: '50%', background: bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</button><span style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: FONTS.sans }}>{label}</span></div>)}</div>
                    </div>
                  </div>
                )
              })()}
            </div>
            {/* Right column */}
            <div style={{ flex: '0 0 400px', minWidth: 350, maxWidth: 460, minHeight: 0, display: 'flex', flexDirection: 'column', background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flexShrink: 0 }}>
              <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>{(['clues', 'trivia']).map(tab => <button key={tab} onClick={() => setClueTab(tab)} style={{ flex: 1, padding: '10px 4px', border: 'none', background: clueTab === tab ? COLORS.accent : COLORS.white, color: clueTab === tab ? COLORS.white : COLORS.textMuted, fontWeight: 700, fontSize: Math.round(10 * FONT_SCALE), letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', fontFamily: FONTS.sans, borderBottom: clueTab === tab ? `2px solid ${COLORS.accent}` : '2px solid transparent' }}>{tab}</button>)}</div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px' }}>
                {clueTab === 'clues' && <div><div style={{ fontSize: Math.round(10 * FONT_SCALE), fontWeight: 700, letterSpacing: 1, color: COLORS.textMuted, marginBottom: 6, marginTop: 2, fontFamily: FONTS.sans }}>ACROSS</div>{sortedAcross.map(cl => { const isActive = clue && clue.n === cl.n && dir === 'across'; const filled = isClueFilled(ug, cl, 'across'); return <div key={`a-${cl.n}`} onClick={() => goToClue && goToClue(cl, 'across')} style={{ padding: '5px 8px', cursor: 'pointer', background: isActive ? COLORS.clueHighlight : 'transparent', borderRadius: 3, marginBottom: 2, opacity: filled ? 0.55 : 1, color: filled ? COLORS.textMuted : COLORS.textPrimary }}><span style={{ fontWeight: 700, marginRight: 6, fontFamily: FONTS.serif, fontSize: Math.round(13 * FONT_SCALE) }}>{cl.n}.</span><span style={{ fontSize: Math.round(14 * FONT_SCALE), fontFamily: FONTS.sans }}>{cl.clue}</span></div>})}<div style={{ fontSize: Math.round(10 * FONT_SCALE), fontWeight: 700, letterSpacing: 1, color: COLORS.textMuted, marginBottom: 6, marginTop: 14, fontFamily: FONTS.sans }}>DOWN</div>{sortedDown.length > 0 ? sortedDown.map(cl => { const isActive = clue && clue.n === cl.n && dir === 'down'; const filled = isClueFilled(ug, cl, 'down'); return <div key={`d-${cl.n}`} onClick={() => goToClue && goToClue(cl, 'down')} style={{ padding: '5px 8px', cursor: 'pointer', background: isActive ? COLORS.clueHighlight : 'transparent', borderRadius: 3, marginBottom: 2, opacity: filled ? 0.55 : 1, color: filled ? COLORS.textMuted : COLORS.textPrimary }}><span style={{ fontWeight: 700, marginRight: 6, fontFamily: FONTS.serif, fontSize: Math.round(13 * FONT_SCALE) }}>{cl.n}.</span><span style={{ fontSize: Math.round(14 * FONT_SCALE), fontFamily: FONTS.sans }}>{cl.clue}</span></div>}) : <div style={{ color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.sans, fontStyle: 'italic', paddingTop: 4 }}>No down clues.</div>}</div>}
                {clueTab === 'trivia' && (completed ? <div>{allTriviaItems.length === 0 && <div style={{ color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.sans, fontStyle: 'italic', paddingTop: 8 }}>No trivia available.</div>}{allTriviaItems.map(({ cl, dir: d }, idx) => { const word = getWordStr(puzzle, cl, d); const correct = isWordCorrect(puzzle, ug, cl, d); return <div key={`${cl.n}-${d}`} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: idx < allTriviaItems.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}><span style={{ fontFamily: FONTS.serif, fontSize: 15, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: 0.5, textTransform: 'uppercase' }}>{word}</span><span style={{ fontSize: 10, fontFamily: FONTS.sans, background: '#f0f0f0', borderRadius: 4, padding: '2px 6px', color: COLORS.textMuted }}>{cl.n}{d === 'across' ? 'A' : 'D'}</span><span style={{ fontSize: 10, fontFamily: FONTS.sans, background: correct ? '#dcfce7' : '#fee2e2', color: correct ? '#16a34a' : '#dc2626', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>{correct ? '✓' : '✗'}</span></div><div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONTS.sans, marginBottom: 6, fontStyle: 'italic' }}>{cl.clue}</div><div style={{ fontSize: 13, color: '#444', fontFamily: FONTS.sans, lineHeight: 1.55 }}>{cl.trivia}</div></div>})}</div> : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 16px', gap: 12 }}><div style={{ fontSize: 36 }}>🔒</div><div style={{ fontFamily: FONTS.serif, fontSize: 16, color: COLORS.textPrimary }}>Trivia Locked</div><div style={{ fontSize: 13, color: COLORS.textMuted, fontFamily: FONTS.sans, lineHeight: 1.5 }}>Complete the crossword to unlock.</div></div>)}
                {clueTab !== 'trivia' && clue && sc && (() => { const pair = pairFor(puzzle, sc[0], sc[1]); return pair.across && pair.down ? <div style={{ marginTop: 12 }}><button onClick={flipDir} style={{ background: 'none', border: 'none', color: COLORS.accent, fontSize: 12, cursor: 'pointer', fontFamily: FONTS.sans, textDecoration: 'underline' }}>{dir === 'across' ? '↕ Switch to Down' : '↔ Switch to Across'}</button></div> : null })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: custom keyboard replaces system — no hidden input */}

      {/* ── Completion overlay ──────────────────────────────────────────────── */}
      {showComplete && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 200,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowComplete(false) }}
        >
          <div style={{
            background: COLORS.white, borderRadius: '18px 18px 0 0',
            padding: '28px 24px 32px', width: '100%', maxWidth: 480,
            animation: 'slideUp 0.3s ease', textAlign: 'center', position: 'relative',
            maxHeight: '92vh', overflowY: 'auto',
          }}>
            <button
              onClick={() => setShowComplete(false)}
              style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textFaint }}
            >
              ✕
            </button>

            {completedCorrect ? (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 26, color: COLORS.textPrimary, marginBottom: 8 }}>
                  Perfect Grid!
                </div>
                <div style={{ color: '#666', fontSize: 15, marginBottom: 6, fontFamily: FONTS.sans }}>
                  Your score — <strong style={{ color: COLORS.accent, fontSize: 22 }}>{submittedScore}</strong>
                </div>
                <div style={{ color: '#999', fontSize: 13, marginBottom: 24, fontFamily: FONTS.sans }}>
                  Perfect solve{pen > 0 ? ` · ${pen} pts in check/reveal penalties` : ''}
                </div>
                <button onClick={goBoard} style={{ ...S.primaryBtn, marginBottom: 10 }}>
                  See Leaderboard
                </button>
                <button onClick={() => { setShowComplete(false); setClueTab('trivia') }} style={{ ...secondaryBtn, marginBottom: 10 }}>
                  View Today&apos;s Trivia
                </button>
                <button onClick={goBack} style={secondaryBtn}>
                  Back to Home
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 24, color: COLORS.textPrimary, marginBottom: 8 }}>
                  Score Submitted
                </div>
                <div style={{ color: '#666', fontSize: 15, marginBottom: 6, fontFamily: FONTS.sans }}>
                  Your score — <strong style={{ color: COLORS.accent, fontSize: 22 }}>{submittedScore}</strong>
                </div>
                <div style={{
                  background: COLORS.errorBg, border: `1px solid #f5c6c4`,
                  borderRadius: 10, padding: '12px 16px', marginBottom: 20, textAlign: 'left',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.error, marginBottom: 4, fontFamily: FONTS.sans }}>
                    {errors} wrong cell{errors !== 1 ? 's' : ''} found at submission
                  </div>
                  <div style={{ color: '#666', fontSize: 12, fontFamily: FONTS.sans, lineHeight: 1.5 }}>
                    Use the Answer Key toggle below the grid to see exactly where you went wrong.
                  </div>
                </div>
                {/* "See Correct Crossword" — closes popup, activates answer grid toggle */}
                <button
                  onClick={() => setShowComplete(false)}
                  style={{ ...S.primaryBtn, marginBottom: 10 }}
                >
                  See Correct Crossword
                </button>
                <button onClick={() => { setShowComplete(false); setClueTab('trivia') }} style={{ ...secondaryBtn, marginBottom: 10 }}>
                  View Today&apos;s Trivia
                </button>
                <button onClick={goBoard} style={secondaryBtn}>
                  Accept &amp; See Leaderboard
                </button>
              </>
            )}

            {/* ── Inline share icons ─────────────────────────────────────── */}
            <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 20, paddingTop: 18 }}>
              <div style={{
                fontSize: 10, letterSpacing: 1.2, color: COLORS.textMuted,
                fontFamily: FONTS.sans, textTransform: 'uppercase', marginBottom: 14,
              }}>
                Share Your Result
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                {shareIcons.map(({ icon, label, key, bg }) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <button
                      onClick={() => handleShare(key)}
                      style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: bg, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        transition: 'transform 0.1s, box-shadow 0.1s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.22)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)' }}
                    >
                      {icon}
                    </button>
                    <span style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: FONTS.sans }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Share toast feedback ─────────────────────────────────────────────── */}
      {shareToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '10px 20px',
          borderRadius: 10, fontSize: 14, fontFamily: FONTS.sans, zIndex: 400,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', animation: 'fadeUp 0.25s ease',
        }}>
          {shareToast}
        </div>
      )}

      {/* ── Score explanation modal ──────────────────────────────────────────── */}
      {showScore && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 300, padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowScore(false) }}
        >
          <div style={{
            background: COLORS.white, borderRadius: 16, padding: '32px 28px',
            width: '100%', maxWidth: 420, animation: 'popIn 0.25s ease', position: 'relative',
          }}>
            <button
              onClick={() => setShowScore(false)}
              style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textFaint }}
            >
              ✕
            </button>
            <div style={{ fontFamily: FONTS.serif, fontSize: 24, color: COLORS.textPrimary, marginBottom: 10 }}>
              How Scoring Works
            </div>
            <div style={{ color: '#666', fontSize: 15, marginBottom: 18, fontFamily: FONTS.sans, lineHeight: 1.5 }}>
              You start at 100 pts.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { icon: '⭐', title: 'Start: 100 pts',           desc: 'Everyone starts fresh each day.' },
                { icon: '❌', title: 'Wrong at submit: −3 pts per cell', desc: 'Cells you never checked that end up wrong.' },
                { icon: '💡', title: 'Reveal penalties',         desc: `Letter: −${PENALTY.letter} pts · Word: −${PENALTY.word} pts · Full grid: −100 pts.` },
                { icon: '✓',  title: 'Check Word: −10 pts if wrong, free if correct', desc: 'No penalty for checking a correct word. Only charged −10 pts when the word has errors.' },
                { icon: '📤', title: 'Submit Early: −5 pts per empty cell', desc: 'After 30% filled, you can submit early. Empty cells cost 5 pts each. Score cannot go below 0.' },
                { icon: '✔',  title: 'Mark Complete',            desc: 'Score locks when you tap Complete.' },
                { icon: '🏆', title: 'Same puzzle, everyone',    desc: 'All players get the same grid per category.' },
                { icon: '⏱️', title: 'No time pressure',         desc: 'Scoring is not based on how quickly you finish.' },
              ].map(({ icon, title, desc }) => (
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
    </div>
  )
}

const actionBtnUnderGrid = {
  padding: '14px 28px',
  background: COLORS.white,
  border: `2px solid ${COLORS.borderDark}`,
  borderRadius: 8,
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
  color: COLORS.textPrimary,
  fontFamily: FONTS.sans,
}

const secondaryBtn = {
  display: 'block',
  margin: '0 auto',
  padding: '12px 36px',
  background: '#f5f5f5',
  border: '1.5px solid #ddd',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  color: '#666',
  fontFamily: "'Source Sans 3', sans-serif",
}
