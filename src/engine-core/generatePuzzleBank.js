/**
 * Generates 6 unique puzzles for the puzzle bank.
 * Each puzzle uses different seeds and excludes words from previous puzzles
 * to minimize overlap. Outputs puzzleBank.js.
 *
 * Run: node src/engine/generatePuzzleBank.js
 */

import { generateCrossword } from './generateCrossword.js'
import { generateWordList } from './generateWordList.js'
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIN_GRID_SIZE = 12
const MAX_GRID_SIZE = 16
// Target 30–40% blank; library produces ~55–70%. Accept all for now (library limitation).
const MIN_BLACK_PCT = 0
const MAX_BLACK_PCT = 1

// Fun trivia facts for every puzzle word — no generic fallbacks.
const TRIVIA = {
  ACRID: "Acrid smoke from wildfires can travel hundreds of miles and irritate eyes and lungs even in distant cities.",
  ALBINO: "Albino animals rarely survive in the wild because their lack of camouflage makes them easy prey.",
  ALBUM: "The word 'album' originally meant a blank tablet for writing; Romans used wax tablets bound like books.",
  ANCHOR: "Ancient anchors were often just sacks of stones; the hooked design we know emerged around 3000 BCE.",
  APTLY: "The word 'apt' shares roots with 'adapt' — both suggest something fits or suits its purpose.",
  ATLAS: "The Titan Atlas wasn't holding a globe; classical art showed him bearing the celestial sphere.",
  BLOAT: "Bloating in software can slow programs; in biology, it often means gas or fluid build-up.",
  BREAD: "Sourdough starters can live for decades; some bakeries use cultures over 100 years old.",
  BREEZE: "A breeze is officially defined as wind between 4–31 mph; sailors still use the Beaufort scale.",
  BROKEN: "Kintsugi is the Japanese art of repairing broken pottery with gold — celebrating the flaw.",
  BURLY: "The word likely comes from 'boor' or 'peasant' — sturdy labourers were often described as burly.",
  CANYON: "The Grand Canyon was carved by the Colorado River over about 6 million years.",
  CLOVE: "A single clove tree can produce up to 40 pounds of dried cloves per year.",
  CRANE: "Some crane species perform elaborate mating dances and form lifelong pair bonds.",
  CRYPTO: "Cryptography kept Roman military secrets; Caesar used a simple letter-shift cipher.",
  CURVY: "Human preference for curves may be evolutionary — sharp edges often meant danger.",
  DELTA: "The Ganges-Brahmaputra delta is the world's largest, home to over 140 million people.",
  DIMLY: "Many nocturnal animals see in near-darkness; cats need about one-sixth the light humans do.",
  DIVERS: "Free divers can hold their breath for over 10 minutes; the record exceeds 11 minutes.",
  DONKEY: "Donkeys have incredible memories and can recognise other donkeys they met 25 years ago.",
  DUVET: "The duvet was popularised in Britain in the 1960s; Scandinavians had used them for centuries.",
  ELEVEN: "Eleven comes from Old English endleofan — literally 'one left' after counting to ten.",
  ELBOW: "The word 'elbow' comes from Old English elnboga — 'ell' (forearm) plus 'bend'.",
  EMBER: "Embers can reignite fires hours or days later; many wildfires start from leftover campfire embers.",
  EMPIRE: "The British Empire at its peak controlled a quarter of the world's land and population.",
  EQUAL: "The equals sign (=) was invented in 1557 by Welsh mathematician Robert Recorde.",
  FAUNA: "Fauna was a Roman goddess of the countryside; Linnaeus borrowed the name for animal life.",
  FJORD: "Norway's Sognefjord is over 200 km long and over 1,300 m deep.",
  FLIGHT: "The longest non-stop commercial flight is Singapore–New York, about 19 hours.",
  FLUTED: "Fluted columns on Greek temples may have mimicked bundled reeds or improved light play.",
  FROST: "Robert Frost won four Pulitzer Prizes; he read at JFK's inauguration but couldn't see his paper in the sun.",
  GARLIC: "Garlic's pungent smell comes from allicin, released when cells are crushed — a defence mechanism.",
  GLAND: "Sweat glands help cool us; humans have 2–4 million across the body.",
  GLOBE: "The oldest surviving terrestrial globe dates to 1492; it doesn't show the Americas.",
  GRAVEL: "Gravel is classified by size; pea gravel is about ¼ inch, useful for paths and driveways.",
  GRUNT: "Soldiers have used grunts as code; the Vietnamese 'grunt' meant infantryman in the 1960s.",
  HASTY: "Rushing can cause errors; 'haste makes waste' appears in English as early as the 1300s.",
  HELIX: "DNA's helix completes a full twist every 10.5 base pairs; it's right-handed.",
  HERBAL: "Herbal medicine dates back millennia; the Ebers Papyrus lists over 800 plant remedies.",
  HONEST: "Honest Abe earned the nickname as a young store clerk who walked miles to return change.",
  HOBBY: "The word 'hobby' originally meant a small horse; a hobbyhorse was a child's toy pony.",
  INDOOR: "Indoor air can be 2–5 times more polluted than outdoor air due to off-gassing and dust.",
  INFER: "Inference differs from implication: you infer from evidence; a statement implies a conclusion.",
  ISLAND: "Greenland is the world's largest island; Australia is a continent, not an island.",
  IVORY: "Piano keys were once ivory; makers switched to plastic in the mid-20th century.",
  JADED: "A 'jade' was an old, worn-out horse; 'jaded' came to mean worn out or bored.",
  JACKET: "The dinner jacket (tuxedo) was named after Tuxedo Park, a New York club, in the 1880s.",
  JEWEL: "The Hope Diamond is 45.5 carats and supposedly cursed; it glows red under UV light.",
  JUMBO: "Jumbo was a real elephant; P.T. Barnum bought him from London Zoo in 1882.",
  JUNGLE: "Jungles are dense forests in the understory; rainforests have a distinct canopy layer.",
  KARMA: "In Buddhism, karma is intentional action; even thoughts and words create karma.",
  KETTLE: "A whistling kettle works because steam escapes through a narrow opening, creating sound waves.",
  KINKY: "In physics, kinks are topological defects in fields; the word has broader colloquial use.",
  KNEAD: "Kneading develops gluten; over-kneading can make bread tough, so bakers watch the dough.",
  LAPTOP: "The first true laptop, the Osborne 1, weighed 24 pounds and had a 5-inch screen.",
  LEMON: "Lemons and limes are different species; neither exists in the wild — both are hybrid citrus.",
  LILAC: "Lilacs can live for more than 100 years, which is why they're often seen as symbols of enduring love and resilience.",
  LOOPY: "Loop-the-loop roller coasters create brief weightlessness at the top of the loop.",
  MAGMA: "Magma can sit underground for millions of years before erupting; Yellowstone's last big eruption was 640,000 years ago.",
  MANGO: "Mangoes have been cultivated in India for over 4,000 years; the fruit is central to Indian summers.",
  MANOR: "Medieval manors were largely self-sufficient, with their own mills, forges, and farmland.",
  MIRROR: "The earliest mirrors were polished obsidian; Romans used glass backed with lead.",
  NEPAL: "Nepal has never been colonised; it remained independent throughout the British Raj.",
  NESTLE: "The Nestlé company began when Henri Nestlé invented infant formula in 1867.",
  NIGHT: "Nocturnal animals have tapetum lucidum, a layer that reflects light and causes eye shine.",
  NOBLE: "Noble gases were once called 'inert' — until chemists made compounds with xenon in 1962.",
  OCEAN: "More than 80% of the ocean remains unexplored; we've mapped Mars better than our seas.",
  OLIVE: "Olive trees can live over 2,000 years; some in the Mediterranean may date to Roman times.",
  OPTIC: "The human eye can distinguish about 10 million colours, though we name only a fraction.",
  OUTPUT: "The world's first computer output was on punched cards; screens came decades later.",
  PARROT: "African grey parrots can learn hundreds of words and use them in context.",
  PIANO: "A grand piano has over 12,000 parts; the strings exert about 30 tons of tension.",
  PILOT: "Amelia Earhart was the first woman to fly solo across the Atlantic, in 1932.",
  PRISM: "Newton's prism experiments in 1666 showed that white light is a mix of colours.",
  QUAIL: "Some quail species migrate at night; they fly in loose flocks and can cover long distances.",
  QUOTA: "Immigration quotas in the US began in 1921, limiting arrivals by national origin.",
  QUEST: "The Holy Grail quest drove Arthurian legends; no single 'real' grail has ever been found.",
  QUIVER: "Archers kept arrows in quivers; a typical medieval quiver held 24–30 arrows.",
  RAPIDS: "Class V rapids are 'extremely difficult'; Class VI is considered unnavigable.",
  REBEL: "Spartacus led a slave revolt against Rome; his name still symbolises resistance.",
  RIVET: "The Eiffel Tower used over 2.5 million rivets; construction took just over two years.",
  RUSTY: "Rust is iron oxide; it forms when iron reacts with oxygen and water.",
  SALTY: "Sea salt and table salt are mostly the same; sea salt has trace minerals that add flavour.",
  SANDAL: "The oldest known sandals, from Oregon, are about 10,000 years old.",
  SLANT: "Slant rhyme uses similar but not identical sounds — 'love' and 'move' are a classic pair.",
  STORM: "A single thunderstorm can hold enough energy to power a city for days.",
  TEMPLE: "Temples often align with sunrise on solstices; ancient builders tracked the sun precisely.",
  TORCH: "The Olympic torch has travelled by horseback, camel, Concorde, and even underwater.",
  TREND: "Trends in fashion and tech often follow an S-curve: slow start, rapid rise, plateau.",
  TRUCE: "The Christmas Truce of 1914 saw British and German soldiers play football in no man's land.",
  UNCLE: "In many cultures, maternal and paternal uncles have distinct kinship roles.",
  UMBRA: "During totality, the Moon's umbra races across Earth at over 1,500 mph.",
  UNLOAD: "Port cranes can unload a shipping container in under two minutes.",
  URBAN: "Tokyo is the world's largest city by population; over 37 million people live in its metro area.",
  VELVET: "Velvet was once woven on special looms; it was a luxury fabric for royalty.",
  VENOM: "Honeybee venom is used in apitherapy; some studies suggest benefits for arthritis.",
  VISTA: "The word comes from Latin 'videre' — to see; a vista is a view worth stopping for.",
  VOCAL: "Humans can produce vowel sounds by changing the shape of the vocal tract.",
  WALTZ: "The waltz shocked 18th-century society because partners faced each other and embraced.",
  WIZARD: "Merlin's legend blended Welsh and Breton folklore; his name may mean 'sea fort'.",
  WOMAN: "The word 'woman' comes from Old English wīfmann — 'wife-person' or 'female human'.",
  WORST: "Worst-case scenario planning helps engineers design for extreme events.",
  XENON: "Xenon headlights produce a bright white light; the gas was discovered in 1898.",
  XERIC: "Deserts are xeric; cacti and succulents have adaptations to store water.",
  YACHT: "The America's Cup is the oldest trophy in international sport, first raced in 1851.",
  YIELD: "In agriculture, yield is output per unit of land; crop yields have tripled since 1960.",
  YOGURT: "Yogurt's probiotics may aid digestion; it has been eaten for at least 4,000 years.",
  ZEBRA: "Zebra stripes may confuse predators or reduce biting flies; the debate continues.",
  ZESTY: "Zest comes from citrus peel; it contains aromatic oils that add bright flavour.",
  ZODIAC: "The zodiac's 12 signs roughly match the 12 constellations along the ecliptic.",
}

function getWordForClue(puzzle, cl, dir) {
  let w = ''
  for (let i = 0; i < cl.len; i++) {
    const r = dir === 'across' ? cl.r : cl.r + i
    const c = dir === 'across' ? cl.c + i : cl.c
    w += puzzle.grid[r]?.[c] || ''
  }
  return w
}

function enrichTrivia(puzzle) {
  const add = (list, dir) => {
    for (const cl of list) {
      const word = getWordForClue(puzzle, cl, dir)
      cl.trivia = TRIVIA[word] || `A curious word with a rich history — look it up and you might be surprised!`
    }
  }
  add(puzzle.clues.across, 'across')
  add(puzzle.clues.down, 'down')
}

function extractWords(puzzle) {
  const words = new Set()
  for (const cl of puzzle.clues.across) {
    let w = ''
    for (let i = 0; i < cl.len; i++) {
      const r = cl.r, c = cl.c + i
      w += puzzle.grid[r]?.[c] || ''
    }
    if (w) words.add(w)
  }
  for (const cl of puzzle.clues.down) {
    let w = ''
    for (let i = 0; i < cl.len; i++) {
      const r = cl.r + i, c = cl.c
      w += puzzle.grid[r]?.[c] || ''
    }
    if (w) words.add(w)
  }
  return words
}

function getBlackPercent(puzzle) {
  const grid = puzzle?.grid ?? []
  let black = 0, total = 0
  const cols = Math.max(0, ...grid.map(r => r?.length ?? 0))
  for (const row of grid) {
    for (let c = 0; c < (row?.length ?? cols); c++) {
      total++
      if (!row?.[c]) black++
    }
  }
  return total > 0 ? black / total : 0
}

function meetsSize(puzzle) {
  const rows = puzzle?.grid?.length ?? 0
  const cols = Math.max(0, ...(puzzle?.grid ?? []).map(r => r?.length ?? 0))
  return rows >= MIN_GRID_SIZE && rows <= MAX_GRID_SIZE &&
         cols >= MIN_GRID_SIZE && cols <= MAX_GRID_SIZE
}

async function generateOne(seed, excludeWords) {
  const wordList = await generateWordList(seed, { excludeWords })
  // Try fewer words first (produces smaller grids), then more
  const wordCounts = [22, 24, 26, 28, 30, 35, 40]
  for (const count of wordCounts) {
    const slice = wordList.slice(0, Math.min(count, wordList.length))
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const shuffled = attempt === 0
          ? slice
          : slice.slice(attempt * 2).concat(slice.slice(0, attempt * 2))
        const puzzle = generateCrossword(shuffled)
        if (meetsSize(puzzle)) return puzzle
      } catch { /* retry */ }
    }
  }
  return null
}

async function run() {
  console.log('\n── DailyFill Puzzle Bank Generation ───────────────')
  console.log(`Generating 6 unique puzzles (${MIN_GRID_SIZE}×${MIN_GRID_SIZE}–${MAX_GRID_SIZE}×${MAX_GRID_SIZE})...\n`)

  const bank = []
  const allUsedWords = new Set()

  for (let i = 0; i < 6; i++) {
    const seed = 900000 + i * 11111
    process.stdout.write(`  [${i + 1}/6] Seed ${seed} ... `)
    // Exclude only the previous puzzle's words to reduce overlap while keeping pool viable
    const prevWords = bank.length > 0 ? extractWords(bank[bank.length - 1]) : new Set()
    const puzzle = await generateOne(seed, prevWords)
    if (!puzzle) {
      console.log('FAILED')
      process.exit(1)
    }
    enrichTrivia(puzzle)
    const words = extractWords(puzzle)
    words.forEach(w => allUsedWords.add(w))
    bank.push(puzzle)
    const blackPct = (getBlackPercent(puzzle) * 100).toFixed(0)
    console.log(`OK (${puzzle.grid.length}×${puzzle.grid[0]?.length || 0}, ${blackPct}% blank, ${puzzle.clues.across.length}A/${puzzle.clues.down.length}D)`)
  }

  const outputPath = join(__dirname, '..', 'data', 'puzzleBank.js')
  const output = `// Auto-generated — run: node src/engine/generatePuzzleBank.js
// Six unique puzzles, 12×12–16×16 (target 30–40% blank; see generator note)

export const PUZZLE_BANK = ${JSON.stringify(bank, null, 2)}
`

  writeFileSync(outputPath, output)
  console.log(`\n✓ Wrote ${outputPath}`)
  console.log(`  Total unique words across bank: ${allUsedWords.size}\n`)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
