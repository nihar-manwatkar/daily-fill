/**
 * Custom in-app keyboard for mobile — replaces system keyboard.
 * DailyFill style: dark keys, green accent.
 */
import { useRef } from 'react'
import { COLORS, FONTS } from '../utils/styles.js'

const ROW1 = 'QWERTYUIOP'.split('')
const ROW2 = 'ASDFGHJKL'.split('')
const ROW3 = 'ZXCVBNM'.split('')

const keyStyle = (isSpecial = false) => ({
  flex: isSpecial ? '0 0 auto' : 1,
  minWidth: isSpecial ? 44 : 24,
  maxWidth: isSpecial ? 52 : 36,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: isSpecial ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.15)',
  border: 'none',
  borderRadius: 6,
  color: COLORS.white,
  fontSize: 18,
  fontWeight: 600,
  fontFamily: FONTS.sans,
  cursor: 'pointer',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
  transition: 'background 0.1s',
})

const DEBOUNCE_MS = 120

export default function MobileCustomKeyboard({ onKey, disabled }) {
  const lastTapRef = useRef({ key: null, ts: 0 })

  const handleKey = (ch) => {
    if (disabled) return
    const now = Date.now()
    const { key: lastKey, ts: lastTs } = lastTapRef.current
    if (lastKey === ch && now - lastTs < DEBOUNCE_MS) return
    lastTapRef.current = { key: ch, ts: now }
    onKey(ch)
  }

  const keyProps = (ch) => ({
    type: 'button',
    onPointerDown: (e) => {
      e.preventDefault()
      e.stopPropagation()
      handleKey(ch)
    },
    onTouchEnd: (e) => {
      e.preventDefault()
    },
    style: ch === '⌫' ? { ...keyStyle(true), minWidth: 52 } : keyStyle(),
  })

  return (
    <div style={{
      width: '100%',
      maxWidth: 400,
      boxSizing: 'border-box',
      background: 'rgba(26,26,26,0.95)',
      padding: '12px 8px 16px',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', width: '100%' }}>
        {ROW1.map(k => (
          <button key={k} {...keyProps(k)}>
            {k}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', width: '100%' }}>
        {ROW2.map(k => (
          <button key={k} {...keyProps(k)}>
            {k}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        {ROW3.map(k => (
          <button key={k} {...keyProps(k)}>
            {k}
          </button>
        ))}
        <button {...keyProps('⌫')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
            <path d="M18 9l-6 6M12 9l6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
