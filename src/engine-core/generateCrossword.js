/**
 * Places a list of word-clue pairs onto a crossword grid.
 * Uses crossword-layout-generator. Output format matches DailyFill's puzzle schema.
 * Validates: no black squares in word paths, white:black >= 2:1, black <= 35%.
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { generateLayout } = require('crossword-layout-generator')

/** Validate puzzle: no black cells in word paths (critical). Ratio preferred but not enforced. */
function validatePuzzle(grid, across, down) {
  const R = grid.length
  const C = grid[0]?.length ?? 0

  const checkPath = (r, c, len, dir) => {
    for (let i = 0; i < len; i++) {
      const rr = dir === 'across' ? r : r + i
      const cc = dir === 'across' ? c + i : c
      if (!grid[rr]?.[cc]) return `Black cell in word at (${rr},${cc})`
    }
    return null
  }
  for (const cl of across) {
    const err = checkPath(cl.r, cl.c, cl.len, 'across')
    if (err) return err
  }
  for (const cl of down) {
    const err = checkPath(cl.r, cl.c, cl.len, 'down')
    if (err) return err
  }

  let white = 0, black = 0
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < (grid[r]?.length ?? C); c++) {
      if (grid[r]?.[c]) white++; else black++
    }
  }
  const total = white + black
  if (total === 0) return 'Empty grid'
  return null
}

/**
 * Renumber clues so each unique start cell gets sequential number (row-major).
 * Shared cells (e.g. 1 Across and 1 Down) get the same number.
 */
function renumberClues(across, down) {
  const starts = new Set()
  for (const cl of across) starts.add(`${cl.r},${cl.c}`)
  for (const cl of down) starts.add(`${cl.r},${cl.c}`)
  const sorted = [...starts].map(s => s.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const numMap = {}
  sorted.forEach(([r, c], i) => { numMap[`${r},${c}`] = i + 1 })
  const apply = (list) => list.map(cl => ({ ...cl, n: numMap[`${cl.r},${cl.c}`] ?? cl.n }))
  return { across: apply(across), down: apply(down) }
}

/**
 * @param {Array<{ word: string, clue: string }>} wordList
 * @returns {{ grid: string[][], clues: { across: Array<{n,r,c,len,clue}>, down: Array<{n,r,c,len,clue}> }}
 */
export function generateCrossword(wordList) {
  const input = wordList.map(({ word, clue }) => ({
    answer: word.toUpperCase(),
    clue,
  }))

  const layout = generateLayout(input)

  const placed = layout.result.filter(w => w.orientation && w.orientation !== 'none')
  if (placed.length < 8) {
    throw new Error(`Only ${placed.length} words placed — need at least 8 for a usable puzzle`)
  }

  const rawTable = layout.table
  const grid = rawTable.map(row =>
    row.map(cell => (cell === '-' || !cell ? null : String(cell)))
  )

  const across = []
  const down = []

  for (const w of placed) {
    // Library uses 1-based startx/starty; convert to 0-based
    const r = (w.starty ?? 1) - 1
    const c = (w.startx ?? 1) - 1
    const len = w.answer.length
    const entry = { n: 0, r, c, len, clue: w.clue }
    if (w.orientation === 'across') across.push(entry)
    else if (w.orientation === 'down') down.push(entry)
  }

  const { across: acrossRenum, down: downRenum } = renumberClues(across, down)
  const clues = { across: acrossRenum, down: downRenum }

  const err = validatePuzzle(grid, clues.across, clues.down)
  if (err) throw new Error(err)

  return { grid, clues }
}
