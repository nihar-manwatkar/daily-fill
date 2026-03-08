/**
 * Crossword engine selection.
 * - layout: (default) Dynamic layouts, 28–40 words, 12×16 grid, different every run
 * - template: CORE Version 2 — 12×12, ~37–47% black, fixed pattern
 * - core3: 13×13 fixed ladder, ~16 words (same-looking templates)
 * - core: CORE ENGINE (original) — 12–16, ~58–70% black
 */
export const ENGINE_MODE =
  (typeof process !== 'undefined' && process.env?.DAILYFILL_ENGINE) || 'layout'
