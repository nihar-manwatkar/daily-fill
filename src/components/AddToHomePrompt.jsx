/**
 * Add to Home Screen prompt — shown once to first-time mobile visitors.
 * Uses DF favicon (white on dark green).
 */
import { useRef, useEffect } from 'react'
import { COLORS, FONTS } from '../utils/styles.js'

export default function AddToHomePrompt({ onDismiss, onAdd }) {
  const deferredPromptRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      deferredPromptRef.current = e
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleAdd = async () => {
    if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt()
      await deferredPromptRef.current.userChoice
    }
    onAdd()
  }

  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 500,
        animation: 'fadeUp 0.25s ease',
      }}
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
    >
      <div
        style={{
          background: COLORS.white,
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 28px',
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
          animation: 'slideUp 0.3s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* DF favicon */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: '#14532d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontFamily: FONTS.serif, fontSize: 28, fontWeight: 700, color: COLORS.white, letterSpacing: 0.5 }}>
              DF
            </span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FONTS.serif, fontSize: 20, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 6 }}>
              Add to Home Screen
            </div>
            <div style={{ fontSize: 14, color: COLORS.textMid, fontFamily: FONTS.sans, lineHeight: 1.5 }}>
              Play DailyFill anytime — add this to your home screen for quick access.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            <button
              onClick={handleAdd}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: COLORS.accent,
                color: COLORS.white,
                border: 'none',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 700,
                fontFamily: FONTS.sans,
                cursor: 'pointer',
              }}
            >
              {isIos ? 'Add to Home Screen' : 'Add to Home Screen'}
            </button>
            <button
              onClick={onDismiss}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: 'none',
                color: COLORS.textMuted,
                border: 'none',
                fontSize: 14,
                fontFamily: FONTS.sans,
                cursor: 'pointer',
              }}
            >
              Maybe Later
            </button>
          </div>
          {isIos && (
            <div style={{ fontSize: 11, color: COLORS.textFaint, fontFamily: FONTS.sans, textAlign: 'center', lineHeight: 1.4 }}>
              Safari: Tap Share (bottom) → &quot;Add to Home Screen&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
