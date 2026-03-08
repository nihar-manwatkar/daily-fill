/**
 * CORE Engine 3 — 13×13, 30–35% black, 25–35 words.
 * Spawns tools/core3_crossword.py (CSP solver, 8 layout templates).
 */
import { spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function generatePuzzleCore3(wordList, seed) {
  return new Promise((resolve, reject) => {
    const wordsJson = JSON.stringify(wordList.map(({ word, clue }) => ({ word, clue })))
    const pyPath = join(__dirname, '..', '..', 'tools', 'core3_crossword.py')

    const child = spawn('python', [pyPath, String(seed ?? Math.floor(Math.random() * 10_000_000))], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    })

    let stdout = ''
    let stderr = ''
    child.stdin.write(wordsJson)
    child.stdin.end()

    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const puzzle = JSON.parse(stdout.trim())
          resolve(puzzle)
        } catch (e) {
          reject(new Error(`CORE3 output parse error: ${e.message}`))
        }
      } else {
        reject(new Error(`CORE3 generator failed (${code}): ${stderr || 'no output'}`))
      }
    })

    child.on('error', (err) => reject(err))
  })
}
