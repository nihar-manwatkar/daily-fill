import { useState } from 'react'
import { S, COLORS, FONTS } from '../utils/styles.js'
import { useIsMobile } from '../utils/useIsMobile.js'

/** Shown when user lands via Supabase password reset link (hash has type=recovery) */
export default function RecoveryPasswordScreen({
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  onSubmit,
  error,
  setError,
}) {
  const isMobile = useIsMobile()
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const valid = newPassword.length >= 6 && newPassword === confirmPassword

  const handleSubmit = async () => {
    if (!valid) return
    setSubmitting(true)
    setError?.(null)
    try {
      await onSubmit()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      ...S.screen,
      background: isMobile ? COLORS.white : COLORS.bg,
      justifyContent: 'center',
      alignItems: 'center',
      padding: isMobile ? '0 28px' : '40px 20px',
    }}>
      <div style={{
        background: COLORS.white,
        borderRadius: isMobile ? 0 : 16,
        boxShadow: isMobile ? 'none' : '0 4px 32px rgba(0,0,0,0.08)',
        padding: isMobile ? '0' : '48px 52px',
        width: '100%',
        maxWidth: 440,
        animation: 'fadeUp 0.5s ease',
      }}>
        <div style={{ fontFamily: FONTS.serif, fontSize: 42, color: COLORS.textPrimary, marginBottom: 6 }}>
          Daily<span style={{ color: COLORS.accent }}>Fill</span>
        </div>
        <p style={{ color: COLORS.textMid, fontSize: 15, marginBottom: 8, fontFamily: FONTS.sans }}>
          Set your new password
        </p>
        <p style={{ color: COLORS.textFaint, fontSize: 12, marginBottom: 28, fontFamily: FONTS.sans }}>
          Enter a new password (min 6 characters)
        </p>

        <div style={{ color: COLORS.textMid, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10, fontFamily: FONTS.sans }}>
          New Password
        </div>
        <div style={{
          display: 'flex', border: `1.5px solid ${error ? '#dc2626' : COLORS.borderDark}`,
          borderRadius: 8, overflow: 'hidden', background: COLORS.white,
        }}>
          <input
            style={{
              flex: 1, border: 'none', color: COLORS.textPrimary, fontSize: 16,
              padding: '12px 14px', outline: 'none', background: 'transparent',
              fontFamily: FONTS.sans,
            }}
            type={showPass ? 'text' : 'password'}
            placeholder="Enter new password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setError?.(null) }}
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            style={{
              padding: '0 12px', background: 'none', border: 'none',
              color: COLORS.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: FONTS.sans,
            }}
          >
            {showPass ? 'Hide' : 'Show'}
          </button>
        </div>

        <div style={{ color: COLORS.textMid, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10, marginTop: 20, fontFamily: FONTS.sans }}>
          Confirm Password
        </div>
        <div style={{
          display: 'flex', border: `1.5px solid ${COLORS.borderDark}`,
          borderRadius: 8, overflow: 'hidden', background: COLORS.white,
        }}>
          <input
            style={{
              flex: 1, border: 'none', color: COLORS.textPrimary, fontSize: 16,
              padding: '12px 14px', outline: 'none', background: 'transparent',
              fontFamily: FONTS.sans,
            }}
            type={showConfirm ? 'text' : 'password'}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(v => !v)}
            style={{
              padding: '0 12px', background: 'none', border: 'none',
              color: COLORS.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: FONTS.sans,
            }}
          >
            {showConfirm ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && (
          <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8, fontFamily: FONTS.sans }}>{error}</p>
        )}
        {newPassword && newPassword.length < 6 && (
          <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8, fontFamily: FONTS.sans }}>Minimum 6 characters</p>
        )}
        {newPassword && confirmPassword && newPassword !== confirmPassword && (
          <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8, fontFamily: FONTS.sans }}>Passwords do not match</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!valid || submitting}
          style={{
            ...S.primaryBtn,
            marginTop: 24,
            width: '100%',
            opacity: valid && !submitting ? 1 : 0.6,
            cursor: valid && !submitting ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'Updating…' : 'Set New Password'}
        </button>
      </div>
    </div>
  )
}
