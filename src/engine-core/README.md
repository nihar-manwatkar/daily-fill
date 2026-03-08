# CORE ENGINE — DailyFill Crossword Generator (Preserved)

Canonical backup of the **original** crossword generation engine.

## CORE Engine 3 (default)

The active engine is **CORE Engine 3** — fixed 13×13 grid, dynamic layouts:
- 13×13 grid (universal)
- `layoutGeneratorCore3.js` + `generateCrosswordCore3.js`
- Set `DAILYFILL_ENGINE=core3`

## CORE Version 2

**CORE Version 2** — template-based CSP solver (`DAILYFILL_ENGINE=template`):
- 12×12 fixed template
- ~37–47% black cells (target 30–40%)
- Only 5–6 letter slots
- Uses `tools/template_crossword.py` + `getTemplateWordPool()` for full word pool

See `src/engine/generatePuzzleTemplate.js` and `tools/template_crossword.py`.

---

## Revert to CORE ENGINE (original)

**To revert back to the original CORE ENGINE:** Set `DAILYFILL_ENGINE=core` and regenerate:

```
set DAILYFILL_ENGINE=core
node src/engine/generatePuzzleBank.js
```

Or tell the AI: **"Revert back to CORE ENGINE"** — the AI will set the env and regenerate.

## What CORE ENGINE (original) does
- Uses `crossword-layout-generator` (free-form layout)
- Produces 12×12–16×16 grids
- ~58–70% black cells
- 6 unique puzzles, minimal word overlap, trivia

## Files (do not modify)
- `generateCrossword.js`
- `generateWordList.js`
- `generatePuzzleBank.js`
