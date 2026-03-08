import { S, COLORS, FONTS } from '../utils/styles.js'
import { useIsMobile } from '../utils/useIsMobile.js'

export default function LeaderboardScreen({ board, cd, user, score, goBack, onLogout }) {
  const isMobile = useIsMobile()

  return (
    <div style={{ ...S.screen, background: COLORS.bg }}>

      {/* ── Header (safe-area for iPhone notch when PWA) ── */}
      <div style={{ background: COLORS.headerBg }}>
        <div style={{ ...S.contentWrapWide, paddingTop: S.SAFE_TOP, paddingBottom: 14, paddingLeft: 24, paddingRight: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={goBack} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 20, cursor: 'pointer', fontFamily: FONTS.sans, lineHeight: 1 }}>←</button>
            <div style={{ fontFamily: FONTS.serif, fontSize: 20, color: COLORS.white }}>
              {isMobile ? 'Leaderboard' : 'Daily'}
              {!isMobile && <span style={{ color: COLORS.accentLight }}>Fill</span>}
              {!isMobile && <span style={{ color: '#555', fontSize: 14, marginLeft: 12, fontFamily: FONTS.sans, fontWeight: 400 }}>Leaderboard</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user?.username && (
              <span style={{ color: '#888', fontSize: 13, fontFamily: FONTS.sans }}>{user.username}</span>
            )}
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: COLORS.accentLight, fontWeight: 700, fontSize: 13, fontFamily: FONTS.sans }}>{cd}</div>
              <div style={{ color: '#666', fontSize: 10, fontFamily: FONTS.sans }}>to reset</div>
            </div>
            {onLogout && (
              <button onClick={onLogout} style={{
                background: 'transparent', border: '1px solid #555', borderRadius: 6,
                padding: '5px 10px', color: '#999', fontSize: 11,
                cursor: 'pointer', fontFamily: FONTS.sans,
              }}>
                Log out
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Board body ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ ...S.contentWrapWide, padding: isMobile ? '20px 20px 48px' : '28px 24px 64px' }}>

          <div style={{ color: COLORS.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, fontFamily: FONTS.sans }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })} — Daily ranking
          </div>
          <div style={{ color: COLORS.textMid, fontSize: 13, marginBottom: 24, fontFamily: FONTS.sans }}>
            📰 Classic · Ranked by accuracy — fewest errors wins · Resets midnight IST
          </div>

          {board.length === 0 && (
            <div style={{ textAlign: 'center', padding: '64px 0', color: COLORS.textFaint, fontFamily: FONTS.sans, fontSize: 14 }}>
              No scores yet for today.<br />Be the first to complete it!
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, maxWidth: 560, margin: '0 auto' }}>
            {board.map((e, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', padding: '14px 16px',
                background: COLORS.white, borderRadius: 10,
                border: i === 0 ? `2px solid ${COLORS.accent}` : `2px solid ${COLORS.border}`,
                boxShadow: i === 0 ? `2px 2px 0 ${COLORS.accent}` : `2px 2px 0 ${COLORS.border}`,
                animation: `fadeUp ${0.3 + i * 0.07}s ease forwards`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: i === 0 ? COLORS.gold : i === 1 ? '#bbb' : i === 2 ? '#cd7f32' : '#eee',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: FONTS.serif, fontSize: 15, fontWeight: 700,
                  color: i < 3 ? COLORS.textPrimary : COLORS.textMuted,
                }}>
                  {e.rank}
                </div>
                <div style={{ flex: 1, marginLeft: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.textPrimary, fontFamily: FONTS.sans }}>
                    {e.name}
                    {e.name === user?.username && (
                      <span style={{ color: COLORS.accent, fontSize: 11, marginLeft: 8, fontWeight: 400 }}>you</span>
                    )}
                  </div>
                  <div style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 1, fontFamily: FONTS.sans }}>
                    {e.errors} error{e.errors !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: COLORS.accent, fontFamily: FONTS.serif, fontSize: 24, lineHeight: 1 }}>{e.score}</div>
                  <div style={{ color: COLORS.textFaint, fontSize: 10, fontFamily: FONTS.sans }}>pts</div>
                </div>
              </div>
            ))}
          </div>

          {user && !board.find(e => e.name === user.username) && (
            <div style={{
              marginTop: 16, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', transform: 'translateX(-35px)',
              display: 'flex', alignItems: 'center', padding: '14px 16px',
              background: COLORS.white, borderRadius: 10,
              border: `2px dashed ${COLORS.border}`,
              boxShadow: `2px 2px 0 ${COLORS.border}`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: FONTS.serif, fontSize: 15, fontWeight: 700, color: COLORS.textMuted,
              }}>?</div>
              <div style={{ flex: 1, marginLeft: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.textPrimary, fontFamily: FONTS.sans }}>
                  {user.username}
                  <span style={{ color: COLORS.accent, fontSize: 11, marginLeft: 8, fontWeight: 400 }}>you</span>
                </div>
                <div style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 1, fontFamily: FONTS.sans }}>
                  complete the puzzle to rank
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: COLORS.accent, fontFamily: FONTS.serif, fontSize: 24, lineHeight: 1 }}>{score}</div>
                <div style={{ color: COLORS.textFaint, fontSize: 10, fontFamily: FONTS.sans }}>pts</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
