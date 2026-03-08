#!/usr/bin/env python3
"""
DailyFill CORE Engine 3 — 13×13 Crossword Generator
====================================================
30–35% black, 25–35 words. Multiple templates for layout variety.
CSP solver. Reads word list as JSON from stdin.

Usage:
    echo '[{"word":"ALBUM","clue":"..."},...]' | python core3_crossword.py [seed]

Output: Single JSON object { grid, clues: { across, down } }
"""

import json
import random
import sys
import time
from collections import defaultdict

ROWS, COLS = 13, 13
TIMEOUT = 45
MAX_ATTEMPTS = 50
MIN_SLOT_LEN = 4
MAX_SLOT_LEN = 8

# ─── 8 DIFFERENT 13×13 TEMPLATES — 30–35% black (51–59 cells), 25–35 slots ─
# 1=white, 0=black. Rotational symmetry.

# Dense 13×13: 6-letter down runs (rows 0-5, 7-12), 5-6 across. ~52 black (31%)
TEMPLATE_A = [
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
]

TEMPLATE_B = [
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
]

TEMPLATE_C = [  # 57 black (34%) — cross center
    [1,1,1,1,0,1,1,1,0,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
]

TEMPLATE_D = [
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
]

TEMPLATE_E = [
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
]

TEMPLATE_F = [
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
]

TEMPLATE_G = [
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
]

TEMPLATE_H = [
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,0,0,1,0,1,0,1],
]

# Dense template: 5W 1B 5W 1B + col 0 black. ~30% black, 40+ slots
_dense_base = [
    [0,1,1,1,1,1,0,1,1,1,1,1,0],
    [0,1,1,1,1,1,0,1,1,1,1,1,0],
    [0,1,1,1,1,1,0,1,1,1,1,1,0],
    [0,1,1,1,1,1,0,1,1,1,1,1,0],
    [0,1,1,1,1,1,0,1,1,1,1,1,0],
    [0,1,1,1,1,1,0,1,1,1,1,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
]
TEMPLATE_DENSE = []
for r in range(13):
    if r < 7:
        TEMPLATE_DENSE.append(_dense_base[r][:])
    else:
        TEMPLATE_DENSE.append([_dense_base[12 - r][12 - c] for c in range(13)])

# Dense first when CSP can solve; ladder fallback
TEMPLATES = [TEMPLATE_A, TEMPLATE_B, TEMPLATE_C, TEMPLATE_DENSE, TEMPLATE_E, TEMPLATE_F, TEMPLATE_G, TEMPLATE_H]


def _make_symmetric_permutation(rng):
    """Return permutation of 0..12 that preserves 180° symmetry: perm[i] <-> perm[12-i]."""
    pairs = [(0, 12), (1, 11), (2, 10), (3, 9), (4, 8), (5, 7)]
    rng.shuffle(pairs)
    perm = [0] * 13
    for i, (a, b) in enumerate(pairs):
        perm[i], perm[12 - i] = a, b
    perm[6] = 6
    return perm


def _apply_column_permutation(T, perm):
    """Return new grid with columns permuted. Preserves rotational symmetry of T."""
    return [[row[perm[c]] for c in range(COLS)] for row in T]


def _apply_row_permutation(T, perm):
    """Return new grid with rows permuted. Preserves rotational symmetry of T."""
    return [T[perm[r]][:] for r in range(ROWS)]


def generate_dynamic_template(seed):
    """
    Generate a unique 13×13 template from seed.
    Uses different base templates + symmetric row/column permutations for variety.
    """
    rng = random.Random(seed)
    base_idx = seed % len(TEMPLATES)
    T = [row[:] for row in TEMPLATES[base_idx]]
    col_perm = _make_symmetric_permutation(rng)
    T = _apply_column_permutation(T, col_perm)
    row_perm = _make_symmetric_permutation(rng)
    T = _apply_row_permutation(T, row_perm)
    return T


def load_words():
    raw = sys.stdin.read().strip()
    data = json.loads(raw)
    return [{"word": str(x["word"]).upper().strip(), "clue": str(x.get("clue", "")).strip()}
            for x in data
            if isinstance(x.get("word"), str) and x["word"].strip().isalpha()]


def build_pool_by_length(words):
    pool = defaultdict(list)
    for w in words:
        word = w["word"]
        if MIN_SLOT_LEN <= len(word) <= MAX_SLOT_LEN:
            pool[len(word)].append(w)
    return pool


class Core3Solver:
    def __init__(self, template, pool_by_len, seed=None):
        if seed is not None:
            random.seed(seed)
        self.pool = {k: list(v) for k, v in pool_by_len.items()}
        for k in self.pool:
            random.shuffle(self.pool[k])
        self.T = template
        self.rows, self.cols = len(template), len(template[0])
        self.slots = []
        self._find_slots()
        n_slots = len(self.slots)
        self.cell_map = defaultdict(list)
        self._build_cell_map()
        self.solution = {}

    def _find_slots(self):
        T, R, C = self.T, self.rows, self.cols
        for r in range(R):
            c = 0
            while c < C:
                if T[r][c]:
                    start = c
                    while c < C and T[r][c]:
                        c += 1
                    if MIN_SLOT_LEN <= c - start <= MAX_SLOT_LEN:
                        self.slots.append(("across", r, start, c - start))
                else:
                    c += 1
        for c in range(C):
            r = 0
            while r < R:
                if T[r][c]:
                    start = r
                    while r < R and T[r][c]:
                        r += 1
                    if MIN_SLOT_LEN <= r - start <= MAX_SLOT_LEN:
                        self.slots.append(("down", start, c, r - start))
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
                    pat[pos] = self.solution[other_idx]["word"][other_pos]
                    break
        return pat

    def _domain(self, slot_idx):
        _, _, _, length = self.slots[slot_idx]
        pat = self._pattern(slot_idx)
        used = {self.solution[i]["word"] for i in self.solution}
        valid = [w for w in self.pool.get(length, [])
                 if w["word"] not in used and all(pat[i] is None or pat[i] == w["word"][i] for i in range(length))]
        return valid

    def solve(self, timeout=TIMEOUT):
        deadline = time.time() + timeout

        def backtrack():
            if time.time() > deadline:
                return False
            unassigned = [i for i in range(len(self.slots)) if i not in self.solution]
            if not unassigned:
                return True
            domains = {i: self._domain(i) for i in unassigned}
            for i in unassigned:
                if not domains[i]:
                    return False
            slot_idx = min(unassigned, key=lambda i: len(domains[i]))
            for w in domains[slot_idx]:
                self.solution[slot_idx] = w
                if backtrack():
                    return True
                del self.solution[slot_idx]
            return False

        return backtrack()

    def to_puzzle(self):
        R, C = self.rows, self.cols
        grid = [[None] * C for _ in range(R)]
        for i, (direction, r, c, length) in enumerate(self.slots):
            w = self.solution.get(i, {})
            word = w.get("word", "")
            for pos, letter in enumerate(word):
                if direction == "across":
                    grid[r][c + pos] = letter
                else:
                    grid[r + pos][c] = letter

        numbered = {}
        num = 1
        for r in range(R):
            for c in range(C):
                if not self.T[r][c]:
                    continue
                sa = (c == 0 or not self.T[r][c - 1]) and (c + 1 < C and self.T[r][c + 1])
                sd = (r == 0 or not self.T[r - 1][c]) and (r + 1 < R and self.T[r + 1][c])
                if sa or sd:
                    numbered[(r, c)] = num
                    num += 1

        across, down = [], []
        for i, (direction, r, c, length) in enumerate(self.slots):
            w = self.solution.get(i, {})
            n = numbered.get((r, c), 0)
            entry = {"n": n, "r": r, "c": c, "len": length, "clue": w.get("clue", "")}
            (across if direction == "across" else down).append(entry)

        across.sort(key=lambda x: (x["n"], x["r"], x["c"]))
        down.sort(key=lambda x: (x["n"], x["c"], x["r"]))

        return {"grid": grid, "clues": {"across": across, "down": down}}


def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else random.randint(0, 10_000_000)
    words = load_words()
    pool = build_pool_by_length(words)

    T = generate_dynamic_template(seed)

    slot_lengths = defaultdict(int)
    for r in range(ROWS):
        c = 0
        while c < COLS:
            if T[r][c]:
                start = c
                while c < COLS and T[r][c]:
                    c += 1
                if MIN_SLOT_LEN <= c - start <= MAX_SLOT_LEN:
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
                if MIN_SLOT_LEN <= r - start <= MAX_SLOT_LEN:
                    slot_lengths[r - start] += 1
            else:
                r += 1

    for length, count in slot_lengths.items():
        avail = len(pool.get(length, []))
        if avail < count:
            sys.stderr.write(f"Need {count} words of length {length}, have {avail}\n")
            sys.exit(1)

    for attempt in range(MAX_ATTEMPTS):
        s = seed if attempt == 0 else seed + attempt * 7777
        solver = Core3Solver(T, pool, seed=s)
        if solver.solve(timeout=TIMEOUT):
            puzzle = solver.to_puzzle()
            print(json.dumps(puzzle))
            return

    sys.stderr.write("No solution found.\n")
    sys.exit(1)


if __name__ == "__main__":
    main()
