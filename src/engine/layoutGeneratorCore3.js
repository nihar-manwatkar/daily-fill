/**
 * DailyFill CORE Engine 3 — 13×13 fixed grid layout generator.
 * Based on crossword-layout-generator (MIT).
 * Fixed 13×13 dimension, no trim. Dynamic layouts, different every run.
 *
 * See: https://github.com/MichaelWehar/Crossword-Layout-Generator
 */

import { createRequire } from 'module'
import fs from 'fs'

const require2 = createRequire(import.meta.url)
const origPath = require2.resolve('crossword-layout-generator')
let code = fs.readFileSync(origPath, 'utf8')

// CORE Engine 3: Fixed 13×13 grid (no computeDimension)
code = code.replace(
  'function generateSimpleTable(words){\n    var rows = computeDimension(words, 3);\n    var cols = rows;',
  'function generateSimpleTable(words){\n    var rows = 13;\n    var cols = 13;'
)
// Skip trim — keep full 13×13 output
code = code.replace(
  '    var newTable = removeIsolatedWords(table);\n    var finalTable = trimTable(newTable);\n    assignPositions(finalTable.result);\n    return finalTable;',
  '    var newTable = removeIsolatedWords(table);\n    assignPositions(newTable.result);\n    return newTable;'
)
code = code.replace('    console.log(word + ", " + bestScore);', '    /* silent */')

const mod = { exports: {} }
const fn = new Function('module', 'exports', code)
fn(mod, mod.exports)

export const { generateLayout } = mod.exports
