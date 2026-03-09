import { useState, useEffect } from 'react'
import { S, COLORS, FONTS } from '../utils/styles.js'
import { useIsMobile } from '../utils/useIsMobile.js'
import { hasSeenAtiPrompt, markSeenAtiPrompt } from '../utils/helpers.js'
import AddToHomePrompt from '../components/AddToHomePrompt.jsx'

const TOP_N = 8

export default function HomeScreen({ user, cd, hasPlayed, hasProgress, startGame, viewResultAndTrivia, goBoard, board = [], score = 0, onLogout, onShowScoringRules }) {
  // Before completing: show scores but blurred. After completing: show scores clearly.
  const showScores = hasPlayed
  const isMobile = useIsMobile()
  const [showMenu, setShowMenu] = useState(false)
  const [showAtiPrompt, setShowAtiPrompt] = useState(false)

  useEffect(() => {
    if (isMobile && !hasSeenAtiPrompt()) {
      const t = setTimeout(() => setShowAtiPrompt(true), 600)
      return () => clearTimeout(t)
    }
  }, [isMobile])

  const dismissAtiPrompt = () => {
    markSeenAtiPrompt()
    setShowAtiPrompt(false)
  }

  return (
    <div style={{ ...S.screen, background: COLORS.bg }}>

      {/* ── Header (safe-area for iPhone notch when PWA) ── */}
      <div style={{ background: COLORS.headerBg }}>
        <div style={{ ...S.contentWrapWide, paddingTop: S.SAFE_TOP, paddingBottom: 12, paddingLeft: 16, paddingRight: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontFamily: FONTS.serif, fontSize: 22, fontWeight: 700, color: COLORS.white, letterSpacing: 0.5 }}>
            DF
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <button onClick={goBoard} style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6,
              padding: '6px 12px', color: COLORS.white, fontSize: 12,
              cursor: 'pointer', fontWeight: 600, fontFamily: FONTS.sans,
            }}>
              Daily Rankings
            </button>
            <div style={{ color: COLORS.accentLight, fontWeight: 700, fontSize: 13, fontFamily: FONTS.sans }}>{cd}</div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMenu(v => !v)}
                style={{
                  width: 36, height: 36, borderRadius: 6,
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)',
                  color: COLORS.white, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                aria-label="Menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              {showMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: COLORS.white, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  overflow: 'hidden', minWidth: 160, zIndex: 100,
                }}>
                  <button onClick={() => { onShowScoringRules?.(); setShowMenu(false) }} style={{ display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left', border: 'none', background: 'none', fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textPrimary, cursor: 'pointer' }}>
                    Rules of scoring
                  </button>
                  {onLogout && (
                    <button onClick={() => { onLogout(); setShowMenu(false) }} style={{ display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left', border: 'none', background: 'none', fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textPrimary, cursor: 'pointer', borderTop: `1px solid ${COLORS.border}` }}>
                      Log out
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {showMenu && <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} aria-hidden="true" />}
      </div>

      {/* Add to Home Screen prompt — mobile, first-time only */}
      {showAtiPrompt && (
        <AddToHomePrompt
          onDismiss={dismissAtiPrompt}
          onAdd={dismissAtiPrompt}
        />
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ ...S.contentWrapWide, padding: isMobile ? '28px 20px 56px' : '48px 24px 64px', maxWidth: 520, margin: '0 auto' }}>

          <div style={{ marginBottom: 28, animation: 'fadeUp 0.35s ease' }}>
            <div style={{ color: COLORS.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, fontFamily: FONTS.sans }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ fontFamily: FONTS.serif, fontSize: isMobile ? 26 : 32, color: COLORS.textPrimary, lineHeight: 1.25 }}>
              Welcome back,<br />{user?.username}
            </div>
          </div>

          {/* Today card */}
          <div style={{ background: COLORS.accent, borderRadius: 14, padding: '22px', marginBottom: 20, animation: 'fadeUp 0.4s ease' }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, fontFamily: FONTS.sans }}>
              Today's Puzzle
            </div>
            <div style={{ color: COLORS.white, fontFamily: FONTS.serif, fontSize: 20, lineHeight: 1.45, marginBottom: 12 }}>
              Same Grid. For Every Player. Every Day.
            </div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontFamily: FONTS.sans }}>
              Resets at midnight IST · {cd} remaining
            </div>
          </div>

          {/* Today's leaderboard — pre-game: scores blurred; post-game: scores visible */}
          <div style={{ marginBottom: 24, animation: 'fadeUp 0.5s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, letterSpacing: 1.5, color: COLORS.textMuted, textTransform: 'uppercase', fontFamily: FONTS.sans, fontWeight: 700 }}>
                Today's Players
              </div>
              <button
                onClick={goBoard}
                style={{
                  background: 'none', border: 'none', color: COLORS.accent, fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.sans, padding: 4,
                }}
              >
                See all →
              </button>
            </div>

            {/* Post-game context banner — only show when user has played AND we have a real score (not stale from previous session) */}
            {hasPlayed && score != null && (() => {
              const userEntry = board.find(e => e.name === user?.username)
              const topScore  = board[0]?.score
              return (
                <div style={{
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                  borderRadius: 12, padding: '16px 18px', marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONTS.sans, marginBottom: 3 }}>
                      Your Result
                    </div>
                    <div style={{ color: COLORS.white, fontFamily: FONTS.serif, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                      {score} pts
                      {userEntry && (
                        <span style={{ color: COLORS.accentLight, fontSize: 13, fontWeight: 400, marginLeft: 8, fontFamily: FONTS.sans }}>
                          Rank #{userEntry.rank}
                        </span>
                      )}
                    </div>
                  </div>
                  {topScore != null && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONTS.sans, marginBottom: 3 }}>
                        Top Score Today
                      </div>
                      <div style={{ color: COLORS.gold, fontFamily: FONTS.serif, fontSize: 20, fontWeight: 700 }}>
                        {topScore} pts
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            <div style={{ background: COLORS.white, borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              {board.slice(0, TOP_N).length === 0 ? (
                <div style={{ padding: '20px 16px', color: COLORS.textFaint, fontSize: 13, fontFamily: FONTS.sans, textAlign: 'center' }}>
                  No scores yet. Be the first!
                </div>
              ) : (
                board.slice(0, TOP_N).map((e, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '10px 14px',
                      borderBottom: i < Math.min(board.length, TOP_N) - 1 ? `1px solid ${COLORS.border}` : 'none',
                      background: e.name === user?.username ? 'rgba(99,102,241,0.04)' : 'transparent',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: i === 0 ? COLORS.gold : i === 1 ? '#bbb' : i === 2 ? '#cd7f32' : '#eee',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: FONTS.serif, fontSize: 12, fontWeight: 700,
                      color: i < 3 ? COLORS.textPrimary : COLORS.textMuted,
                    }}>
                      {e.rank}
                    </div>
                    <div style={{ flex: 1, marginLeft: 12 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: COLORS.textPrimary, fontFamily: FONTS.sans }}>
                        {e.name}
                        {e.name === user?.username && (
                          <span style={{ color: COLORS.accent, fontSize: 10, marginLeft: 6, fontWeight: 400 }}>you</span>
                        )}
                      </span>
                    </div>
                    {e.score != null && (
                      <div style={{
                        color: COLORS.accent,
                        fontFamily: FONTS.serif,
                        fontSize: 14,
                        fontWeight: 700,
                        ...(!showScores ? { filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' } : {}),
                      }}>
                        {e.score} pts
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {!hasPlayed && board.length > 0 && (
              <p style={{ color: COLORS.textMid, fontSize: 13, fontFamily: FONTS.sans, textAlign: 'center', marginTop: 8 }}>
                Complete today&apos;s puzzle to reveal scores and see where you rank.
              </p>
            )}
          </div>

          {hasPlayed ? (
            <>
              <button style={S.primaryBtn} onClick={viewResultAndTrivia}>
                View Result &amp; Trivia →
              </button>
              <div style={{
                background: '#f0f0f0', border: `1.5px solid ${COLORS.border}`,
                borderRadius: 8, padding: '18px 20px', textAlign: 'center', marginTop: 10, marginBottom: 10,
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>🔒</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.textMid, fontFamily: FONTS.sans }}>
                  Already played today
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: FONTS.sans, marginTop: 4 }}>
                  Next puzzle unlocks in {cd}
                </div>
              </div>
            </>
          ) : hasProgress ? (
            <>
              <button style={S.primaryBtn} onClick={() => startGame({ skipRules: true })}>
                Resume Puzzle →
              </button>
              <p style={{ color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.sans, textAlign: 'center', marginTop: 12 }}>
                You have a puzzle in progress — jump back in where you left off.
              </p>
            </>
          ) : (
            <>
              <button style={S.primaryBtn} onClick={startGame}>
                Play Today's Puzzle →
              </button>
              <p style={{ color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.sans, textAlign: 'center', marginTop: 12 }}>
                Beat the leaderboard. Same puzzle. One chance.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

