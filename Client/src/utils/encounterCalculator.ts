import type { Creature } from '../types/creature';
import type { EncounterCreatureEntry } from '../types/encounter';

/** 5e DMG challenge rating -> XP value table. */
const CR_XP: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

const CR_ORDER = Object.keys(CR_XP);

/** 5e DMG per-character XP thresholds by level, for a single character. */
const PER_CHARACTER_THRESHOLDS: Record<number, { easy: number; medium: number; hard: number; deadly: number }> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

export type DifficultyBracket = 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';

const BRACKET_LABEL: Record<DifficultyBracket, string> = {
  trivial: 'Trivial',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  deadly: 'Deadly',
};

/** XP awarded for a single creature of the given challenge rating (0 if the CR isn't recognized). */
export function xpForCR(cr: string): number {
  return CR_XP[cr.trim()] ?? 0;
}

/** Total unmodified XP of every creature in the encounter (custom entries with no linked creature contribute 0). */
export function totalMonsterXP(entries: EncounterCreatureEntry[], creatures: Creature[]): number {
  return entries.reduce((sum, entry) => {
    const creature = entry.creatureId ? creatures.find((c) => c.id === entry.creatureId) : undefined;
    if (!creature) return sum;
    return sum + xpForCR(creature.cr) * entry.quantity;
  }, 0);
}

export function totalMonsterCount(entries: EncounterCreatureEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

/** 5e DMG encounter multiplier table, assuming a standard party of 3-5 characters. */
export function encounterMultiplier(monsterCount: number): number {
  if (monsterCount <= 0) return 1;
  if (monsterCount === 1) return 1;
  if (monsterCount === 2) return 1.5;
  if (monsterCount <= 6) return 2;
  if (monsterCount <= 10) return 2.5;
  if (monsterCount <= 14) return 3;
  return 4;
}

/** Nearest CR whose single-creature XP value is closest to the given adjusted XP budget. */
export function nearestCRForXP(xp: number): string {
  let best = CR_ORDER[0];
  let bestDiff = Infinity;
  for (const cr of CR_ORDER) {
    const diff = Math.abs(CR_XP[cr] - xp);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = cr;
    }
  }
  return best;
}

function bracketForLevel(level: number, partySize: number, adjustedXP: number): DifficultyBracket {
  const t = PER_CHARACTER_THRESHOLDS[Math.min(20, Math.max(1, level))];
  if (adjustedXP < t.easy * partySize) return 'trivial';
  if (adjustedXP < t.medium * partySize) return 'easy';
  if (adjustedXP < t.hard * partySize) return 'medium';
  if (adjustedXP < t.deadly * partySize) return 'hard';
  return 'deadly';
}

export interface EncounterDifficultySuggestion {
  totalXP: number;
  adjustedXP: number;
  multiplier: number;
  monsterCount: number;
  cr: string;
  /** e.g. "Medium (party level 4-5)" */
  label: string;
  bracket: DifficultyBracket;
  levelRange: [number, number] | null;
}

/**
 * Computes total/adjusted XP and challenge rating for an encounter, then finds the
 * contiguous party-level range (1-20, assuming the given party size) at which this
 * encounter's adjusted XP counts as "Medium" difficulty - the standard DMG design target.
 * Falls back to whichever bracket actually occurs across levels 1-20 if Medium never does.
 */
export function suggestEncounterDifficulty(
  entries: EncounterCreatureEntry[],
  creatures: Creature[],
  partySize = 4,
): EncounterDifficultySuggestion {
  const totalXP = totalMonsterXP(entries, creatures);
  const monsterCount = totalMonsterCount(entries);
  const multiplier = encounterMultiplier(monsterCount);
  const adjustedXP = Math.round(totalXP * multiplier);
  const cr = nearestCRForXP(adjustedXP);

  const brackets = Array.from({ length: 20 }, (_, i) => bracketForLevel(i + 1, partySize, adjustedXP));
  const preferredOrder: DifficultyBracket[] = ['medium', 'hard', 'easy', 'deadly', 'trivial'];
  let bracket: DifficultyBracket = 'trivial';
  for (const candidate of preferredOrder) {
    if (brackets.includes(candidate)) {
      bracket = candidate;
      break;
    }
  }

  const levels = brackets.reduce<number[]>((acc, b, i) => (b === bracket ? [...acc, i + 1] : acc), []);
  const levelRange: [number, number] | null = levels.length > 0 ? [levels[0], levels[levels.length - 1]] : null;
  const label = levelRange
    ? levelRange[0] === levelRange[1]
      ? `${BRACKET_LABEL[bracket]} (party level ${levelRange[0]})`
      : `${BRACKET_LABEL[bracket]} (party level ${levelRange[0]}-${levelRange[1]})`
    : BRACKET_LABEL[bracket];

  return { totalXP, adjustedXP, multiplier, monsterCount, cr, label, bracket, levelRange };
}
