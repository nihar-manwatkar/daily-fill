/**
 * Tuned layout generator — based on crossword-layout-generator (MIT).
 * Uses dimensionFactor 2 (vs 3) for tighter grids → typically ~50–60% black.
 * Silent (no console.log). Dynamic layouts, different every run.
 *
 * See: https://github.com/MichaelWehar/Crossword-Layout-Generator
 */

import { createRequire } from 'module'
import fs from 'fs'

const require2 = createRequire(import.meta.url)

// Resolve returns path to main entry: src/layout_generator.js
const origPath = require2.resolve('crossword-layout-generator')
let code = fs.readFileSync(origPath, 'utf8')
code = code.replace('computeDimension(words, 3)', 'computeDimension(words, 2)')
code = code.replace('    console.log(word + ", " + bestScore);', '    /* silent */')

const mod = { exports: {} }
const fn = new Function('module', 'exports', code)
fn(mod, mod.exports)

export const { generateLayout } = mod.exports
