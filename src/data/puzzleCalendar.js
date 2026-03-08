/**
 * Date-based puzzle selection and admin overrides.
 * Puzzles rotate daily (IST). Admin edits stored in localStorage.
 * 13×13 grid, 30–50% black, 6+ unique patterns.
 */
import { PUZZLE_BANK } from './puzzleBank.js'

const ADMIN_EDITS_KEY = 'df_admin_puzzle_edits'

const EFFECTIVE_POOL = PUZZLE_BANK

function dateHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function getPuzzleForDate(dateStr) {
  const base = EFFECTIVE_POOL[dateHash(dateStr) % EFFECTIVE_POOL.length]
  const edits = getAdminPuzzleEdits(dateStr)
  if (!edits) return base
  return mergePuzzleEdits(base, edits)
}

export function getAdminPuzzleEdits(dateStr) {
  try {
    const raw = localStorage.getItem(ADMIN_EDITS_KEY)
    if (!raw) return null
    const all = JSON.parse(raw)
    return all[dateStr] || null
  } catch { return null }
}

export function setAdminPuzzleEdits(dateStr, edits) {
  try {
    const raw = localStorage.getItem(ADMIN_EDITS_KEY)
    const all = raw ? JSON.parse(raw) : {}
    if (edits && Object.keys(edits).length) {
      all[dateStr] = edits
    } else {
      delete all[dateStr]
    }
    localStorage.setItem(ADMIN_EDITS_KEY, JSON.stringify(all))
  } catch { /* storage unavailable */ }
}

function mergePuzzleEdits(base, edits) {
  // Full replacement: puzzle creator published a complete custom puzzle for this date.
  // Skip the base entirely and return the custom grid + clues directly.
  if (edits.fullReplacement) {
    return { grid: edits.grid, clues: edits.clues }
  }

  const out = JSON.parse(JSON.stringify(base))
  if (edits.clues) {
    const applyClueEdit = (list, e, dir) => {
      const found = list.find(c => c.n === e.n && c.r === e.r && c.c === e.c)
      if (!found) return
      if (e.clue != null) found.clue = e.clue
      if (e.trivia != null) found.trivia = e.trivia
      if (e.word != null && String(e.word).length === found.len) {
        for (let i = 0; i < found.len; i++) {
          const r = dir === 'across' ? found.r : found.r + i
          const c = dir === 'across' ? found.c + i : found.c
          out.grid[r][c] = String(e.word)[i].toUpperCase()
        }
      }
    }
    if (edits.clues.across) edits.clues.across.forEach(e => applyClueEdit(out.clues.across, e, 'across'))
    if (edits.clues.down) edits.clues.down.forEach(e => applyClueEdit(out.clues.down, e, 'down'))
  }
  if (edits.grid) out.grid = edits.grid
  return out
}
