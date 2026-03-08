#!/usr/bin/env python3
"""
DailyFill Crossword Generator — CSP-based solver
=================================================
Uses Minimum Remaining Value (MRV) backtracking to fill a
symmetric 9×9 grid with valid intersecting words. No loops,
no guessing — pure constraint satisfaction.

Usage:
    python crossword_generator.py <category>
    python crossword_generator.py business
    python crossword_generator.py nerds

Output: Filled grid + word list printed to stdout, ready for
        clue-writing and insertion into puzzles.js
"""

import random, time, sys
from collections import defaultdict

# ─── SIMPLE 5×5 TEMPLATE  (fewer constraints) ───────────────────────────
#   col: 0 1 2 3 4
# row 0: W W W W W   →  5-across
# row 1: W . W . W   →  down only
# row 2: W W W W W   →  5-across
# row 3: W . W . W   →  down only
# row 4: W W W W W   →  5-across
# Down: cols 0, 2, 4 (each 5 letters)
SIMPLE_5x5 = [
    [1,1,1,1,1],
    [1,0,1,0,1],
    [1,1,1,1,1],
    [1,0,1,0,1],
    [1,1,1,1,1],
]

# ─── GRID TEMPLATE  9 × 9  (180° rotational symmetry) ────────────────────────
TEMPLATE_9x9 = [
    [1,1,1,0,1,1,1,1,1],
    [1,0,1,0,1,0,1,0,1],
    [1,1,1,1,1,0,1,1,1],
    [1,0,1,0,1,0,1,0,1],
    [1,1,1,1,1,1,1,1,1],
    [1,0,1,0,1,0,1,0,1],
    [1,1,1,0,1,1,1,1,1],
    [1,0,1,0,1,0,1,0,1],
    [1,1,1,1,1,0,1,1,1],
]

# Use simple template by default (CSP solves much faster)
USE_SIMPLE = True
TEMPLATE = SIMPLE_5x5 if USE_SIMPLE else TEMPLATE_9x9
ROWS = 5 if USE_SIMPLE else 9
COLS = 5 if USE_SIMPLE else 9
TIMEOUT = 45   # seconds per attempt before restart
MAX_ATTEMPTS = 150


# ─── GENERAL 9-LETTER WORD LIST  (for DOWN slots) ────────────────────────────
# Large pool of common English words to fill the five 9-letter down columns.
# The more words here, the faster the solver converges.

GENERAL_9 = list(set([
    "ABANDONED","ABILITIES","ACCEPTING","ACCIDENTS","ACCORDING","ACHIEVING",
    "ALONGSIDE","ANNOUNCED","ANONYMOUS","ARGUMENTS","ASSEMBLED","AVAILABLE",
    "BEAUTIFUL","BEGINNING","BELONGING","BREATHING","BRILLIANT","BROADCAST",
    "BUILDINGS","BYSTANDER","CALENDARS","CAREFULLY","CELEBRATE","CHALLENGE",
    "CHARACTER","CIRCULATE","CLOCKWISE","COLLECTED","COMBINING","COMMITTED",
    "COMPARING","COMPUTERS","CONFIDENT","CONTACTED","CONVERTED","DATABASES",
    "DECLARING","DEFENDING","DEPARTURE","DEPENDING","DESCRIBED","DESIGNING",
    "DIFFERENT","DIRECTION","DISAPPEAR","DISCLOSED","DISCOVERY","DISCUSSED",
    "DISPLAYED","DOMINATED","EDUCATION","EFFECTIVE","EFFICIENT","ELABORATE",
    "EMERGENCY","EMOTIONAL","ENCOUNTER","ENERGETIC","ENHANCING","EVALUATED",
    "EVERYBODY","EXCEPTION","EXPECTING","EXPLAINED","FACTORING","FEATURING",
    "FRAMEWORK","FREQUENCY","GATHERING","GENERATES","GRADUATED","GUARANTEE",
    "HAPPENING","HAPPINESS","HIGHLIGHT","IDENTICAL","IMPLEMENT","IMPROVING",
    "INCREMENT","INDICATED","INFLUENCE","INITIATED","INSTANCES","INSURANCE",
    "INTEGRATE","INTENTION","INVOLVING","JUDGEMENT","KNOWLEDGE","LANDSCAPE",
    "LAUNCHING","LITERALLY","LOCATIONS","MACHINERY","MEASURING","MECHANISM",
    "MENTIONED","MOTIVATED","MOUNTAINS","MOVEMENTS","MUNICIPAL","NARRATIVE",
    "NIGHTMARE","NUMERICAL","OBJECTIVE","OBSTACLES","OCCURRING","OPERATION",
    "ORGANISED","OWNERSHIP","PASSENGER","PERFORMED","PERSONNEL","PLACEMENT",
    "PLATFORMS","POTENTIAL","PRACTICAL","PRESENTED","PRIVILEGE","PROCESSED",
    "PRODUCING","PROMINENT","PROVIDING","PUBLISHED","PURCHASED","QUALIFIED",
    "QUARTERLY","QUESTIONS","REASONING","RECOVERED","REFLECTED","REGARDING",
    "REJECTION","REMAINING","REPRESENT","REQUESTED","REQUIRING","RESIDENCE",
    "RESPECTED","RESULTING","RETURNING","REVIEWING","REWARDING","SCATTERED",
    "SCREENING","SELECTING","SENSITIVE","SENTENCES","SITUATION","SOMETHING",
    "SOMETIMES","SOMEWHERE","SPREADING","STANDARDS","STATEMENT","STRUCTURE",
    "SUPPORTED","SURPRISED","SURVIVING","TARGETING","THOUSANDS","THEREFORE",
    "TOLERANCE","TRANSPORT","TRAVELING","TREATMENT","UNLIMITED","UPLOADING",
    "UTILITIES","VARIATION","VIOLATING","WELCOMING","WITHDRAWN","WONDERFUL",
    "YESTERDAY","ALGORITHM","RECURSION","INTERFACE","STREAMING","PROTOTYPE",
    "SINGLETON","ITERATION","RENDERING","SCRIPTING","VARIABLES","LIBRARIES",
    "FUNCTIONS","BANDWIDTH","TEMPLATES","LOCALHOST","DEBUGGING","BENCHMARK",
    "COMMUNITY","COMPLETED","COMPUTING","CONCERNED","CONDUCTED","CONNECTED",
    "CONSUMING","CONTINUES","CORRECTED","CUSTOMERS","DEVELOPED","ELECTRONS",
    "ENCRYPTED","EXECUTING","EXTENDING","FILTERING","FOLLOWING","FORWARDED",
    "GENERATED","HIERARCHY","INHERITED","INJECTION","SEARCHING","SCHEDULED",
    "SWITCHING","TIMESTAMP","TRANSFORM","VALIDATED","VERSIONED","ALLOCATES",
    "ALLOWANCE","ALTERNATE","AMPLIFIED","ANALYZING","APPEARING","ARCHIVING",
    "BRANCHING","CANONICAL","CAPTIONED","CASCADING","CLASSROOM","COMMANDED",
    "COMPLYING","CONDENSED","CONSULTED","EMBEDDING","EMULATING","ENDPOINTS",
    "NUTRITION","METABOLIC","COGNITIVE","PROBIOTIC","SEROTONIN","MELATONIN",
    "WELLBEING","ENDORPHIN","EXERCISES","ANTIDOTES","BIOMETRIC","KETOGENIC",
    "MARKETING","CORPORATE","INVESTORS","FINANCIAL","STRATEGIC","CONSUMERS",
    "ANALYTICS","INVENTORY","LOGISTICS","FRANCHISE","PORTFOLIO","RECESSION",
    "EXPANSION","CONTRACTS","WHOLESALE","DIVIDENDS","EMPLOYEES","CELEBRITY",
    "INFLUENCE","FOLLOWING","SUBSCRIBE","THUMBNAIL","BILLBOARD","SEASONING",
    "MARINATED","APPETIZER","CHOCOLATE","FERMENTED","MUSHROOMS","SIMMERING",
    "EXCEPTION","FRAMEWORK","RECURSIVE","BYTECODES","ALGORITHM","BANDWIDTH",
    "ACCEPTING","SELECTING","SCATTERED","STATEMENT","STRUCTURE","SUPPORTED",
    "REMAINING","REQUESTED","REQUIRING","RESIDENCE","RESPECTED","RESULTING",
    "RETURNING","REVIEWING","PRODUCING","PROMINENT","PROVIDING","PUBLISHED",
    "PURCHASED","QUALIFIED","QUARTERLY","THOUSANDS","THEREFORE","TOLERANCE",
    "TRANSPORT","TRAVELING","TREATMENT","UNLIMITED","UPLOADING","UTILITIES",
    "VARIATION","VIOLATING","WELCOMING","WITHDRAWN","WONDERFUL","YESTERDAY",
    "ALLOCATED","ANNOTATED","APPEALING","ASSEMBLED","ASSERTING","ASSIGNING",
    "ATTEMPTED","ATTENDING","BALANCING","BELIEVING","BELONGING","BORROWING",
    "CAREFULLY","CAPTURING","CERTAINLY","CLARIFIED","COLLECTED","COMBINING",
    "COMMITTED","COMPARING","COMPETING","CONCEALED","CONCLUDED","CONFIRMED",
    "CONFUSING","CONNECTED","CONVINCED","CORRECTED","CUSTOMERS","DATABASES",
    "DECLARING","DEFENDING","DEPARTURE","DEPENDING","DESCRIBED","DESIGNING",
    "DIRECTING","DISCLOSED","DISCOVERY","DISCUSSED","DISPLAYED","DOMINATED",
    "EFFECTIVE","EFFICIENT","ELABORATE","EMOTIONAL","ENCOUNTER","ENHANCING",
    "EVALUATED","EVERYBODY","EXPLAINED","FEATURING","GATHERING","GENERATES",
    "GRADUATED","GUARANTEE","HAPPENING","HAPPINESS","HIGHLIGHT","IDENTICAL",
    "IMPLEMENT","IMPROVING","INCREMENT","INDICATED","INITIATED","INSTANCES",
    "INSURANCE","INTEGRATE","INTENTION","INVOLVING","KNOWLEDGE","LANDSCAPE",
    "LAUNCHING","LITERALLY","LOCATIONS","MACHINERY","MEASURING","MECHANISM",
    "MOTIVATED","MOUNTAINS","MOVEMENTS","MUNICIPAL","NARRATIVE","NIGHTMARE",
    "NUMERICAL","OBJECTIVE","OBSTACLES","OCCURRING","ORGANISED","OWNERSHIP",
    "PASSENGER","PERFORMED","PERSONNEL","PLACEMENT","PLATFORMS","PRIVILEGE",
]))

# Keep only exactly 9-letter words
GENERAL_9 = [w for w in GENERAL_9 if len(w) == 9]

# ─── GENERAL 5-LETTER WORDS (for simple 5×5 template) ────────────────────────
GENERAL_5 = list(set([
    "ABOUT","AFTER","AGAIN","ALONE","ALONG","AMONG","ANGEL","APPLE","ARISE",
    "ASIDE","AVOID","AWARD","BASIC","BEACH","BLACK","BLAME","BLANK","BLAST",
    "BLEND","BLESS","BLOOM","BOARD","BRAIN","BRAND","BRAVE","BREAD","BREAK",
    "BRICK","BRIEF","BRING","BROAD","BROKE","BUILD","BUNCH","BURST","BUYER",
    "CABLE","CALIF","CARRY","CATCH","CAUSE","CHAIN","CHAIR","CHART","CHASE",
    "CHEAP","CHECK","CHEST","CHIEF","CHILD","CHINA","CHOSE","CIVIL","CLAIM",
    "CLASS","CLEAN","CLEAR","CLICK","CLIMB","CLOCK","CLOSE","CLOTH","CLOUD",
    "COAST","COULD","COURT","COVER","CRACK","CRAFT","CRASH","CREAM","CRIME",
    "CROSS","CROWD","CROWN","CURVE","DANCE","DATED","DEALT","DEATH","DEBUT",
    "DELAY","DELTA","DENSE","DEPTH","DOUBT","DOZEN","DRAFT","DRAMA","DRAWN",
    "DREAM","DRESS","DRINK","DRIVE","DROVE","DYING","EAGLE","EARLY","EARTH",
    "EIGHT","ELECT","EMPTY","ENEMY","ENJOY","ENTER","ENTRY","EQUAL","ERROR",
    "EVENT","EVERY","EXACT","EXIST","EXTRA","FAITH","FALSE","FAULT","FEVER",
    "FIBER","FIELD","FIFTH","FIFTY","FIGHT","FINAL","FIRST","FIXED","FLAME",
    "FLASH","FLEET","FLOOR","FLUID","FOCUS","FORCE","FORTH","FORUM","FOUND",
    "FRAME","FRANK","FRAUD","FRESH","FRONT","FRUIT","FULLY","GIANT","GIVEN",
    "GLASS","GLOBE","GLORY","GOING","GRACE","GRADE","GRAIN","GRAND","GRANT",
    "GRASP","GRASS","GRAVE","GREAT","GREEN","GROSS","GROUP","GROWN","GUARD",
    "GUESS","GUEST","GUIDE","HAPPY","HARSH","HEART","HEAVY","HENCE","HORSE",
    "HOTEL","HOUSE","HUMAN","IDEAL","IMAGE","INDEX","INNER","INPUT","ISSUE",
    "JAPAN","JOINT","JUDGE","JUICY","KNIFE","KNOCK","KNOWN","LABEL","LARGE",
    "LASER","LATER","LAUGH","LEARN","LEAST","LEAVE","LEGAL","LEVEL","LIGHT",
    "LIMIT","LINKS","LIVES","LOCAL","LOGIC","LOOSE","LUCKY","LUNCH","LYING",
    "MAGIC","MAJOR","MAKER","MARCH","MATCH","MAYBE","MAYOR","MEANT","MEDIA",
    "METAL","METER","MIDST","MIGHT","MINOR","MIXED","MODEL","MONEY","MONTH",
    "MORAL","MOTOR","MOUNT","MOUSE","MOUTH","MOVIE","MUSIC","NAMED","NAVAL",
    "NEEDS","NEVER","NEWLY","NIGHT","NOBLE","NOISE","NORTH","NOVEL","NURSE",
    "OCCUR","OCEAN","OFFER","OFTEN","ORDER","OTHER","OUGHT","OUTER","OWNER",
    "PAINT","PANEL","PAPER","PARTY","PASTA","PASTE","PAUSE","PEACE","PENNY",
    "PEOPLE","PERCH","PHASE","PHONE","PHOTO","PIANO","PIECE","PILOT","PITCH",
    "PLACE","PLAIN","PLANE","PLANT","PLATE","PLAZA","POINT","POUND","POWER",
    "PRESS","PRICE","PRIDE","PRIME","PRINT","PRIOR","PRIZE","PROOF","PROUD",
    "PROVE","PUPIL","QUIET","QUITE","RADIO","RAISE","RALLY","RANGE","RAPID",
    "RATIO","REACH","READY","REFER","RIGHT","RIVER","ROBOT","ROUND","ROUTE",
    "ROYAL","RURAL","SALES","SALAD","SCALE","SCENE","SCOPE","SENSE","SERVE",
    "SEVEN","SHALL","SHAPE","SHARE","SHARP","SHEET","SHELF","SHELL","SHIFT",
    "SHINE","SHIRT","SHOCK","SHOOT","SHORT","SHOUT","SHOWN","SIGHT","SINCE",
    "SIXTH","SIXTY","SIZED","SKILL","SLEEP","SLICE","SLIDE","SMALL","SMART",
    "SMELL","SMILE","SMOKE","SOLID","SORRY","SOUND","SOUTH","SPACE","SPARE",
    "SPEAK","SPEED","SPEND","SPENT","SPLIT","SPOKE","SPORT","SPOTS","SPRAY",
    "SQUAD","STACK","STAFF","STAGE","STAKE","STAMP","STAND","STARS","START",
    "STATE","STAYS","STEAM","STEEL","STICK","STILL","STOCK","STONE","STOOD",
    "STORE","STORM","STORY","STRIP","STUCK","STUDY","STUFF","STYLE","SUGAR",
    "SUITE","SWEET","TABLE","TAKEN","TASTE","TAXES","TEACH","TEETH","TELLS",
    "TERMS","TESTS","TEXAS","THANK","THEFT","THEIR","THEME","THERE","THESE",
    "THICK","THING","THINK","THIRD","THOSE","THREE","THREW","THROW","TIGHT",
    "TIMES","TITLE","TODAY","TOKEN","TOTAL","TOUCH","TOUGH","TOWER","TRACK",
    "TRADE","TRAIL","TRAIN","TRAIT","TRASH","TREAT","TREND","TRIAL","TRIED",
    "TRIES","TROUT","TRUCK","TRULY","TRUNK","TRUST","TRUTH","TWICE","UNDER",
    "UNION","UNITY","UNTIL","UPPER","URBAN","USAGE","USUAL","VALID","VALUE",
    "VIDEO","VIRUS","VITAL","VIVID","VOCAL","VOICE","WAGON","WAIST","WASTE",
    "WATCH","WATER","WHEEL","WHERE","WHICH","WHILE","WHITE","WHOLE","WHOSE",
    "WOMAN","WOMEN","WORLD","WORRY","WORSE","WORST","WORTH","WOULD","WOUND",
    "WRITE","WRONG","WROTE","YIELD","YOUNG","YOUTH","ZEBRA","ALIKE","ALONE",
]))
GENERAL_5 = [w for w in GENERAL_5 if len(w) == 5]

# ─── CATEGORY WORD LISTS  (for ACROSS slots) ─────────────────────────────────
# Lengths 3, 5, 9 match the across slot sizes in the template.

CATEGORY_WORDS = {

    "business": {
        3: ["CEO","ROI","TAX","BID","NET","IPO","CFO","COO","OTC","GMB","VAT"],
        5: ["BRAND","STOCK","TRADE","AUDIT","PITCH","SHARE","YIELD","FUNDS",
            "HEDGE","NICHE","QUOTA","ASSET","DEBIT","GRANT","LEASE","ANGEL",
            "BONDS","COSTS","GROSS","DRAFT","VALUE","PRICE","SALES","RATES",
            "OFFER","DEALS","LOANS","DEBTS","GAINS","RISKS","TASKS","COSTS"],
        9: ["MARKETING","CORPORATE","INVESTORS","FINANCIAL","STRATEGIC",
            "CUSTOMERS","QUARTERLY","DIVIDENDS","EMPLOYEES","WHOLESALE",
            "CONSUMERS","ANALYTICS","INVENTORY","LOGISTICS","FRANCHISE",
            "INSURANCE","PORTFOLIO","RECESSION","EXPANSION","CONTRACTS",
            "WORKFORCE","BUDGETING","ACQUIRING","EXPORTING","IMPORTING"],
    },

    "popculture": {
        3: ["POP","HIT","FAN","GIG","MOB","VIP","DJS","EMO","RAP","RNB","EDM"],
        5: ["VIRAL","MEMES","TREND","SQUAD","ALBUM","CHART","MUSIC","DANCE",
            "BEATS","REMIX","STAGE","MEDIA","STYLE","BINGE","GENRE","STANS",
            "TOURS","HYPES","ICONS","WAVES","REELS","CLIPS","FILMS","SHOWS"],
        9: ["CELEBRITY","STREAMING","INFLUENCE","FOLLOWING","SUBSCRIBE",
            "THUMBNAIL","BILLBOARD","ALGORITHM","FRANCHISE","BROADCAST",
            "ANIMATION","COMMUNITY","PRODUCERS","DIRECTORS","AUDIENCES"],
    },

    "food": {
        3: ["OIL","SOY","RYE","YAM","JAM","DIP","RIB","FIG","OAT","NUT","GEL"],
        5: ["BROTH","FLOUR","GRAIN","HERBS","SPICE","YEAST","GLAZE","MINCE",
            "ROAST","CREAM","CRISP","LEEKS","OLIVE","PASTA","SAUCE","BASTE",
            "DOUGH","FUDGE","GRAVY","HONEY","MAPLE","SALSA","SYRUP","WHEAT",
            "BAGEL","CREPE","GUAVA","MANGO","PEACH","PLUMS","PRAWN","SQUID"],
        9: ["SEASONING","MARINATED","APPETIZER","CHOCOLATE","FERMENTED",
            "MUSHROOMS","SIMMERING","BARBECUED","DELICIOUS","SUCCULENT",
            "BUTTERING","GARNISHED","NOURISHED","FLAVORING","FRICASSEE"],
    },

    "wellness": {
        3: ["GYM","SPA","ZEN","DNA","TAO","ATP","REM","ABS","OAT","SOY","YIN"],
        5: ["DETOX","FIBER","LYMPH","NERVE","SWEAT","TONIC","VEGAN","PULSE",
            "JOINT","OMEGA","SPINE","SLEEP","CELLS","FOCUS","LIVER","HERBS",
            "SALTS","COLON","SUGAR","FASTS","BLOAT","BONES","BRAIN","HEART",
            "LUNGS","RENAL","TEETH","VEINS","WATER","WHOLE"],
        9: ["NUTRITION","BREATHING","SEROTONIN","MELATONIN","ENDORPHIN",
            "PROBIOTIC","METABOLIC","COGNITIVE","EXERCISES","WELLBEING",
            "ANTIDOTES","BIOMETRIC","KETOGENIC","ANTITOXIN","MEDICALLY"],
    },

    "nerds": {
        3: ["CPU","USB","API","RAM","SQL","APP","BIT","BUG","CSS","DEV","SDK"],
        5: ["PIXEL","BYTES","CACHE","QUEUE","DEBUG","LOOPS","STACK","NODES",
            "SCOPE","TOKEN","ARRAY","LOGIC","CLASS","ERROR","INDEX","QUERY",
            "SHELL","CLOUD","MACRO","LINUX","PATCH","BUILD","CLONE","MERGE",
            "REPOS","TESTS","TYPES","ASYNC","LISTS","REGEX"],
        9: ["ALGORITHM","RECURSION","INTERFACE","FRAMEWORK","BANDWIDTH",
            "EXCEPTION","SINGLETON","PROTOTYPE","LIBRARIES","LOCALHOST",
            "ITERATION","RENDERING","VARIABLES","FUNCTIONS","SCRIPTING",
            "TEMPLATES","DEBUGGING","STREAMING","RECURSIVE","BYTECODES"],
    },
}


# ─── CSP SOLVER ───────────────────────────────────────────────────────────────

class CrosswordSolver:
    def __init__(self, category: str, seed: int = None):
        self.category = category
        if seed is not None:
            random.seed(seed)

        cat = CATEGORY_WORDS.get(category, {})

        # Build word pools per length.
        # Category words go FIRST so the solver prefers themed answers.
        self.pool = defaultdict(list)
        use_simple = (ROWS == 5 and COLS == 5)
        for length, words in cat.items():
            for w in words:
                if len(w) == length and w not in self.pool[length]:
                    self.pool[length].append(w.upper())
        if use_simple:
            # 5x5: only need 5-letter words; pool from category + general
            for w in cat.get(5, []):
                if len(w) == 5 and w.upper() not in self.pool[5]:
                    self.pool[5].append(w.upper())
            for w in GENERAL_5:
                if w not in self.pool[5]:
                    self.pool[5].append(w.upper())
        else:
            for w in GENERAL_9:
                if w not in self.pool[9]:
                    self.pool[9].append(w.upper())

        # Shuffle each pool for variety across restarts
        for length in self.pool:
            random.shuffle(self.pool[length])

        # Discover all word slots
        self.slots = []          # list of (direction, row, col, length)
        self.slot_across = []    # True if slot is an across word
        self._find_slots()

        # Map each grid cell to the slots it belongs to
        self.cell_map = defaultdict(list)   # (r,c) → [(slot_idx, pos)]
        self._build_cell_map()

        self.solution = {}       # slot_idx → word string

    # ------------------------------------------------------------------
    def _find_slots(self):
        T = TEMPLATE
        # ACROSS
        for r in range(ROWS):
            c = 0
            while c < COLS:
                if T[r][c]:
                    start = c
                    while c < COLS and T[r][c]:
                        c += 1
                    if c - start >= 3:
                        self.slots.append(('across', r, start, c - start))
                        self.slot_across.append(True)
                else:
                    c += 1
        # DOWN
        for c in range(COLS):
            r = 0
            while r < ROWS:
                if T[r][c]:
                    start = r
                    while r < ROWS and T[r][c]:
                        r += 1
                    if r - start >= 3:
                        self.slots.append(('down', start, c, r - start))
                        self.slot_across.append(False)
                else:
                    r += 1

    def _build_cell_map(self):
        for i, (direction, r, c, length) in enumerate(self.slots):
            for pos in range(length):
                cell = (r, c + pos) if direction == 'across' else (r + pos, c)
                self.cell_map[cell].append((i, pos))

    # ------------------------------------------------------------------
    def _pattern(self, slot_idx):
        """Return known letters from already-placed intersecting words."""
        direction, r, c, length = self.slots[slot_idx]
        pat = [None] * length
        for pos in range(length):
            cell = (r, c + pos) if direction == 'across' else (r + pos, c)
            for other_idx, other_pos in self.cell_map[cell]:
                if other_idx in self.solution:
                    pat[pos] = self.solution[other_idx][other_pos]
                    break
        return pat

    def _domain(self, slot_idx):
        """All valid unused words for this slot given current state."""
        _, _, _, length = self.slots[slot_idx]
        pat = self._pattern(slot_idx)
        used = set(self.solution.values())
        valid = []
        for word in self.pool.get(length, []):
            if word in used:
                continue
            if len(word) != length:
                continue
            if all(pat[i] is None or pat[i] == word[i] for i in range(length)):
                valid.append(word)
        return valid

    # ------------------------------------------------------------------
    def solve(self, timeout=TIMEOUT):
        """
        MRV backtracking solver.
        Returns True if a complete valid solution is found within timeout.
        """
        deadline = time.time() + timeout

        def backtrack():
            if time.time() > deadline:
                return False
            unassigned = [i for i in range(len(self.slots))
                          if i not in self.solution]
            if not unassigned:
                return True

            # Build domains; fail fast if any slot has no options
            domains = {}
            for i in unassigned:
                d = self._domain(i)
                if not d:
                    return False
                domains[i] = d

            # MRV: pick the slot with the fewest valid words
            slot_idx = min(unassigned, key=lambda i: len(domains[i]))

            # Least-constraining value: try words in randomised domain order
            for word in domains[slot_idx]:
                self.solution[slot_idx] = word
                if backtrack():
                    return True
                del self.solution[slot_idx]

            return False

        return backtrack()

    # ------------------------------------------------------------------
    def get_grid(self):
        """Return filled grid as 2-D list (None = black cell)."""
        grid = [[None] * COLS for _ in range(ROWS)]
        for i, (direction, r, c, length) in enumerate(self.slots):
            word = self.solution.get(i, '')
            for pos, letter in enumerate(word):
                if direction == 'across':
                    grid[r][c + pos] = letter
                else:
                    grid[r + pos][c] = letter
        return grid

    # ------------------------------------------------------------------
    def _number_grid(self):
        """Assign consecutive numbers to cells that start a word."""
        T = TEMPLATE
        numbered = {}
        num = 1
        for r in range(ROWS):
            for c in range(COLS):
                if not T[r][c]:
                    continue
                starts_across = (c == 0 or not T[r][c - 1]) and \
                                 (c + 1 < COLS and T[r][c + 1])
                starts_down   = (r == 0 or not T[r - 1][c]) and \
                                 (r + 1 < ROWS and T[r + 1][c])
                if starts_across or starts_down:
                    numbered[(r, c)] = num
                    num += 1
        return numbered

    # ------------------------------------------------------------------
    def print_result(self):
        if not self.solution:
            print("No solution found.")
            return

        grid = self.get_grid()
        numbered = self._number_grid()

        # Collect slot summaries
        across_entries = []
        down_entries   = []
        for i, (direction, r, c, length) in enumerate(self.slots):
            word = self.solution.get(i, '???')
            n    = numbered.get((r, c), 0)
            entry = dict(n=n, r=r, c=c, len=length, word=word)
            if direction == 'across':
                across_entries.append(entry)
            else:
                down_entries.append(entry)

        across_entries.sort(key=lambda x: x['n'])
        down_entries.sort(key=lambda x: x['n'])

        # ── Visual grid ──────────────────────────────────────────────────
        print(f"\n{'='*64}")
        print(f"  CATEGORY: {self.category.upper()}")
        print(f"{'='*64}")
        print()
        print("GRID:")
        for r, row in enumerate(grid):
            line = []
            for c, cell in enumerate(row):
                n = numbered.get((r, c))
                if cell is None:
                    line.append("##")
                elif n:
                    line.append(f"{n:>2}")
                else:
                    line.append(f" {cell}")
            print("  " + "  ".join(line))

        print()
        print("ACROSS WORDS (write clues for these):")
        for e in across_entries:
            print(f"  {e['n']:2}. {e['word']:12}  r={e['r']} c={e['c']} len={e['len']}")

        print()
        print("DOWN WORDS (write clues for these):")
        for e in down_entries:
            print(f"  {e['n']:2}. {e['word']:12}  r={e['r']} c={e['c']} len={e['len']}")

        # ── puzzles.js format ─────────────────────────────────────────────
        print()
        print("-" * 64)
        print("PASTE THIS INTO puzzles.js  (fill in [CLUE] and [TRIVIA]):")
        print("-" * 64)
        print(f"  {self.category}: {{")
        print("    grid: [")
        for row in grid:
            cells = ", ".join(f'"{c}"' if c else "null" for c in row)
            print(f"      [{cells}],")
        print("    ],")
        print("    clues: {")
        print("      across: [")
        for e in across_entries:
            print(f"        {{ n: {e['n']},  r: {e['r']},  c: {e['c']},  len: {e['len']},")
            print(f"          clue: \"[CLUE FOR {e['word']}]\",")
            print(f"          trivia: \"[TRIVIA FOR {e['word']}]\" }},")
        print("      ],")
        print("      down: [")
        for e in down_entries:
            print(f"        {{ n: {e['n']},  r: {e['r']},  c: {e['c']},  len: {e['len']},")
            print(f"          clue: \"[CLUE FOR {e['word']}]\",")
            print(f"          trivia: \"[TRIVIA FOR {e['word']}]\" }},")
        print("      ],")
        print("    },")
        print("  },")


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    category = sys.argv[1].lower() if len(sys.argv) > 1 else "business"

    if category not in CATEGORY_WORDS:
        print(f"Unknown category '{category}'.")
        print(f"Available: {', '.join(CATEGORY_WORDS.keys())}")
        sys.exit(1)

    print(f"Generating '{category}' crossword using CSP solver...")
    tmpl = "5x5 | 3 across + 3 down" if (ROWS == 5) else "9x9 | 9 across + 5 down"
    print(f"(Template: {tmpl})")
    print()

    for attempt in range(1, MAX_ATTEMPTS + 1):
        seed = random.randint(0, 10_000_000)
        print(f"  Attempt {attempt:3d} (seed={seed}) ...", end=" ", flush=True)

        solver = CrosswordSolver(category, seed=seed)
        success = solver.solve(timeout=TIMEOUT)

        if success:
            print(f"SOLVED in {attempt} attempt(s)!")
            solver.print_result()
            return
        else:
            print("timeout — restarting with new seed")

    print(f"\nCould not solve after {MAX_ATTEMPTS} attempts.")
    print("Consider expanding the word lists for this category.")
    sys.exit(1)


if __name__ == "__main__":
    main()
