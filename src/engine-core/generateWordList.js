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
