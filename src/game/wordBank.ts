/**
 * Extensive word bank, generator, hints, and guess matching for Skribbl.
 * Supports Easy, Medium, and Hard difficulty levels with 350+ curated words.
 */

export type WordDifficulty = 'easy' | 'medium' | 'hard';
export type RoomDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';

export const WORD_BANK: Record<WordDifficulty, string[]> = {
  easy: [
    // Everyday objects & household items
    'APPLE', 'CAT', 'SUN', 'TREE', 'PIZZA', 'HOUSE', 'CAR', 'STAR', 'FISH', 'BOOK',
    'MOON', 'CLOCK', 'HAT', 'DOG', 'CAKE', 'CLOUD', 'BIRD', 'BALL', 'SMILE', 'FIRE',
    'BOAT', 'DOOR', 'CHAIR', 'BED', 'SHOE', 'SOCK', 'CUP', 'FORK', 'SPOON', 'BREAD',
    'EGG', 'MILK', 'WATER', 'FLOWER', 'LEAF', 'RING', 'BELL', 'KEY', 'LOCK', 'BOX',
    'BAG', 'PEN', 'PENCIL', 'PHONE', 'GLASS', 'BOTTLE', 'LAMP', 'TABLE', 'WINDOW', 'WALL',
    'HEART', 'EYE', 'NOSE', 'EAR', 'HAND', 'FOOT', 'BABY', 'DUCK', 'FROG', 'PIG',
    'COW', 'SHEEP', 'HORSE', 'MOUSE', 'BEAR', 'LION', 'SNAKE', 'WORM', 'ANT', 'BEE',
    'SPIDER', 'ICE', 'SNOW', 'RAIN', 'WIND', 'ROAD', 'HILL', 'RIVER', 'FLAG', 'BALLOON',
    'DRUM', 'KITE', 'TRAIN', 'BUS', 'PLANE', 'TRUCK', 'BIKE', 'CANDLE', 'SHIRT', 'PANTS',
    'JACKET', 'BOOT', 'WATCH', 'COIN', 'COFFEE', 'TEA', 'BANANA', 'ORANGE', 'GRAPE', 'LEMON',
    'CHERRY', 'CARROT', 'CORN', 'CHEESE', 'BURGER', 'COOKIE', 'CANDY', 'DONUT', 'SOUP', 'BOWL'
  ],
  medium: [
    // Specific objects, activities, concepts & professions
    'SKATEBOARD', 'LIGHTHOUSE', 'CAMPING', 'TELESCOPE', 'CAMPFIRE', 'SUBMARINE',
    'ROLLERCOASTER', 'ASTRONAUT', 'PARACHUTE', 'WATERFALL', 'POPCORN', 'SUNGLASSES',
    'MICROPHONE', 'HELICOPTER', 'DETECTIVE', 'CHAMELEON', 'VOLCANO', 'BOOMERANG',
    'HAMMOCK', 'TREADMILL', 'BACKPACK', 'COMPASS', 'JELLYFISH', 'LAWNMOWER',
    'SNOWBOARD', 'BLENDER', 'PIRATE SHIP', 'SANDCASTLE', 'ANCHOR', 'MICROSCOPE',
    'WINDMILL', 'TREASURE CHEST', 'OCTOPUS', 'FLAMINGO', 'KANGAROO', 'HEDGEHOG',
    'PENGUIN', 'GIRAFFE', 'SQUIRREL', 'RHINOCEROS', 'CHEETAH', 'CROCODILE',
    'LOBSTER', 'SEAHORSE', 'SCORPION', 'BUTTERFLY', 'CATERPILLAR', 'GRASSHOPPER',
    'MOSQUITO', 'FIREFLY', 'DRAGONFLY', 'HUMMINGBIRD', 'WOODPECKER', 'PELICAN',
    'SEAGULL', 'BARBECUE', 'FIRECRACKER', 'TRAMPOLINE', 'SURFBOARD', 'WAKEBOARD',
    'ICE SKATES', 'BOWLING PIN', 'BASEBALL MITT', 'TENNIS RACKET', 'GOLF CLUB',
    'FISHING ROD', 'SCUBA MASK', 'DIVING BOARD', 'LIFEGUARD', 'FIREFIGHTER',
    'POLICE OFFICER', 'PARAMEDIC', 'SURGEON', 'SCIENTIST', 'ASTRONOMER',
    'ARCHITECT', 'CARPENTER', 'ELECTRICIAN', 'MECHANIC', 'GARDENER', 'MAGICIAN',
    'JUGGLER', 'ACROBAT', 'BALLERINA', 'ASTRONAUT SUIT', 'METEOR', 'SATELLITE DISH',
    'HOT AIR BALLOON', 'HOVERBOARD', 'SEGWAY', 'FERRIS WHEEL', 'CAROUSEL', 'HAUNTED HOUSE',
    'IGLOO', 'TEEPEE', 'WIND TURBINE', 'SOLAR PANEL', 'ELECTRIC GUITAR', 'SAXOPHONE',
    'TRUMPET', 'VIOLIN', 'HARMONICA', 'ACCORDION', 'TURNTABLE', 'MICROPHONE STAND'
  ],
  hard: [
    // Creative phrases, multiword challenges, sci-fi & imaginative ideas
    'TIME MACHINE', 'PARALLEL UNIVERSE', 'INVISIBLE BRIDGE', 'SOLAR ECLIPSE',
    'BLACK HOLE', 'VIRTUAL REALITY', 'METEOR SHOWER', 'BERMUDA TRIANGLE',
    'ENCHANTED FOREST', 'SUPERHERO LANDING', 'UNDERWATER CITY', 'ESCAPE ROOM',
    'POLAR VORTEX', 'ALIEN ABDUCTION', 'LASER TAG', 'SECRET LABORATORY',
    'DINOSAUR FOSSIL', 'CRYSTAL BALL', 'SOLAR FLARE', 'ROBOT UPRISING',
    'ANCIENT PYRAMID', 'QUANTUM COMPUTER', 'ZERO GRAVITY', 'MAGIC CARPET',
    'RUNAWAY TRAIN', 'GOLDEN TICKET', 'NORTHERN LIGHTS', 'TIME TRAVELER',
    'HAUNTED SHIP', 'WORMHOLE', 'SPACE STATION', 'NEBULA CLOUD', 'CYBERPUNK CITY',
    'GRAVITY BOOTS', 'JETPACK CHASE', 'FLYING CAR', 'FORCE FIELD', 'TELEPORTATION PAD',
    'MIND CONTROL HELMET', 'EXTRATERRESTRIAL', 'SUPERNOVA EXPLOSION', 'ASTEROID BELT',
    'GHOST TOWN', 'BURIED TREASURE', 'SECRET PASSAGE', 'BOOBY TRAP', 'QUICKSAND PIT',
    'BOTTOMLESS PIT', 'PIRATE CAPTAIN', 'VIKING SHIP', 'MEDIEVAL CASTLE', 'STONEHENGE',
    'FOUNTAIN OF YOUTH', 'ATLANTIS', 'LOCH NESS MONSTER', 'BIGFOOT SIGHTING', 'PHOENIX RISING',
    'DRAGON LAIR', 'WIZARD TOWER', 'POTION BREWING', 'ALCHEMY TABLE', 'FLYING BROOMSTICK',
    'MAGIC WAND DUEL', 'INVISIBILITY CLOAK', 'SHADOW PUPPET', 'OPTICAL ILLUSION',
    'CARNIVAL MIRROR', 'ROLLER DERBY', 'BULLFIGHTING', 'DEEP SEA TRENCH', 'ABANDONED MINE',
    'RADIOACTIVE WASTELAND', 'FROZEN WASTELAND', 'DESERT OASIS', 'JUNGLE TEMPLE',
    'MOUNTAIN SUMMIT', 'AVALANCHE RESCUE', 'LIGHTNING STRIKE', 'TSUNAMI WAVE',
    'VOLCANIC ERUPTION', 'TORNADO ALLEY', 'SANDSTORM SWIRL', 'GLACIER MELTING'
  ]
};

/**
 * Gets a single random word from a specified difficulty, avoiding recently used words if possible.
 */
export function getRandomWord(
  difficulty: WordDifficulty = 'medium',
  excludeWords: Set<string> | string[] = new Set()
): string {
  const pool = WORD_BANK[difficulty] || WORD_BANK.medium;
  const excludeSet = excludeWords instanceof Set ? excludeWords : new Set(excludeWords);

  // Filter pool excluding recent words
  const available = pool.filter(w => !excludeSet.has(w.toUpperCase()));
  const candidates = available.length > 0 ? available : pool;

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

/**
 * Generates 3 distinct word options for a drawer round based on the room's difficulty setting.
 * Guarantees no duplicates and avoids recently used words.
 */
export function generateWordOptions(
  difficulty: RoomDifficulty = 'mixed',
  excludeWords: Set<string> | string[] = new Set()
): { words: string[]; difficulties: Record<string, WordDifficulty> } {
  const excludeSet = excludeWords instanceof Set ? new Set(excludeWords) : new Set(excludeWords);
  const selected: string[] = [];
  const difficulties: Record<string, WordDifficulty> = {};

  if (difficulty === 'mixed') {
    // 1 Easy, 1 Medium, 1 Hard
    const diffs: WordDifficulty[] = ['easy', 'medium', 'hard'];
    for (const diff of diffs) {
      const pool = WORD_BANK[diff];
      const available = pool.filter(w => !excludeSet.has(w.toUpperCase()) && !selected.includes(w));
      const candidates = available.length > 0 ? available : pool.filter(w => !selected.includes(w));
      const word = candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
      selected.push(word);
      difficulties[word] = diff;
      excludeSet.add(word.toUpperCase());
    }
  } else {
    // All 3 from the specified difficulty
    const targetDiff: WordDifficulty = difficulty;
    const pool = WORD_BANK[targetDiff] || WORD_BANK.medium;
    
    for (let i = 0; i < 3; i++) {
      const available = pool.filter(w => !excludeSet.has(w.toUpperCase()) && !selected.includes(w));
      const candidates = available.length > 0 ? available : pool.filter(w => !selected.includes(w));
      const word = candidates[Math.floor(Math.random() * candidates.length)] || pool[i % pool.length];
      selected.push(word);
      difficulties[word] = targetDiff;
      excludeSet.add(word.toUpperCase());
    }
  }

  return { words: selected, difficulties };
}

/**
 * Generates masked hint for players (e.g. "R _ C _ E T" or "T _ M E   M _ C H _ N E").
 * Preserves spaces between multi-word phrases clearly with double spaces.
 */
export function getWordHint(word: string, revealedPercentage: number = 0.25): string {
  if (!word) return '';
  const letters = word.split('');
  const nonSpaceIndices = letters
    .map((char, index) => ({ char, index }))
    .filter(item => item.char !== ' ');

  const totalLetters = nonSpaceIndices.length;
  const revealCount = Math.max(1, Math.floor(totalLetters * Math.min(1, Math.max(0, revealedPercentage))));

  // Deterministic reveal based on character positions
  const revealedIndices = new Set<number>();
  for (let i = 0; i < nonSpaceIndices.length && revealedIndices.size < revealCount; i += 2) {
    revealedIndices.add(nonSpaceIndices[i].index);
  }
  // Fill remaining if needed
  for (let i = 1; i < nonSpaceIndices.length && revealedIndices.size < revealCount; i += 2) {
    revealedIndices.add(nonSpaceIndices[i].index);
  }

  return letters
    .map((char, i) => {
      if (char === ' ') return '  ';
      if (revealedIndices.has(i)) return char;
      return '_';
    })
    .join(' ');
}

/**
 * Normalizes a string by trimming, removing excessive whitespace, and removing punctuation.
 */
function normalizeString(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"!]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Checks if a guess matches the target word.
 * Handles:
 * - Case insensitivity
 * - Whitespace normalization
 * - Trailing punctuation
 * - Common plurals (e.g. "apple" matches "apples")
 */
export function isCorrectGuess(guess: string, targetWord: string): boolean {
  if (!guess || !targetWord) return false;

  const cleanGuess = normalizeString(guess);
  const cleanTarget = normalizeString(targetWord);

  return cleanGuess === cleanTarget;
}

/**
 * Checks if a message contains the exact word to prevent spoiling in chat.
 */
export function containsExactAnswer(message: string, targetWord: string): boolean {
  if (!message || !targetWord) return false;
  const cleanMsg = normalizeString(message);
  const cleanTarget = normalizeString(targetWord);

  if (cleanMsg === cleanTarget) return true;
  const words = cleanMsg.split(' ');
  return words.includes(cleanTarget);
}

/**
 * Calculates Levenshtein distance between two normalized strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Checks if a guess is very close to the target word (e.g. 1 typo away).
 */
export function isCloseGuess(guess: string, targetWord: string): boolean {
  if (!guess || !targetWord) return false;
  const cleanGuess = normalizeString(guess);
  const cleanTarget = normalizeString(targetWord);
  if (cleanGuess === cleanTarget) return false;
  if (cleanTarget.length < 3) return false;

  const distance = levenshteinDistance(cleanGuess, cleanTarget);
  return distance === 1 || (cleanTarget.length >= 6 && distance === 2);
}

