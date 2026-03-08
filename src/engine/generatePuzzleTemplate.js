/**
 * Generates one puzzle using the template-based Python CSP solver.
 * 30-40% black cells, 12×12 grid.
 * Returns { grid, clues } or null if generation fails.
 */
import { spawn } from 'child_process'
import { createRequire } from 'module'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

export async function generatePuzzleTemplate(wordList, seed) {
  return new Promise((resolve, reject) => {
    const wordsJson = JSON.stringify(wordList.map(({ word, clue }) => ({ word, clue })))
    const pyPath = join(__dirname, '..', '..', 'tools', 'template_crossword.py')

    const child = spawn('python', [pyPath, String(seed || Math.floor(Math.random() * 10_000_000))], {
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
          reject(new Error(`Template output parse error: ${e.message}`))
        }
      } else {
        reject(new Error(`Template generator failed (${code}): ${stderr || 'no output'}`))
      }
    })

    child.on('error', (err) => reject(err))
  })
}
