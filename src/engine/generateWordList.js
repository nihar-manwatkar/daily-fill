/**
 * Uses the Claude API to generate a fresh set of word-clue pairs each day.
 * Falls back to a seeded static list when ANTHROPIC_API_KEY is not set (e.g. local dev).
 *
 * Run via generateDaily.js — do not run this file directly.
 */

// ── DOMAIN POOL ───────────────────────────────────────────────────────────────
const DOMAINS = [
  "astronomy", "marine biology", "geology", "botany", "human anatomy",
  "chemistry", "physics", "ecology", "genetics", "oceanography",
  "world rivers", "mountain ranges", "capital cities", "bodies of water",
  "ancient civilisations", "world wars", "medieval Europe", "ancient Rome",
  "classical music", "world literature", "architecture styles", "mythology",
  "Greek mythology", "Hindu mythology", "folklore",
  "words of Sanskrit origin", "portmanteau words", "collective nouns",
  "cooking techniques", "spices and herbs", "tools and instruments",
  "sports and games", "traditional Indian crafts", "festivals of the world",
  "psychology terms", "philosophy concepts", "environmental science",
  "economics", "space exploration", "medicine and health", "mathematics",
  "Indian geography", "Indian history", "Indian cuisine", "Indian architecture",
]

const DIFFICULTY_STYLES = [
  "Use straightforward definitions suitable for a general audience.",
  "Use mild misdirection — clues should have one surface reading and a crossword reading.",
  "Mix straightforward and tricky clues. About half should have a twist or double meaning.",
  "Write clues in the style of a cryptic crossword — indirect, with surface readings that mislead.",
]

// ── FALLBACK: seeded static word list when API key not set ─────────────────────
const FALLBACK_WORDS = [
  { word: "ALBUM", clue: "Music collection or photo holder" },
  { word: "ATLAS", clue: "Book of maps" },
  { word: "BREAD", clue: "Baked staple food" },
  { word: "CLOVE", clue: "Aromatic spice from buds" },
  { word: "DELTA", clue: "River mouth landform" },
  { word: "EMBER", clue: "Glowing coal in dying fire" },
  { word: "FJORD", clue: "Narrow coastal inlet" },
  { word: "GLOBE", clue: "Sphere representing Earth" },
  { word: "HELIX", clue: "Spiral shape like DNA" },
  { word: "IVORY", clue: "Material from elephant tusks" },
  { word: "JUMBO", clue: "Extra large" },
  { word: "KARMA", clue: "Cause and effect in Eastern philosophy" },
  { word: "LEMON", clue: "Sour citrus fruit" },
  { word: "MANGO", clue: "Tropical stone fruit" },
  { word: "NEPAL", clue: "Himalayan nation" },
  { word: "OCEAN", clue: "Vast body of salt water" },
  { word: "PILOT", clue: "Aircraft operator" },
  { word: "QUEST", clue: "Search or journey" },
  { word: "RIVET", clue: "Metal fastener" },
  { word: "STORM", clue: "Violent weather event" },
  { word: "TORCH", clue: "Portable light source" },
  { word: "UMBRA", clue: "Shadow of an eclipse" },
  { word: "VENOM", clue: "Toxic secretion" },
  { word: "WALTZ", clue: "Ballroom dance in triple time" },
  { word: "XENON", clue: "Noble gas used in lights" },
  { word: "YIELD", clue: "Produce or give way" },
  { word: "ZEBRA", clue: "Striped African equine" },
  { word: "ALBINO", clue: "Lacking pigment" },
  { word: "BROKEN", clue: "No longer whole" },
  { word: "CRYPTO", clue: "Prefix for hidden or coded" },
  { word: "DIVERS", clue: "Underwater explorers" },
  { word: "EMPIRE", clue: "Vast territorial domain" },
  { word: "FLUTED", clue: "Having vertical grooves" },
  { word: "GRAVEL", clue: "Small stones for paths" },
  { word: "HERBAL", clue: "Made from plants" },
  { word: "ISLAND", clue: "Land surrounded by water" },
  { word: "JUNGLE", clue: "Dense tropical forest" },
  // Extended pool for 6-puzzle bank (minimal word overlap)
  { word: "ANCHOR", clue: "Secures a vessel" },
  { word: "BREEZE", clue: "Light wind" },
  { word: "CANYON", clue: "Deep narrow gorge" },
  { word: "DONKEY", clue: "Beast of burden" },
  { word: "ELEVEN", clue: "Number after ten" },
  { word: "FLIGHT", clue: "Journey by air" },
  { word: "GARLIC", clue: "Pungent bulb" },
  { word: "HONEST", clue: "Truthful" },
  { word: "INDOOR", clue: "Inside a building" },
  { word: "JACKET", clue: "Outer garment" },
  { word: "KETTLE", clue: "Boils water" },
  { word: "LAPTOP", clue: "Portable computer" },
  { word: "MIRROR", clue: "Reflective surface" },
  { word: "NESTLE", clue: "Settle snugly" },
  { word: "OUTPUT", clue: "Result produced" },
  { word: "PARROT", clue: "Imitative bird" },
  { word: "QUIVER", clue: "Tremble or shake" },
  { word: "RAPIDS", clue: "Fast-flowing water" },
  { word: "SANDAL", clue: "Open-toed footwear" },
  { word: "TEMPLE", clue: "Place of worship" },
  { word: "UNLOAD", clue: "Remove cargo" },
  { word: "VELVET", clue: "Soft fabric" },
  { word: "WIZARD", clue: "Magical practitioner" },
  { word: "YOGURT", clue: "Fermented milk" },
  { word: "ZODIAC", clue: "Celestial band" },
  { word: "ACRID", clue: "Sharp or bitter" },
  { word: "BLOAT", clue: "Swell or puff" },
  { word: "CRANE", clue: "Tall lifting machine" },
  { word: "DUVET", clue: "Soft bedding" },
  { word: "ELBOW", clue: "Joint in arm" },
  { word: "FAUNA", clue: "Animal life" },
  { word: "GLAND", clue: "Secretory organ" },
  { word: "HOBBY", clue: "Leisure pursuit" },
  { word: "IVORY", clue: "Elephant tusk material" },
  { word: "JEWEL", clue: "Precious stone" },
  { word: "KINKY", clue: "Curly or twisted" },
  { word: "LILAC", clue: "Pale purple flower" },
  { word: "MAGMA", clue: "Molten rock" },
  { word: "NOBLE", clue: "Of high rank" },
  { word: "OLIVE", clue: "Mediterranean fruit" },
  { word: "PRISM", clue: "Light-splitting shape" },
  { word: "QUOTA", clue: "Allocated share" },
  { word: "REBEL", clue: "Resist authority" },
  { word: "SALTY", clue: "Tasting of salt" },
  { word: "TREND", clue: "General direction" },
  { word: "URBAN", clue: "City-based" },
  { word: "VOCAL", clue: "Relating to voice" },
  { word: "WOMAN", clue: "Adult female" },
  { word: "XERIC", clue: "Dry environment" },
  { word: "YACHT", clue: "Sailboat" },
  { word: "ZESTY", clue: "Full of flavor" },
  { word: "APTLY", clue: "Suitably" },
  { word: "BURLY", clue: "Sturdy and strong" },
  { word: "CURVY", clue: "Having curves" },
  { word: "DIMLY", clue: "Faintly lit" },
  { word: "EQUAL", clue: "Same in value" },
  { word: "FROST", clue: "Frozen dew" },
  { word: "GRUNT", clue: "Low sound" },
  { word: "HASTY", clue: "Done quickly" },
  { word: "INFER", clue: "Conclude" },
  { word: "JADED", clue: "Tired or bored" },
  { word: "KNEAD", clue: "Work dough" },
  { word: "LOOPY", clue: "Eccentric" },
  { word: "MANOR", clue: "Estate" },
  { word: "NIGHT", clue: "Dark hours" },
  { word: "OPTIC", clue: "Relating to sight" },
  { word: "PIANO", clue: "Keyboard instrument" },
  { word: "QUAIL", clue: "Small game bird" },
  { word: "RUSTY", clue: "Corroded" },
  { word: "SLANT", clue: "Oblique angle" },
  { word: "TRUCE", clue: "Ceasefire" },
  { word: "UNCLE", clue: "Parent's brother" },
  { word: "VISTA", clue: "Scenic view" },
  { word: "WORST", clue: "Most bad" },
  // 7–8 letter for template engine (30–40% black)
  { word: "ANCHORS", clue: "Secures vessels" },
  { word: "EMPIRES", clue: "Vast domains" },
  { word: "FORTUNE", clue: "Luck or wealth" },
  { word: "HONESTY", clue: "Truthfulness" },
  { word: "JACKETS", clue: "Outer garments" },
  { word: "ALBUMEN", clue: "Egg white" },
  { word: "BREEZES", clue: "Light winds" },
  { word: "COUNTRY", clue: "Nation or rural area" },
  { word: "DWELLER", clue: "Resident" },
  { word: "FLAVOUR", clue: "Taste" },
  { word: "ADJACENT", clue: "Next to" },
  { word: "BROADWAY", clue: "Famous NYC street" },
  { word: "CHILDREN", clue: "Young ones" },
  // Extended pool for 30-puzzle bank (minimal word reuse)
  { word: "ABOUT", clue: "Approximately" },
  { word: "ABOVE", clue: "Overhead" },
  { word: "ACTOR", clue: "Stage performer" },
  { word: "ADMIT", clue: "Confess" },
  { word: "ADOPT", clue: "Take on" },
  { word: "AFTER", clue: "Following" },
  { word: "AGENT", clue: "Representative" },
  { word: "ALARM", clue: "Warning signal" },
  { word: "ALIKE", clue: "Similar" },
  { word: "ALLOW", clue: "Permit" },
  { word: "ALONE", clue: "Solo" },
  { word: "ALONG", clue: "Accompanying" },
  { word: "ALPHA", clue: "First letter" },
  { word: "ALTER", clue: "Modify" },
  { word: "AMBER", clue: "Fossil resin" },
  { word: "ANGEL", clue: "Divine messenger" },
  { word: "ANGER", clue: "Rage" },
  { word: "ANGLE", clue: "Corner" },
  { word: "APRON", clue: "Protective garment" },
  { word: "ARENA", clue: "Stadium" },
  { word: "ARISE", clue: "Get up" },
  { word: "ARROW", clue: "Bow projectile" },
  { word: "ASIDE", clue: "Apart" },
  { word: "ASSET", clue: "Valuable item" },
  { word: "ATOMS", clue: "Tiny particles" },
  { word: "AUDIO", clue: "Sound" },
  { word: "AUDIT", clue: "Financial review" },
  { word: "AUTUMN", clue: "Fall season" },
  { word: "AVERT", clue: "Prevent" },
  { word: "AWARD", clue: "Prize" },
  { word: "BASED", clue: "Founded on" },
  { word: "BASIN", clue: "Bowl" },
  { word: "BATCH", clue: "Group" },
  { word: "BEACH", clue: "Seaside" },
  { word: "BEAST", clue: "Animal" },
  { word: "BENCH", clue: "Seat" },
  { word: "BERRY", clue: "Small fruit" },
  { word: "BILLY", clue: "Male goat" },
  { word: "BLANK", clue: "Empty" },
  { word: "BLAZE", clue: "Fire" },
  { word: "BLESS", clue: "Consecrate" },
  { word: "BLOCK", clue: "Obstruct" },
  { word: "BLOOM", clue: "Flower" },
  { word: "BOAST", clue: "Brag" },
  { word: "BONDS", clue: "Connections" },
  { word: "BONUS", clue: "Extra reward" },
  { word: "BOOTH", clue: "Stall" },
  { word: "BOUND", clue: "Limit" },
  { word: "BRAND", clue: "Make" },
  { word: "BRASS", clue: "Copper alloy" },
  { word: "BRAVE", clue: "Courageous" },
  { word: "BREAK", clue: "Shatter" },
  { word: "BRICK", clue: "Building block" },
  { word: "BRIDE", clue: "Wedding woman" },
  { word: "BRIEF", clue: "Short" },
  { word: "BRING", clue: "Fetch" },
  { word: "BROAD", clue: "Wide" },
  { word: "BROKE", clue: "Penniless" },
  { word: "BROWN", clue: "Colour" },
  { word: "BRUSH", clue: "Paint tool" },
  { word: "BUILD", clue: "Construct" },
  { word: "BUNCH", clue: "Cluster" },
  { word: "BURST", clue: "Explode" },
  { word: "CABIN", clue: "Wooden hut" },
  { word: "CABLE", clue: "Wire" },
  { word: "CALMS", clue: "Soothes" },
  { word: "CAMEL", clue: "Desert animal" },
  { word: "CAMEO", clue: "Brief appearance" },
  { word: "CANAL", clue: "Waterway" },
  { word: "CANOE", clue: "Paddled boat" },
  { word: "CAPER", clue: "Prank" },
  { word: "CARGO", clue: "Freight" },
  { word: "CARVE", clue: "Cut" },
  { word: "CATCH", clue: "Capture" },
  { word: "CAUSE", clue: "Reason" },
  { word: "CEDAR", clue: "Conifer" },
  { word: "CHAIN", clue: "Link" },
  { word: "CHAIR", clue: "Seat" },
  { word: "CHAOS", clue: "Disorder" },
  { word: "CHARM", clue: "Attract" },
  { word: "CHART", clue: "Diagram" },
  { word: "CHASE", clue: "Pursue" },
  { word: "CHEAP", clue: "Inexpensive" },
  { word: "CHECK", clue: "Verify" },
  { word: "CHEEK", clue: "Face part" },
  { word: "CHEER", clue: "Applaud" },
  { word: "CHESS", clue: "Board game" },
  { word: "CHEST", clue: "Trunk" },
  { word: "CHIEF", clue: "Leader" },
  { word: "CHILD", clue: "Young person" },
  { word: "CHIME", clue: "Bell" },
  { word: "CHIPS", clue: "Fries" },
  { word: "CHORD", clue: "Music notes" },
  { word: "CHUNK", clue: "Piece" },
  { word: "CIVIL", clue: "Polite" },
  { word: "CLAIM", clue: "Assert" },
  { word: "CLAMP", clue: "Grip" },
  { word: "CLASH", clue: "Conflict" },
  { word: "CLASS", clue: "Category" },
  { word: "CLEAN", clue: "Spotless" },
  { word: "CLEAR", clue: "Obvious" },
  { word: "CLERK", clue: "Assistant" },
  { word: "CLICK", clue: "Mouse action" },
  { word: "CLIMB", clue: "Ascend" },
  { word: "CLING", clue: "Stick" },
  { word: "CLOCK", clue: "Timepiece" },
  { word: "CLOSE", clue: "Shut" },
  { word: "CLOTH", clue: "Fabric" },
  { word: "CLOUD", clue: "Sky vapour" },
  { word: "CLOWN", clue: "Comic performer" },
  { word: "COACH", clue: "Trainer" },
  { word: "COAST", clue: "Seashore" },
  { word: "COCOA", clue: "Chocolate powder" },
  { word: "COFFEE", clue: "Beverage" },
  { word: "COILS", clue: "Spirals" },
  { word: "COINS", clue: "Money" },
  { word: "COLON", clue: "Punctuation" },
  // 4-letter words for dense templates (MIN_SLOT_LEN=4)
  { word: "ABLE", clue: "Capable" },
  { word: "ACRE", clue: "Land measure" },
  { word: "ACTS", clue: "Deeds" },
  { word: "AGED", clue: "Old" },
  { word: "AIDS", clue: "Assists" },
  { word: "AIMS", clue: "Targets" },
  { word: "ALOE", clue: "Succulent plant" },
  { word: "ALSO", clue: "Additionally" },
  { word: "ALTO", clue: "Voice range" },
  { word: "ARTS", clue: "Creativity" },
  { word: "ARIA", clue: "Opera solo" },
  { word: "ASIA", clue: "Continent" },
  { word: "ATOM", clue: "Tiny particle" },
  { word: "AWAY", clue: "Absent" },
  { word: "AXLE", clue: "Wheel shaft" },
  { word: "BAKE", clue: "Cook in oven" },
  { word: "BALL", clue: "Sphere" },
  { word: "BAND", clue: "Group" },
  { word: "BANK", clue: "Financial institution" },
  { word: "BARE", clue: "Naked" },
  { word: "BARN", clue: "Farm building" },
  { word: "BASE", clue: "Foundation" },
  { word: "BEAR", clue: "Animal" },
  { word: "BEAT", clue: "Defeat" },
  { word: "BEEN", clue: "Past participle" },
  { word: "BEER", clue: "Beverage" },
  { word: "BEET", clue: "Root vegetable" },
  { word: "BELL", clue: "Chimes" },
  { word: "BELT", clue: "Waist band" },
  { word: "BEND", clue: "Curve" },
  { word: "BEST", clue: "Finest" },
  { word: "BIAS", clue: "Prejudice" },
  { word: "BIDS", clue: "Offers" },
  { word: "BIKE", clue: "Bicycle" },
  { word: "BILL", clue: "Invoice" },
  { word: "BIND", clue: "Tie" },
  { word: "BIRD", clue: "Feathered creature" },
  { word: "BITE", clue: "Nip" },
  { word: "BLED", clue: "Lost blood" },
  { word: "BLEW", clue: "Past of blow" },
  { word: "BLOW", clue: "Wind gust" },
  { word: "BLUE", clue: "Colour" },
  { word: "BLUR", clue: "Haze" },
  { word: "BOAR", clue: "Wild pig" },
  { word: "BOAT", clue: "Vessel" },
  { word: "BODY", clue: "Physique" },
  { word: "BOLT", clue: "Lightning" },
  { word: "BOMB", clue: "Explosive" },
  { word: "BOND", clue: "Connection" },
  { word: "BONE", clue: "Skeleton part" },
]

function seededShuffle(arr, seed) {
  const rng = seededRng(seed)
  return arr.slice().sort(() => rng() - 0.5)
}

function seededRng(seed) {
  let s = seed
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

export async function generateWordList(seed, options = {}) {
  const excludeWords = options.excludeWords || new Set()
  if (!process.env.ANTHROPIC_API_KEY) {
    const available = FALLBACK_WORDS.filter(w => !excludeWords.has(w.word.toUpperCase()))
    const shuffled = seededShuffle(available, seed)
    const chosen = shuffled.slice(0, 40)
    if (chosen.length < 25) {
      console.warn(`  Warning: only ${chosen.length} words available after excluding ${excludeWords.size} used words`)
    }
    console.log(`  (No ANTHROPIC_API_KEY — using ${chosen.length} seeded fallback words)`)
    return chosen.map(({ word, clue }) => ({ word: word.toUpperCase(), clue }))
  }

  const rng = seededRng(seed)
  const shuffled = DOMAINS.slice().sort(() => rng() - 0.5)
  const chosen = shuffled.slice(0, 3 + Math.floor(rng() * 2))
  const style = DIFFICULTY_STYLES[Math.floor(rng() * DIFFICULTY_STYLES.length)]
  const prompt = buildPrompt(chosen, style)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  const text = data.content[0].text
  const words = parseWordList(text)

  if (words.length < 12) {
    throw new Error(`Claude only returned ${words.length} valid words — need at least 12`)
  }

  console.log(`  Domains today: ${chosen.join(', ')}`)
  console.log(`  Generated ${words.length} word-clue pairs`)
  return words
}

function buildPrompt(domains, style) {
  return `You are a crossword puzzle editor for a daily English-language crossword played by educated adults across the Indian subcontinent. Today's puzzle will draw from these domains: ${domains.join(', ')}.

Generate exactly 40 word-clue pairs for a classic crossword puzzle.

STRICT RULES — follow every one without exception:
1. Each word must be between 5 and 13 letters. No shorter, no longer.
2. Letters only — no hyphens, spaces, apostrophes, or numbers in the word itself.
3. No proper nouns (no names of people, countries, cities, brands).
   Exception: well-known single-word concepts that have entered common usage are fine (e.g. KAFKAESQUE, MACHIAVELLIAN, BYZANTINE).
4. The clue must not contain the answer word or a direct synonym used as the entire clue.
5. ${style}
6. Words must span all ${domains.length} domains — do not cluster everything into one topic.
7. Vary word length: include a mix of 5-letter, 6-letter, 7-letter, 8-letter, 9-letter, and longer words.
8. Do not repeat any word.

Output format — return ONLY a JSON array, nothing else before or after it:
[
  { "word": "ALGORITHM", "clue": "Step-by-step procedure for solving a problem" },
  { "word": "MONSOON", "clue": "Seasonal wind system that drenches South Asia each year" }
]

Generate 40 pairs now.`
}

/** Layout engine: Full 4–8 letter pool for layout/CORE3. Excludes words from prior puzzles. */
export function getLayoutWordPool(excludeWords = new Set()) {
  const filtered = FALLBACK_WORDS.filter(w => {
    const len = String(w.word).length
    if (len < 4 || len > 8) return false
    if (excludeWords.has(String(w.word).toUpperCase())) return false
    return true
  })
  return filtered.map(({ word, clue }) => ({ word: word.toUpperCase(), clue }))
}

/** CORE Version 2: Full 5–6 letter pool for template solver. Excludes words from prior puzzles. */
export function getTemplateWordPool(excludeWords = new Set()) {
  const filtered = FALLBACK_WORDS.filter(w => {
    const len = String(w.word).length
    if (len < 5 || len > 6) return false
    if (excludeWords.has(String(w.word).toUpperCase())) return false
    return true
  })
  return filtered.map(({ word, clue }) => ({ word: word.toUpperCase(), clue }))
}

function parseWordList(text) {
  const clean = text.replace(/```json|```/g, '').trim()
  let raw
  try {
    raw = JSON.parse(clean)
  } catch {
    const match = clean.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Could not parse word list from Claude response')
    raw = JSON.parse(match[0])
  }
  return raw
    .filter(entry =>
      typeof entry.word === 'string' &&
      typeof entry.clue === 'string' &&
      /^[A-Za-z]{5,13}$/.test(entry.word.trim())
    )
    .map(entry => ({
      word: entry.word.toUpperCase().trim(),
      clue: entry.clue.trim(),
    }))
    .filter((entry, idx, arr) => arr.findIndex(e => e.word === entry.word) === idx)
}
