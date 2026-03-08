import { useState } from 'react'
import { S, COLORS, FONTS } from '../utils/styles.js'
import { useIsMobile } from '../utils/useIsMobile.js'

/** isExistingUser: true = login (password only), false = signup (password + confirm) */
export default function PasswordScreen({
  email,
  isExistingUser,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  onContinue,
  onForgotPassword,
  onBack,
  error,
  setError,
}) {
  const isMobile = useIsMobile()
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const validSignup = password.length >= 6 && password === confirmPassword
  const validLogin = password.length >= 6
  const valid = isExistingUser ? validLogin : validSignup

  const handleSubmit = async () => {
    if (isExistingUser) setError?.(null)
    if (!valid) return
    setSubmitting(true)
    try {
      await onContinue()
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
          {isExistingUser ? `Enter your password for ${email}` : `Create a password for ${email}`}
        </p>
        <p style={{ color: COLORS.textFaint, fontSize: 12, marginBottom: 28, fontFamily: FONTS.sans }}>
          {isExistingUser ? 'Welcome back!' : 'Min 6 characters'}
        </p>

        <Label>Password</Label>
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
            placeholder={isExistingUser ? 'Enter your password' : 'Enter password'}
            value={password}
            onChange={e => { setPassword(e.target.value); setError?.(null) }}
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

        {!isExistingUser && (
          <>
            <Label style={{ marginTop: 20 }}>Confirm Password</Label>
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
                placeholder="Confirm password"
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
          </>
        )}

        {error && (
          <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8, fontFamily: FONTS.sans }}>{error}</p>
        )}
        {!isExistingUser && password && password.length < 6 && (
          <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8, fontFamily: FONTS.sans }}>Minimum 6 characters</p>
        )}
        {!isExistingUser && password && confirmPassword && password !== confirmPassword && (
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
          {submitting ? 'Signing in…' : isExistingUser ? 'Sign in →' : 'Continue →'}
        </button>

        {isExistingUser && onForgotPassword && (
          <button
            onClick={onForgotPassword}
            style={{
              background: 'none', border: 'none', color: COLORS.textMuted,
              fontSize: 13, marginTop: 16, cursor: 'pointer', fontFamily: FONTS.sans,
            }}
          >
            Forgot password?
          </button>
        )}

        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', color: COLORS.textMuted,
              fontSize: 13, marginTop: 8, cursor: 'pointer', fontFamily: FONTS.sans,
            }}
          >
            ← Use a different email
          </button>
        )}

        <p style={{ color: COLORS.textFaint, fontSize: 11, marginTop: 24, fontFamily: FONTS.sans }}>
          By continuing you agree to our terms of service
        </p>
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
