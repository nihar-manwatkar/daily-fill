/**
 * Custom in-app keyboard for mobile — replaces system keyboard.
 * DailyFill style: dark keys, green accent.
 */
import { COLORS, FONTS } from '../utils/styles.js'

const ROW1 = 'QWERTYUIOP'.split('')
const ROW2 = 'ASDFGHJKL'.split('')
const ROW3 = 'ZXCVBNM'.split('')

const keyStyle = (isSpecial = false) => ({
  flex: isSpecial ? '0 0 auto' : 1,
  minWidth: isSpecial ? 44 : 28,
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
  transition: 'background 0.1s',
})

export default function MobileCustomKeyboard({ onKey, disabled }) {
  const handleKey = (ch) => {
    if (disabled) return
    onKey(ch)
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: 400,
      background: 'rgba(26,26,26,0.95)',
      padding: '12px 8px 16px',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
        {ROW1.map(k => (
          <button key={k} onClick={() => handleKey(k)} style={keyStyle()} onTouchEnd={e => e.preventDefault()}>
            {k}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', paddingLeft: 18 }}>
        {ROW2.map(k => (
          <button key={k} onClick={() => handleKey(k)} style={keyStyle()} onTouchEnd={e => e.preventDefault()}>
            {k}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={() => handleKey('⌫')} style={{ ...keyStyle(true), minWidth: 52 }} onTouchEnd={e => e.preventDefault()}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
            <path d="M18 9l-6 6M12 9l6 6" />
          </svg>
        </button>
        {ROW3.map(k => (
          <button key={k} onClick={() => handleKey(k)} style={keyStyle()} onTouchEnd={e => e.preventDefault()}>
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}
