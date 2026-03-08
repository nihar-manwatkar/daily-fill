#!/usr/bin/env python3
"""
DailyFill CORE Version 2 — Template Crossword Generator
=======================================================
30–40% black cells, 12×12 grid, 5–6 letter slots only.
CSP-based solver. Reads word list as JSON from stdin.

Usage:
    echo '[{"word":"ALBUM","clue":"..."},...]' | python template_crossword.py [seed]

Output: Single JSON object { grid, clues: { across, down } }
"""

import json
import random
import sys
import time
from collections import defaultdict

# ─── 12×12 TEMPLATE — 37% black (54 black, 90 white) ───────────────────────
# CORE Version 2: Only 5 and 6 letter slots. Simple ladder pattern.
# 1=white, 0=black. Rows 0,7 = full across (6+5). Rows 1-5, 8-11 = ladder.
# Row 6 = full block. Down cols 0,2,4,8,10 = 6+5 letter runs.
TEMPLATE_12x12 = [
    [1,1,1,1,1,1,0,1,1,1,1,1],  # 6, 5 across
    [1,0,1,0,1,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,1,0,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0],  # block row
    [1,1,1,1,1,1,0,1,1,1,1,1],  # 6, 5 across
    [1,0,1,0,1,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,1,0,1,0,1],
]
ROWS, COLS = 12, 12
TIMEOUT = 60
MAX_ATTEMPTS = 150


def load_words():
    """Read word-clue list from stdin."""
    raw = sys.stdin.read().strip()
    data = json.loads(raw)
    return [{"word": str(x["word"]).upper().strip(), "clue": str(x.get("clue", "")).strip()}
            for x in data
            if isinstance(x.get("word"), str) and x["word"].strip().isalpha()]


def build_pool_by_length(words):
    """Group words by length."""
    pool = defaultdict(list)
    for w in words:
        word = w["word"]
        if 3 <= len(word) <= 12:
            pool[len(word)].append(w)
    return pool


class TemplateSolver:
    def __init__(self, pool_by_len, seed=None):
        if seed is not None:
            random.seed(seed)
        self.pool = pool_by_len
        for k in self.pool:
            random.shuffle(self.pool[k])
        self.T = TEMPLATE_12x12
        self.slots = []
        self.slot_across = []
        self._find_slots()
        self.cell_map = defaultdict(list)
        self._build_cell_map()
        self.solution = {}

    def _find_slots(self):
        T = self.T
        # Across
        for r in range(ROWS):
            c = 0
            while c < COLS:
                if T[r][c]:
                    start = c
                    while c < COLS and T[r][c]:
                        c += 1
                    if c - start >= 5:  # min 5 to match word pool
                        self.slots.append(("across", r, start, c - start))
                        self.slot_across.append(True)
                else:
                    c += 1
        # Down
        for c in range(COLS):
            r = 0
            while r < ROWS:
                if T[r][c]:
                    start = r
                    while r < ROWS and T[r][c]:
                        r += 1
                    if r - start >= 5:  # min 5 to match word pool
                        self.slots.append(("down", start, c, r - start))
                        self.slot_across.append(False)
                else:
                    r += 1

    def _build_cell_map(self):
        for i, (direction, r, c, length) in enumerate(self.slots):
            for pos in range(length):
                cell = (r, c + pos) if direction == "across" else (r + pos, c)
                self.cell_map[cell].append((i, pos))

    def _pattern(self, slot_idx):
        direction, r, c, length = self.slots[slot_idx]
        pat = [None] * length
        for pos in range(length):
            cell = (r, c + pos) if direction == "across" else (r + pos, c)
            for other_idx, other_pos in self.cell_map[cell]:
                if other_idx in self.solution:
                    w = self.solution[other_idx]
                    pat[pos] = w["word"][other_pos]
                    break
        return pat

    def _domain(self, slot_idx):
        _, _, _, length = self.slots[slot_idx]
        pat = self._pattern(slot_idx)
        used = {self.solution[i]["word"] for i in self.solution}
        valid = []
        for w in self.pool.get(length, []):
            word = w["word"]
            if word in used or len(word) != length:
                continue
            if all(pat[i] is None or pat[i] == word[i] for i in range(length)):
                valid.append(w)
        return valid

    def solve(self, timeout=TIMEOUT):
        deadline = time.time() + timeout

        def backtrack():
            if time.time() > deadline:
                return False
            unassigned = [i for i in range(len(self.slots)) if i not in self.solution]
            if not unassigned:
                return True
            domains = {}
            for i in unassigned:
                d = self._domain(i)
                if not d:
                    return False
                domains[i] = d
            slot_idx = min(unassigned, key=lambda i: len(domains[i]))
            for w in domains[slot_idx]:
                self.solution[slot_idx] = w
                if backtrack():
                    return True
                del self.solution[slot_idx]
            return False

        return backtrack()

    def to_puzzle(self):
        """Output DailyFill puzzle format: { grid, clues: { across, down } }."""
        grid = [[None] * COLS for _ in range(ROWS)]
        for i, (direction, r, c, length) in enumerate(self.slots):
            w = self.solution.get(i, {})
            word = w.get("word", "")
            clue = w.get("clue", "")
            for pos, letter in enumerate(word):
                if direction == "across":
                    grid[r][c + pos] = letter
                else:
                    grid[r + pos][c] = letter

        # Number grid (row-major)
        numbered = {}
        num = 1
        for r in range(ROWS):
            for c in range(COLS):
                if not self.T[r][c]:
                    continue
                starts_across = (c == 0 or not self.T[r][c - 1]) and (c + 1 < COLS and self.T[r][c + 1])
                starts_down = (r == 0 or not self.T[r - 1][c]) and (r + 1 < ROWS and self.T[r + 1][c])
                if starts_across or starts_down:
                    numbered[(r, c)] = num
                    num += 1

        across = []
        down = []
        for i, (direction, r, c, length) in enumerate(self.slots):
            w = self.solution.get(i, {})
            n = numbered.get((r, c), 0)
            entry = {"n": n, "r": r, "c": c, "len": length, "clue": w.get("clue", "")}
            if direction == "across":
                across.append(entry)
            else:
                down.append(entry)

        across.sort(key=lambda x: (x["n"], x["r"], x["c"]))
        down.sort(key=lambda x: (x["n"], x["c"], x["r"]))

        return {"grid": grid, "clues": {"across": across, "down": down}}


def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else random.randint(0, 10_000_000)
    words = load_words()
    pool = build_pool_by_length(words)

    # Ensure we have enough words for slot lengths
    slot_lengths = defaultdict(int)
    T = TEMPLATE_12x12
    for r in range(ROWS):
        c = 0
        while c < COLS:
            if T[r][c]:
                start = c
                while c < COLS and T[r][c]:
                    c += 1
                if c - start >= 5:
                    slot_lengths[c - start] += 1
            else:
                c += 1
    for c in range(COLS):
        r = 0
        while r < ROWS:
            if T[r][c]:
                start = r
                while r < ROWS and T[r][c]:
                    r += 1
                if r - start >= 5:
                    slot_lengths[r - start] += 1
            else:
                r += 1

    for length, count in slot_lengths.items():
        avail = len(pool.get(length, []))
        if avail < count:
            sys.stderr.write(f"Need at least {count} words of length {length}, have {avail}\n")
            sys.exit(1)

    for attempt in range(MAX_ATTEMPTS):
        s = random.randint(0, 10_000_000) if attempt > 0 else seed
        solver = TemplateSolver(dict(pool), seed=s)
        if solver.solve(timeout=TIMEOUT):
            puzzle = solver.to_puzzle()
            print(json.dumps(puzzle))
            return

    sys.stderr.write("No solution found.\n")
    sys.exit(1)


if __name__ == "__main__":
    main()
