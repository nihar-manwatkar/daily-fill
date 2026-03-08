// ─── GLOBAL STYLE TOKENS ─────────────────────────────────────────────────────

export const COLORS = {
  bg:           '#f5f3ee',
  paper:        '#faf8f3',
  headerBg:     '#1a1a1a',
  accent:       '#2C4A3E',
  accentLight:  '#5C8A76',
  white:        '#ffffff',
  border:       '#d4cfc7',
  borderDark:   '#8a8278',
  textPrimary:  '#111111',
  textMid:      '#444444',
  textMuted:    '#888888',
  textFaint:    '#bbbbbb',
  gold:         '#f5d000',
  error:        '#c0392b',
  errorBg:      '#fde8e6',
  success:      '#d4ede1',
  successText:  '#1a6640',
  revealBg:     '#fff8c5',
  clueHighlight:'#d4e8df',
}

export const FONTS = {
  serif: "'Libre Baskerville', serif",
  sans:  "'Source Sans 3', sans-serif",
}

/** Scale factor for font sizes (1.3 = 30% larger) */
export const FONT_SCALE = 1.3

export const S = {
  // Full-page background wrapper
  pageRoot: {
    background: COLORS.bg,
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: FONTS.sans,
  },
  // Full-width dark header bar (used across all screens)
  header: {
    background: COLORS.headerBg,
    width: '100%',
    flexShrink: 0,
  },
  // Centred content wrapper inside a header
  headerInner: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Centred page content — standard width
  contentWrap: {
    maxWidth: 640,
    margin: '0 auto',
    width: '100%',
    padding: '0 20px',
  },
  // Centred page content — wide (game, leaderboard)
  contentWrapWide: {
    maxWidth: 1100,
    margin: '0 auto',
    width: '100%',
    padding: '0 24px',
  },
  screen: {
    flex: 1,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
  },
  primaryBtn: {
    display: 'block',
    margin: '0 auto',
    padding: '13px 40px',
    background: COLORS.accent,
    color: COLORS.white,
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: FONTS.sans,
  },
}
