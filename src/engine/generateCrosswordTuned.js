/**
 * Tuned crossword generator — uses layoutGeneratorTuned (dimension factor 2).
 * Produces dynamic layouts, target 30–50% black.
 * Same output format as generateCrossword.
 */

import { generateLayout } from './layoutGeneratorTuned.js'

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
  return null
}

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

export function generateCrosswordTuned(wordList) {
  const input = wordList.map(({ word, clue }) => ({
    answer: word.toUpperCase(),
    clue,
  }))

  const layout = generateLayout(input)

  const placed = layout.result.filter(w => w.orientation && w.orientation !== 'none')
  if (placed.length < 8) {
    throw new Error(`Only ${placed.length} words placed — need at least 8`)
  }

  const rawTable = layout.table
  const grid = rawTable.map(row =>
    row.map(cell => (cell === '-' || !cell ? null : String(cell)))
  )

  const across = []
  const down = []
  for (const w of placed) {
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
