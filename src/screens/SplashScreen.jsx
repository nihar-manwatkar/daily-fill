import { S, COLORS, FONTS } from '../utils/styles.js'

export default function SplashScreen() {
  return (
    <div style={{ ...S.screen, justifyContent: 'center', alignItems: 'center', gap: 10, background: COLORS.white }}>
      <div style={{ fontFamily: FONTS.serif, fontSize: 54, color: COLORS.textPrimary, letterSpacing: -2, lineHeight: 1 }}>
        Daily<span style={{ color: COLORS.accent }}>Fill</span>
      </div>
      <div style={{ color: COLORS.textMuted, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', fontFamily: FONTS.sans }}>
        One puzzle · Every day
      </div>
      <div style={{
        marginTop: 28,
        width: 22, height: 22,
        border: `2px solid ${COLORS.border}`,
        borderTopColor: COLORS.accent,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  )
}
