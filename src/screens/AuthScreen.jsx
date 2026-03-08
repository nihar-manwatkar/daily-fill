import { useState } from 'react'
import { S, COLORS, FONTS } from '../utils/styles.js'
import { useIsMobile } from '../utils/useIsMobile.js'

export default function AuthScreen({ email, setEmail, onContinue, error, setError }) {
  const isMobile = useIsMobile()
  const [sending, setSending] = useState(false)

  const handleContinue = async () => {
    const e = email.trim().toLowerCase()
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return
    setSending(true)
    setError?.(null)
    try {
      await onContinue()
    } catch (err) {
      const msg = String(err?.message || 'Failed').toLowerCase()
      setError?.(msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')
        ? "Could not reach server. Run 'npm run dev:full' to start the app."
        : (err?.message || 'Something went wrong'))
    } finally {
      setSending(false)
    }
  }

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

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
        <p style={{ color: COLORS.textMid, fontSize: 15, marginBottom: 48, fontFamily: FONTS.sans }}>
          Sign in to play &amp; compete daily
        </p>

        <Label>Email address</Label>
        <input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError?.(null) }}
          onKeyDown={e => e.key === 'Enter' && valid && !sending && handleContinue()}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `1.5px solid ${error ? '#dc2626' : COLORS.borderDark}`,
            borderRadius: 8, padding: '14px 16px', fontSize: 18,
            fontFamily: FONTS.sans, outline: 'none',
          }}
        />

        {error && (
          <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8, fontFamily: FONTS.sans }}>{error}</p>
        )}

        <button
          onClick={handleContinue}
          disabled={!valid || sending}
          style={{
            ...S.primaryBtn,
            marginTop: 20,
            width: '100%',
            opacity: valid && !sending ? 1 : 0.6,
            cursor: valid && !sending ? 'pointer' : 'not-allowed',
          }}
        >
          {sending ? 'Checking…' : 'Continue →'}
        </button>

        <p style={{ color: COLORS.textFaint, fontSize: 11, marginTop: 24, fontFamily: FONTS.sans }}>
          By continuing you agree to our terms of service
        </p>
      </div>
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{ color: COLORS.textMid, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10, fontFamily: FONTS.sans }}>
      {children}
    </div>
  )
}
