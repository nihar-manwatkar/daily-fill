/**
 * Daily puzzle generation pipeline:
 * Step 1: generateWordList (Claude or fallback)
 * Step 2: generateCrossword (grid placement)
 * Step 3: write puzzles.js
 *
 * Run: node src/engine/generateDaily.js
 */

import { generateCrossword } from './generateCrossword.js'
import { generateWordList } from './generateWordList.js'
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function getTodaySeed() {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  return parseInt(ist.toISOString().slice(0, 10).replace(/-/g, ''), 10)
}

async function run() {
  const seed = getTodaySeed()
  const dateStr = new Date().toISOString().slice(0, 10)

  console.log('\n── DailyFill Generation ─────────────────────────')
  console.log(`Date: ${dateStr}  |  Seed: ${seed}`)

  console.log('\n[1/3] Generating word list...')
  let wordList
  try {
    wordList = await generateWordList(seed)
  } catch (err) {
    console.error(`Word generation failed: ${err.message}`)
    process.exit(1)
  }

  console.log('\n[2/3] Building crossword grid...')
  let puzzle = null
  let attempt = 0

  while (!puzzle && attempt < 15) {
    try {
      const slice =
        attempt === 0
          ? wordList
          : wordList.slice(attempt * 2).concat(wordList.slice(0, attempt * 2))

      puzzle = generateCrossword(slice)

      const total = puzzle.clues.across.length + puzzle.clues.down.length
      console.log(`  ✓ Placed ${total} words (${puzzle.clues.across.length}A / ${puzzle.clues.down.length}D)`)
    } catch (err) {
      attempt++
      console.log(`  ✗ Attempt ${attempt}: ${err.message}`)
    }
  }

  if (!puzzle) {
    console.error('\nFATAL: Grid placement failed after 15 attempts.')
    console.error('Re-run the script — the seed shift will produce a different word list.')
    process.exit(1)
  }

  console.log('\n[3/3] Writing puzzles.js...')

  const outputPath = join(__dirname, '..', 'data', 'puzzles.js')
  const output = `// Auto-generated — do not edit manually
// Date:  ${dateStr}
// Seed:  ${seed}
// Words: ${puzzle.clues.across.length + puzzle.clues.down.length} placed
// Re-generate: node src/engine/generateDaily.js

export const PUZZLE = ${JSON.stringify(puzzle, null, 2)}

export const PUZZLES = { classic: PUZZLE }

export const PENALTY = { letter: 5, word: 15, checkWord: 10, all: 100 }
`

  writeFileSync(outputPath, output)
  console.log(`\n✓ Done. puzzles.js ready for ${dateStr}.\n`)
}

run()
