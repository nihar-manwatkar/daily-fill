import { useState, useMemo, useRef, useCallback } from 'react'
import { COLORS, FONTS } from '../utils/styles.js'
import { getAdminPuzzleEdits, setAdminPuzzleEdits } from '../data/puzzleCalendar.js'

// ─── GRID MATH ────────────────────────────────────────────────────────────────

function generateRandomBlocks(rows, cols) {
  const black = new Set()

  const runsInRow = (row, tb) => {
    const runs = []; let cur = 0
    for (let c = 0; c <= cols; c++) {
      if (c < cols && !tb.has(`${row},${c}`)) { cur++ }
      else { if (cur > 0) runs.push(cur); cur = 0 }
    }
    return runs
  }

  const runsInCol = (col, tb) => {
    const runs = []; let cur = 0
    for (let r = 0; r <= rows; r++) {
      if (r < rows && !tb.has(`${r},${col}`)) { cur++ }
      else { if (cur > 0) runs.push(cur); cur = 0 }
    }
    return runs
  }

  const hasViolation = (tb, checkRows, checkCols) => {
    for (const r of checkRows) if (runsInRow(r, tb).some(l => l < 3)) return true
    for (const c of checkCols) if (runsInCol(c, tb).some(l => l < 3)) return true
    return false
  }

  // Target 25–30% black cells; using rotational symmetry every placement = 2 cells
  const targetBlack = Math.round(rows * cols * 0.28)
  let attempts = 0

  while (black.size < targetBlack && attempts < 25000) {
    attempts++
    const r  = Math.floor(Math.random() * rows)
    const c  = Math.floor(Math.random() * cols)
    const mr = rows - 1 - r
    const mc = cols - 1 - c
    const k1 = `${r},${c}`
    const k2 = `${mr},${mc}`

    if (black.has(k1)) continue

    const proposed = new Set(black)
    proposed.add(k1)
    if (k1 !== k2) proposed.add(k2)

    if (!hasViolation(proposed, new Set([r, mr]), new Set([c, mc]))) {
      proposed.forEach(k => black.add(k))
    }
  }

  return black
}

const isBlocked = (r, c, rows, cols, black) =>
  r < 0 || r >= rows || c < 0 || c >= cols || black.has(`${r},${c}`)

function computeNumbers(rows, cols, black) {
  const nums = {}; let n = 1
  const b = (r, c) => isBlocked(r, c, rows, cols, black)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (b(r, c)) continue
      const sa = b(r, c - 1) && !b(r, c + 1)
      const sd = b(r - 1, c) && !b(r + 1, c)
      if (sa || sd) nums[`${r},${c}`] = n++
    }
  }
  return nums
}

function computeClues(rows, cols, black, nums) {
  const b = (r, c) => isBlocked(r, c, rows, cols, black)
  const across = [], down = []
  const sorted = Object.entries(nums).sort((a, b) => a[1] - b[1])
  for (const [key, n] of sorted) {
    const [r, c] = key.split(',').map(Number)
    if (b(r, c - 1) && !b(r, c + 1)) {
      let len = 0; for (let cc = c; !b(r, cc); cc++) len++
      across.push({ n, r, c, len })
    }
    if (b(r - 1, c) && !b(r + 1, c)) {
      let len = 0; for (let rr = r; !b(rr, c); rr++) len++
      down.push({ n, r, c, len })
    }
  }
  return { across, down }
}

// ─── PUZZLE CREATOR TAB ───────────────────────────────────────────────────────

export default function PuzzleCreatorTab() {
  const [rows,       setRows]       = useState(13)
  const [cols,       setCols]       = useState(13)
  const [black,      setBlack]      = useState(new Set())
  const [cellValues, setCellValues] = useState({})
  const [clueText,   setClueText]   = useState({})
  const [blockMode,  setBlockMode]  = useState(false)
  const [generated,  setGenerated]  = useState(false)
  const [flash,      setFlash]      = useState(false)
  const [publishDate,    setPublishDate]    = useState('')
  const [publishSuccess, setPublishSuccess] = useState(null)
  const [publishError,   setPublishError]   = useState('')
  const [publishSignal,  setPublishSignal]  = useState(0)

  // Cell refs for keyboard auto-advance
  const cellRefs = useRef({})

  const nums         = useMemo(() => computeNumbers(rows, cols, black), [rows, cols, black])
  const { across, down } = useMemo(() => computeClues(rows, cols, black, nums), [rows, cols, black, nums])

  // Cell size: fit largest dimension inside 620px grid area
  const CELL = Math.min(50, Math.floor(620 / Math.max(rows, cols)))

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleGenerate = () => {
    setBlack(generateRandomBlocks(rows, cols))
    setCellValues({})
    setClueText({})
    setGenerated(true)
    setBlockMode(false)
    // Flash animation
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
  }

  const handleSizeChange = (dim, val) => {
    const n = parseInt(val)
    if (dim === 'rows') setRows(n); else setCols(n)
    setBlack(new Set()); setCellValues({}); setClueText({}); setGenerated(false)
  }

  const handleClearBlocks = () => {
    setBlack(new Set()); setCellValues({}); setClueText({}); setGenerated(false)
  }

  const handleCellClick = (r, c) => {
    if (!blockMode) return
    const k = `${r},${c}`
    setBlack(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else { next.add(k); setCellValues(p => { const n = { ...p }; delete n[k]; return n }) }
      return next
    })
  }

  const handleCellInput = useCallback((r, c, val) => {
    const letter = val.replace(/[^a-zA-Z]/g, '').slice(-1).toUpperCase()
    setCellValues(prev => ({ ...prev, [`${r},${c}`]: letter }))
    // Auto-advance: move right, then down
    if (letter) {
      const next = findNextCell(r, c, rows, cols, black)
      if (next) {
        const ref = cellRefs.current[`${next[0]},${next[1]}`]
        if (ref) { ref.focus(); ref.select() }
      }
    }
  }, [rows, cols, black])

  const handleKeyDown = useCallback((e, r, c) => {
    if (e.key === 'Backspace' && !cellValues[`${r},${c}`]) {
      const prev = findPrevCell(r, c, rows, cols, black)
      if (prev) {
        setCellValues(p => { const n = { ...p }; delete n[`${prev[0]},${prev[1]}`]; return n })
        const ref = cellRefs.current[`${prev[0]},${prev[1]}`]
        if (ref) { ref.focus(); ref.select() }
      }
    }
  }, [rows, cols, black, cellValues])

  const handleClueChange = useCallback((key, value) => {
    setClueText(prev => ({ ...prev, [key]: value }))
  }, [])

  // Answer string preview for a clue entry
  const getAnswerPreview = (entry, direction) => {
    return Array.from({ length: entry.len }, (_, i) => {
      const r = direction === 'across' ? entry.r : entry.r + i
      const c = direction === 'across' ? entry.c + i : entry.c
      return cellValues[`${r},${c}`] || '_'
    }).join(' ')
  }

  const blackPct = Math.round(black.size / (rows * cols) * 100)

  // ── Publish helpers ────────────────────────────────────────────────────────

  const totalWhiteCells = rows * cols - black.size
  const filledCells     = Object.keys(cellValues).filter(k => !black.has(k) && cellValues[k]).length
  const totalClues      = across.length + down.length
  const writtenClues    = totalClues > 0
    ? [...across.map(e => `A${e.n}`), ...down.map(e => `D${e.n}`)].filter(k => clueText[k]?.trim()).length
    : 0

  const isGridReady   = black.size > 0 && totalWhiteCells > 0
  const isFillReady   = totalWhiteCells > 0 && filledCells === totalWhiteCells
  const isCluesReady  = totalClues > 0 && writtenClues === totalClues
  const canPublish    = isGridReady

  // Build tomorrow's IST date string and valid min date for the date picker
  function getIstTomorrow() {
    const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    ist.setUTCDate(ist.getUTCDate() + 1)
    return ist.toISOString().slice(0, 10)
  }

  const tomorrow = getIstTomorrow()

  // Collect which future dates already have a creator-published puzzle
  const publishedDates = useMemo(() => {
    const result = []
    const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    for (let i = 1; i <= 60; i++) {
      const d = new Date(ist)
      d.setUTCDate(d.getUTCDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const edits = getAdminPuzzleEdits(dateStr)
      if (edits?.fullReplacement) result.push(dateStr)
    }
    return result
  }, [publishSignal])

  const handlePublish = () => {
    if (!publishDate || !canPublish) return
    setPublishError('')

    // Build the full puzzle grid from creator state
    const grid = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        if (black.has(`${r},${c}`)) return null
        return cellValues[`${r},${c}`] || null
      })
    )

    const clues = {
      across: across.map(e => ({ n: e.n, r: e.r, c: e.c, len: e.len, clue: clueText[`A${e.n}`] || '' })),
      down:   down.map(e   => ({ n: e.n, r: e.r, c: e.c, len: e.len, clue: clueText[`D${e.n}`] || '' })),
    }

    setAdminPuzzleEdits(publishDate, { fullReplacement: true, grid, clues })
    setPublishSuccess(publishDate)
    setPublishSignal(s => s + 1)   // re-trigger publishedDates memo
    setPublishDate('')
    setTimeout(() => setPublishSuccess(null), 6000)
  }

  const handleUnpublish = (dateStr) => {
    setAdminPuzzleEdits(dateStr, null)
    setPublishSignal(s => s + 1)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={pc.wrap}>

      {/* ── Controls bar ── */}
      <div style={pc.controlBar}>
        <div style={pc.controlGroup}>
          <span style={pc.controlLabel}>Grid size</span>
          <div style={pc.sizeRow}>
            <select value={rows} onChange={e => handleSizeChange('rows', e.target.value)} style={pc.select}>
              {[12,13,14,15,16].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={pc.times}>×</span>
            <select value={cols} onChange={e => handleSizeChange('cols', e.target.value)} style={pc.select}>
              {[12,13,14,15,16].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={pc.dimHint}>{rows * cols} cells</span>
          </div>
        </div>

        <div style={pc.controlDivider} />

        <button onClick={handleGenerate} style={pc.generateBtn}>
          <span style={{ fontSize: 16, marginRight: 7 }}>⚡</span>
          Random Block Generator
        </button>

        <button
          onClick={() => setBlockMode(m => !m)}
          style={{ ...pc.outlineBtn, ...(blockMode ? pc.outlineBtnActive : {}) }}
          title="Click cells in the grid to toggle them black/white"
        >
          <span style={{ fontSize: 14, marginRight: 6 }}>✏️</span>
          {blockMode ? 'Manual Mode ON' : 'Manual Blocks'}
        </button>

        {(black.size > 0) && (
          <button onClick={handleClearBlocks} style={pc.ghostBtn}>
            Clear Blocks
          </button>
        )}

        {generated && (
          <div style={pc.statPill}>
            <span style={{ color: COLORS.textMuted, fontSize: 12 }}>
              Black cells: <strong>{black.size}</strong> ({blackPct}%)
            </span>
          </div>
        )}
      </div>

      {blockMode && (
        <div style={pc.blockModeBanner}>
          <span style={{ fontSize: 15, marginRight: 8 }}>✏️</span>
          <strong>Manual Block Mode:</strong>&nbsp;Click any cell in the grid to toggle it black or white. Click "Manual Blocks" again to exit.
        </div>
      )}

      {/* ── Main area: Grid + Clue Panel ── */}
      <div style={pc.mainArea}>

        {/* ── Grid ── */}
        <div style={pc.gridSection}>
          {!generated && black.size === 0 && (
            <div style={pc.hint}>
              Choose a grid size above, then hit <strong>Random Block Generator</strong> to place black squares — or switch on <strong>Manual Blocks</strong> to click cells yourself.
            </div>
          )}

          <div
            style={{
              ...pc.gridWrap,
              opacity: flash ? 0.4 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <div
              style={{
                display: 'inline-grid',
                gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
                gridTemplateRows: `repeat(${rows}, ${CELL}px)`,
                border: `2px solid #111`,
                gap: 0,
              }}
            >
              {Array.from({ length: rows }, (_, r) =>
                Array.from({ length: cols }, (_, c) => {
                  const k = `${r},${c}`
                  const isBlack = black.has(k)
                  const num = nums[k]
                  const val = cellValues[k] || ''

                  return (
                    <div
                      key={k}
                      onClick={() => handleCellClick(r, c)}
                      style={{
                        ...pc.cell,
                        width: CELL,
                        height: CELL,
                        background: isBlack ? '#111' : '#fff',
                        cursor: blockMode ? 'crosshair' : 'default',
                        position: 'relative',
                        border: '1px solid #bbb',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                      }}
                    >
                      {!isBlack && num && (
                        <span style={{
                          position: 'absolute',
                          top: 1,
                          left: 2,
                          fontSize: Math.max(8, CELL * 0.22),
                          lineHeight: 1,
                          color: '#555',
                          fontFamily: FONTS.sans,
                          fontWeight: 600,
                          pointerEvents: 'none',
                          zIndex: 2,
                        }}>
                          {num}
                        </span>
                      )}
                      {!isBlack && !blockMode && (
                        <input
                          ref={el => { cellRefs.current[k] = el }}
                          maxLength={1}
                          value={val}
                          onChange={e => handleCellInput(r, c, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, r, c)}
                          onFocus={e => e.target.select()}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            textAlign: 'center',
                            fontSize: Math.max(14, CELL * 0.44),
                            fontFamily: FONTS.serif,
                            fontWeight: 700,
                            color: '#111',
                            cursor: 'text',
                            paddingTop: num ? Math.max(6, CELL * 0.18) : 0,
                            boxSizing: 'border-box',
                            caretColor: COLORS.accent,
                          }}
                        />
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {(across.length > 0 || down.length > 0) && (
            <div style={pc.gridFooter}>
              <span style={pc.footerStat}>{across.length} Across</span>
              <span style={pc.footerDot}>·</span>
              <span style={pc.footerStat}>{down.length} Down</span>
              <span style={pc.footerDot}>·</span>
              <span style={pc.footerStat}>{across.length + down.length} total clues</span>
            </div>
          )}
        </div>

        {/* ── Clue Panel ── */}
        <div style={pc.cluePanel}>
          {(across.length === 0 && down.length === 0) ? (
            <div style={pc.cluePanelEmpty}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Clues will appear here</div>
              <div style={{ color: COLORS.textMuted, fontSize: 13 }}>
                Generate or draw your block pattern first, then clue numbers are auto-detected and you can type each clue below.
              </div>
            </div>
          ) : (
            <div style={pc.cluePanelInner}>
              <ClueSection
                title="Across"
                entries={across}
                direction="across"
                clueText={clueText}
                cellValues={cellValues}
                onClueChange={handleClueChange}
                getAnswerPreview={getAnswerPreview}
              />
              <ClueSection
                title="Down"
                entries={down}
                direction="down"
                clueText={clueText}
                cellValues={cellValues}
                onClueChange={handleClueChange}
                getAnswerPreview={getAnswerPreview}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Publish Section ── */}
      {isGridReady && (
        <div style={pc.publishWrap}>
          <div style={pc.publishHeader}>
            <div style={pc.publishTitle}>
              <span style={{ fontSize: 18, marginRight: 8 }}>🚀</span>
              Publish This Puzzle
            </div>
            <div style={pc.publishSubtitle}>
              Replace any future day's algorithm-generated puzzle with this one. Today's puzzle cannot be changed.
            </div>
          </div>

          <div style={pc.publishBody}>

            {/* ── Readiness checklist ── */}
            <div style={pc.readinessRow}>
              <ReadinessPill
                ok={isGridReady}
                label={`Grid ${rows}×${cols} · ${blackPct}% black`}
              />
              <ReadinessPill
                ok={isFillReady}
                warn={filledCells > 0 && !isFillReady}
                label={isFillReady
                  ? `All ${totalWhiteCells} cells filled`
                  : `${filledCells}/${totalWhiteCells} cells filled`}
              />
              <ReadinessPill
                ok={isCluesReady}
                warn={writtenClues > 0 && !isCluesReady}
                label={isCluesReady
                  ? `All ${totalClues} clues written`
                  : `${writtenClues}/${totalClues} clues written`}
              />
            </div>

            {(!isFillReady || !isCluesReady) && (
              <div style={pc.publishWarning}>
                <span style={{ marginRight: 6 }}>⚠️</span>
                {!isFillReady && !isCluesReady
                  ? 'Puzzle has unfilled cells and missing clues — it can still be published but players will see blanks.'
                  : !isFillReady
                  ? 'Some answer cells are empty — players will not be able to complete those words correctly.'
                  : 'Some clues are missing — those entries will appear blank in the game.'}
              </div>
            )}

            {/* ── Date picker + button ── */}
            <div style={pc.publishRow}>
              <div style={pc.publishPickerGroup}>
                <label style={pc.publishPickerLabel}>Select a future date</label>
                <input
                  type="date"
                  value={publishDate}
                  min={tomorrow}
                  onChange={e => { setPublishDate(e.target.value); setPublishError('') }}
                  style={pc.datePicker}
                />
              </div>
              <button
                onClick={handlePublish}
                disabled={!publishDate}
                style={{
                  ...pc.publishBtn,
                  opacity: publishDate ? 1 : 0.45,
                  cursor: publishDate ? 'pointer' : 'not-allowed',
                }}
              >
                <span style={{ marginRight: 7 }}>📤</span>
                {publishedDates.includes(publishDate) ? 'Overwrite & Publish' : 'Publish to Date'}
              </button>
            </div>

            {publishedDates.includes(publishDate) && publishDate && (
              <div style={{ ...pc.publishWarning, background: '#fef4e8', borderColor: '#f5c08a', color: '#7a4400', marginTop: 0 }}>
                <span style={{ marginRight: 6 }}>🔄</span>
                A custom puzzle is already scheduled for <strong>{publishDate}</strong>. Publishing will overwrite it.
              </div>
            )}

            {publishError && (
              <div style={{ ...pc.publishWarning, background: '#fde8e6', borderColor: '#f5a0a0', color: COLORS.error }}>
                {publishError}
              </div>
            )}

            {publishSuccess && (
              <div style={pc.publishSuccess}>
                <span style={{ fontSize: 20, marginRight: 10 }}>✅</span>
                <div>
                  <strong>Published!</strong> Your puzzle is now scheduled for{' '}
                  <strong>{new Date(publishSuccess + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                  It will replace the algorithm's puzzle for that day.
                </div>
              </div>
            )}
          </div>

          {/* ── Already-published dates ── */}
          {publishedDates.length > 0 && (
            <div style={pc.scheduledWrap}>
              <div style={pc.scheduledTitle}>Scheduled Custom Puzzles ({publishedDates.length})</div>
              <div style={pc.scheduledList}>
                {publishedDates.map(d => (
                  <div key={d} style={pc.scheduledRow}>
                    <span style={pc.scheduledDate}>
                      {new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span style={pc.scheduledBadge}>Custom puzzle</span>
                    <button
                      onClick={() => handleUnpublish(d)}
                      style={pc.unpublishBtn}
                      title="Remove custom puzzle — revert to algorithm"
                    >
                      Revert to algorithm
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── CLUE SECTION ─────────────────────────────────────────────────────────────

function ClueSection({ title, entries, direction, clueText, onClueChange, getAnswerPreview }) {
  const dir = direction === 'across' ? 'A' : 'D'
  return (
    <div style={pc.clueBlock}>
      <div style={pc.clueSectionTitle}>{title}</div>
      {entries.map(entry => {
        const key = `${dir}${entry.n}`
        const preview = getAnswerPreview(entry, direction)
        const filled = preview.replace(/ /g, '').replace(/_/g, '').length
        return (
          <div key={key} style={pc.clueRow}>
            <div style={pc.clueRowTop}>
              <span style={pc.clueNum}>{entry.n}</span>
              <span style={pc.clueLen}>{entry.len} letters</span>
              <span style={pc.cluePreview}>{preview}</span>
              {filled > 0 && (
                <span style={{ ...pc.filledBadge, opacity: filled === entry.len ? 1 : 0.5 }}>
                  {filled}/{entry.len}
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder={`Write clue for ${entry.n}-${title}…`}
              value={clueText[key] || ''}
              onChange={e => onClueChange(key, e.target.value)}
              style={pc.clueInput}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── READINESS PILL ───────────────────────────────────────────────────────────

function ReadinessPill({ ok, warn, label }) {
  const bg    = ok ? '#d4ede1' : warn ? '#fff8c5' : '#f4f2ed'
  const color = ok ? COLORS.successText : warn ? '#7a6200' : COLORS.textMuted
  const icon  = ok ? '✅' : warn ? '⚠️' : '○'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 12px', borderRadius: 20,
      background: bg, color,
      fontSize: 12, fontWeight: 600, fontFamily: FONTS.sans,
      border: `1px solid ${ok ? '#a8d8c0' : warn ? '#e8d000' : '#e5e2da'}`,
    }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      {label}
    </span>
  )
}

// ─── NAVIGATION HELPERS ───────────────────────────────────────────────────────

function findNextCell(r, c, rows, cols, black) {
  // Move right first, then next row from col 0
  for (let cc = c + 1; cc < cols; cc++) {
    if (!black.has(`${r},${cc}`)) return [r, cc]
  }
  for (let rr = r + 1; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      if (!black.has(`${rr},${cc}`)) return [rr, cc]
    }
  }
  return null
}

function findPrevCell(r, c, rows, cols, black) {
  for (let cc = c - 1; cc >= 0; cc--) {
    if (!black.has(`${r},${cc}`)) return [r, cc]
  }
  for (let rr = r - 1; rr >= 0; rr--) {
    for (let cc = cols - 1; cc >= 0; cc--) {
      if (!black.has(`${rr},${cc}`)) return [rr, cc]
    }
  }
  return null
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const pc = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },

  // Controls
  controlBar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    padding: '18px 0 18px',
    borderBottom: '1px solid #e5e2da',
    marginBottom: 20,
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  controlLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.textMuted,
  },
  sizeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  select: {
    padding: '7px 10px',
    border: '1px solid #d4cfc7',
    borderRadius: 7,
    fontSize: 14,
    fontFamily: FONTS.sans,
    background: '#fff',
    color: COLORS.textPrimary,
    cursor: 'pointer',
    outline: 'none',
  },
  times: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontWeight: 700,
  },
  dimHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  controlDivider: {
    width: 1,
    height: 36,
    background: '#e5e2da',
    margin: '0 4px',
  },
  generateBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 18px',
    background: COLORS.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: FONTS.sans,
    whiteSpace: 'nowrap',
  },
  outlineBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 16px',
    background: 'transparent',
    color: COLORS.textMid,
    border: '1px solid #d4cfc7',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONTS.sans,
    whiteSpace: 'nowrap',
  },
  outlineBtnActive: {
    background: '#fff8c5',
    borderColor: '#c4a400',
    color: '#7a6200',
  },
  ghostBtn: {
    padding: '9px 14px',
    background: 'transparent',
    color: COLORS.error,
    border: '1px solid #f0ccc8',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: FONTS.sans,
  },
  statPill: {
    marginLeft: 'auto',
    background: '#f4f2ed',
    border: '1px solid #e5e2da',
    borderRadius: 20,
    padding: '5px 14px',
  },
  blockModeBanner: {
    display: 'flex',
    alignItems: 'center',
    background: '#fff8c5',
    border: '1px solid #e8d000',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 13,
    color: '#5a4800',
    marginBottom: 16,
    fontFamily: FONTS.sans,
  },

  // Main area
  mainArea: {
    display: 'flex',
    gap: 28,
    alignItems: 'flex-start',
  },
  gridSection: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  hint: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 1.6,
    maxWidth: 520,
    padding: '14px 0 8px',
    fontFamily: FONTS.sans,
  },
  gridWrap: {
    display: 'inline-block',
    borderRadius: 4,
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
  },
  cell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: COLORS.textMid,
    paddingTop: 4,
  },
  footerStat: {
    fontWeight: 600,
  },
  footerDot: {
    color: COLORS.textFaint,
  },

  // Clue panel
  cluePanel: {
    flex: 1,
    minWidth: 0,
    background: '#fff',
    border: '1px solid #e5e2da',
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: 680,
    display: 'flex',
    flexDirection: 'column',
  },
  cluePanelEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '48px 32px',
    color: COLORS.textMid,
    fontFamily: FONTS.sans,
    flex: 1,
  },
  cluePanelInner: {
    overflowY: 'auto',
    flex: 1,
    padding: '4px 0 12px',
  },
  clueBlock: {
    padding: '0 0 8px',
  },
  clueSectionTitle: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: COLORS.textMuted,
    background: '#fff',
    padding: '12px 20px 8px',
    borderBottom: '1px solid #f0ede6',
    marginBottom: 4,
  },
  clueRow: {
    padding: '8px 16px',
    borderBottom: '1px solid #fafaf9',
  },
  clueRowTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  clueNum: {
    minWidth: 24,
    height: 22,
    borderRadius: 5,
    background: '#111',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: FONTS.sans,
    flexShrink: 0,
  },
  clueLen: {
    fontSize: 11,
    color: COLORS.textMuted,
    flexShrink: 0,
  },
  cluePreview: {
    fontSize: 12,
    fontFamily: 'monospace',
    letterSpacing: 2,
    color: COLORS.textMid,
    background: '#f4f2ed',
    padding: '2px 8px',
    borderRadius: 4,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  filledBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.successText,
    background: COLORS.success,
    padding: '2px 6px',
    borderRadius: 10,
    flexShrink: 0,
  },
  clueInput: {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid #e5e2da',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: FONTS.sans,
    color: COLORS.textPrimary,
    background: '#fafaf9',
    outline: 'none',
    boxSizing: 'border-box',
  },

  // Publish section
  publishWrap: {
    marginTop: 32,
    background: '#fff',
    border: '1px solid #e5e2da',
    borderRadius: 12,
    overflow: 'hidden',
  },
  publishHeader: {
    padding: '18px 24px 16px',
    borderBottom: '1px solid #f0ede6',
    background: '#fafaf9',
  },
  publishTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: COLORS.textPrimary,
    display: 'flex',
    alignItems: 'center',
    marginBottom: 4,
    fontFamily: FONTS.sans,
  },
  publishSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: FONTS.sans,
  },
  publishBody: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  readinessRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  publishWarning: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 4,
    padding: '10px 14px',
    background: '#fffbea',
    border: '1px solid #e8d000',
    borderRadius: 8,
    fontSize: 13,
    color: '#5a4800',
    fontFamily: FONTS.sans,
  },
  publishRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 14,
    flexWrap: 'wrap',
  },
  publishPickerGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  publishPickerLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.textMuted,
    fontFamily: FONTS.sans,
  },
  datePicker: {
    padding: '9px 12px',
    border: '1px solid #d4cfc7',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: FONTS.sans,
    color: COLORS.textPrimary,
    background: '#fff',
    outline: 'none',
    cursor: 'pointer',
  },
  publishBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 22px',
    background: COLORS.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    fontFamily: FONTS.sans,
    whiteSpace: 'nowrap',
  },
  publishSuccess: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 18px',
    background: COLORS.success,
    border: `1px solid ${COLORS.accentLight}`,
    borderRadius: 8,
    fontSize: 13,
    color: COLORS.successText,
    fontFamily: FONTS.sans,
    fontWeight: 500,
  },

  // Scheduled list
  scheduledWrap: {
    borderTop: '1px solid #f0ede6',
    padding: '16px 24px 20px',
  },
  scheduledTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.textMuted,
    marginBottom: 10,
    fontFamily: FONTS.sans,
  },
  scheduledList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  scheduledRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    background: '#fafaf9',
    border: '1px solid #e5e2da',
    borderRadius: 8,
  },
  scheduledDate: {
    fontWeight: 600,
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
    fontFamily: FONTS.sans,
  },
  scheduledBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 10px',
    borderRadius: 20,
    background: '#e8f0fe',
    color: '#1a3a80',
  },
  unpublishBtn: {
    fontSize: 12,
    padding: '4px 12px',
    border: '1px solid #f0ccc8',
    borderRadius: 6,
    background: 'transparent',
    color: COLORS.error,
    cursor: 'pointer',
    fontFamily: FONTS.sans,
  },
}
