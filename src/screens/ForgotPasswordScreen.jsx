import { useState } from 'react'
import { S, COLORS, FONTS } from '../utils/styles.js'
import { useIsMobile } from '../utils/useIsMobile.js'

export default function ForgotPasswordScreen({
  email,
  useEmailOnly = false,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  onSubmit,
  onBack,
  error,
  setError,
}) {
  const isMobile = useIsMobile()
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const valid = useEmailOnly ? true : (newPassword.length >= 6 && newPassword === confirmPassword)

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
          Reset password for {email}
        </p>
        <p style={{ color: COLORS.textFaint, fontSize: 12, marginBottom: 28, fontFamily: FONTS.sans }}>
          {useEmailOnly ? 'We\'ll send you a link to reset your password.' : 'Enter a new password (min 6 characters)'}
        </p>

        {!useEmailOnly && <Label>New Password</Label>}
        {!useEmailOnly && (
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
        )}

        {!useEmailOnly && <Label style={{ marginTop: 20 }}>Confirm Password</Label>}
        {!useEmailOnly && (
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
        )}

        {error && (
          <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8, fontFamily: FONTS.sans }}>{error}</p>
        )}
        {!useEmailOnly && newPassword && newPassword.length < 6 && (
          <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8, fontFamily: FONTS.sans }}>Minimum 6 characters</p>
        )}
        {!useEmailOnly && newPassword && confirmPassword && newPassword !== confirmPassword && (
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
          {submitting ? (useEmailOnly ? 'Sending…' : 'Resetting…') : (useEmailOnly ? 'Send Reset Link' : 'Reset Password')}
        </button>

        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: COLORS.textMuted,
            fontSize: 13, marginTop: 20, cursor: 'pointer', fontFamily: FONTS.sans,
          }}
        >
          ← Back to sign in
        </button>
      </div>
    </div>
  )
}

function Label({ children, style = {} }) {
  return (
    <div style={{ color: COLORS.textMid, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10, fontFamily: FONTS.sans, ...style }}>
      {children}
    </div>
  )
}
