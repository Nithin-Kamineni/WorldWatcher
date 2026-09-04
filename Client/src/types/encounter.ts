import { xpForCR } from '../utils/encounterCalculator';

export type CombatRole =
  | 'minion' | 'skirmisher' | 'brute' | 'soldier' | 'artillery' | 'controller' | 'lurker' | 'leader'
  | 'solo_boss' | 'support_healer';

export interface EncounterCreatureEntry {
  id: string;
  /** null = a one-off custom creature entered inline, not saved to the creature library */
  creatureId: string | null;
  name: string;
  imageSrc: string;
  quantity: number;
  /** Preserved imported count such as 2d4+1; quantity is the resolved/fixed fallback. */
  quantityFormula?: string | null;
  /** grid-relative size multiplier, only used for custom (creatureId === null) entries - linked creatures use their own currentSize */
  size?: number;
  role?: CombatRole | null;
  notes?: string | null;
  /** linked creature's challenge_rating_display (e.g. "1/8", "5") - null for custom entries or when unresolved. Used for encounter difficulty and picking the encounter's fallback image (highest-CR creature). */
  cr?: string | null;
}

export type NpcAttitude = 'hostile' | 'unfriendly' | 'indifferent' | 'friendly' | 'helpful';
export type NpcAgenda =
  | 'wants_money' | 'wants_protection' | 'wants_information' | 'wants_revenge' | 'wants_recruit'
  | 'wants_deceive' | 'wants_escape' | 'wants_status' | 'hiding_secret' | 'testing_party';

export interface RpCues {
  voice?: string;
  mannerism?: string;
  appearanceTag?: string;
  catchphrase?: string;
}

export interface EncounterNpcEntry {
  id: string;
  npcId: string;
  name: string;
  imageSrc: string;
  attitude: NpcAttitude | null;
  agenda: NpcAgenda | null;
  secret: string | null;
  leverage: string | null;
  rpCues: RpCues | null;
  sortOrder: number;
}

export interface EncounterCombatBlock {
  shape: string | null;
  victoryCondition: string | null;
  awareness: string | null;
  startRange: string | null;
  lighting: string | null;
  terrainType: string | null;
  terrainFeatures: string[];
  morale: string | null;
  reinforcements: { mode: string; trigger: string; round: number | null; tableId: string | null } | null;
  dynamicEvents: { trigger: string; event: string }[];
  difficultyBand: string | null;
  computedXp: number | null;
  hasLairOrLegendary: boolean;
  aftermath: string[];
  scalingNotes: string | null;
  mapId: string | null;
  transitionEncounterId: string | null;
}

export interface EncounterSocialBlock {
  shape: string | null;
  venue: string | null;
  tone: string | null;
  stakes: string | null;
  playerLevers: string[];
  keyChecks: { skill: string; dc: number; onSuccess: string; onFailure: string }[];
  outcomeTiers: unknown;
  socialClock: { successesNeeded: number; failuresAllowed: number } | null;
  gatedInfo: { fact: string; revealWhen: string }[];
  complications: string[];
  escalation: string | null;
  transitionEncounterId: string | null;
}

export interface EncounterTrapDetails { name: string; trigger: string; detectDc: number | null; disableDc: number | null; effect: string; damageFormula: string; damageType: string | null; conditionIds: string[]; }
export interface EncounterHazardDetails { name: string; saveAbility: string | null; saveDc: number | null; effect: string; damageFormula: string; damageType: string | null; conditionIds: string[]; }
export interface EncounterSkillChallengeDetails { goal: string; successesRequired: number; failuresAllowed: number; skills: string[]; }
export interface EncounterPuzzleDetails { premise: string; solution: string; hints: string[]; }
export interface EncounterNavigationDetails { skill: string | null; dc: number | null; success: string; failure: string; }

export interface EncounterExplorationBlock {
  shape: string | null;
  environment: string | null;
  terrainDifficulty: string | null;
  obstacleType: string | null;
  trap: EncounterTrapDetails | null;
  hazard: EncounterHazardDetails | null;
  skillChallenge: EncounterSkillChallengeDetails | null;
  puzzle: EncounterPuzzleDetails | null;
  sensoryClues: { sense: string; detail: string; perceiveDc: number | null }[];
  pointsOfInterest: { name: string; hidden?: boolean; revealWhen?: string; rewardOrInfo?: string }[];
  navigation: EncounterNavigationDetails | null;
  resourceCost: string[];
  verticality: boolean;
  complications: string[];
  transitionEncounterId: string | null;
  wanderingTableId: string | null;
}

export const ENCOUNTER_TYPE_PRESETS = [
  'Tavern Fight',
  'Forest Ambush',
  'Puzzle',
  'Heist',
  'NPC Interaction / Negotiation',
];

export const ENCOUNTER_THEME_PRESETS = ['Palace', 'Dark Horror', 'Heroic'];

export const ENCOUNTER_LOCATION_PRESETS = ['Forest', 'Cave', 'Fort', 'Dungeon', 'Village', 'Ruins', 'Swamp', 'Mountain Pass'];

export type EncounterResolutionType = 'fixed' | 'random_table';

/** One creature reference parsed out of a random-table row's result text (see the importer's
 * projectors/encounter.py) - either a dice-rolled count ("2d4 Pirates") or a fixed one ("one
 * Pirate Captain" / "1 cloud giant"). */
export interface EncounterTableCreature {
  name: string;
  source: string | null;
  countDice: string | null;
  countFixed: number | null;
}

export interface EncounterTableRow {
  min: number;
  max: number;
  /** raw text with 5etools {@tag} markup still in it - kept for reference/debugging only */
  result: string;
  /** tag-stripped, human-readable version of `result` - this is what the UI shows */
  resultText: string;
  creatures: EncounterTableCreature[];
}

export interface EncounterRollTable {
  /** e.g. "1d10", "d100", "d12 + d8" */
  diceExpression: string;
  /** character-level band this table applies to, if the source encounter has more than one table (optional) */
  minlvl?: number | null;
  maxlvl?: number | null;
  table: EncounterTableRow[];
}

/** A creature reference within one RandomTableRow, resolved (by
 * Database/EncounterProcessing) to a real creatures.id - unlike the legacy
 * EncounterTableCreature above, this is what lets the DM panel look up the
 * creature's type/token instead of just displaying a free-text name. */
export interface RandomTableCreature {
  id: string;
  creatureId: string | null;
  /** creature's real name if creatureId resolved, else the raw regex-extracted substring */
  name: string;
  /** creatures.creature_type joined server-side, e.g. "Humanoid" - null when creatureId didn't resolve */
  type: string | null;
  imageSrc: string;
  /** fixed count ("1", "3") or a dice formula ("3d8", "1d4") */
  quantityFormula: string;
  /** creatures.challenge_rating_display joined server-side - null when creatureId didn't resolve */
  cr: string | null;
}

/** One {min, max} roll range, backed by the encounter_tables table - the
 * normalized replacement for reading `tables`/raw_data at display time. */
export interface RandomTableRow {
  id: string;
  diceExpression: string | null;
  minLevel: number | null;
  maxLevel: number | null;
  min: number;
  max: number;
  resultText: string;
  creatures: RandomTableCreature[];
}

export type EncounterPrimaryType = 'combat' | 'social' | 'exploration';
export type EncounterStatus = 'draft' | 'ready' | 'used';
export interface EncounterReward { kind: string; description: string; quantity: number; }

export interface Encounter {
  id: string;
  name: string;
  description: string;
  challengeRating: string;
  computedXp?: number | null;
  difficulty?: string | null;
  theme: string;
  /** e.g. Tavern Fight, Forest Ambush, Puzzle, Heist, NPC Interaction / Negotiation */
  encounterType?: string;
  /** where this encounter might plausibly take place */
  possibleLocations?: string[];
  /** freeform "other features" tags */
  tags: string[];
  /** 'fixed' (default): a hand-picked roster, the original creatures[] flow below.
   * 'random_table': a 5etools-style roll table (imported or DM-authored) - creatures[] is
   * unused; see `tables` instead, and Bugs.txt #4e/4f's roll flow on the map toolbar. */
  resolutionType: EncounterResolutionType;
  sourceId?: string;
  page?: number;
  tables?: EncounterRollTable[];
  /** normalized roll-table rows for resolutionType 'random_table' - see RandomTableRow.
   * Preferred over `tables` for anything that needs a real creature link (mob-type
   * filtering, tokens, stat blocks); `tables` is kept only as the raw display text. */
  randomTables?: RandomTableRow[];
  creatures: EncounterCreatureEntry[];
  createdAt: number;
  updatedAt: number;

  // --- shared "run layer" (Random Tables + Encounters overhaul) ---
  primaryType: EncounterPrimaryType | null;
  categoryId: string | null;
  status: EncounterStatus;
  /** player-facing boxed text - kept separate from `description`, which is DM prep/notes */
  readAloud: string | null;
  objective: string | null;
  partyLevelMin: number | null;
  partyLevelMax: number | null;
  partySize: number | null;
  scalingNotes: string | null;
  locationId: string | null;
  rewards: EncounterReward[];
  tagIds: string[];
  npcs: EncounterNpcEntry[];
  combatBlock: EncounterCombatBlock | null;
  socialBlock: EncounterSocialBlock | null;
  explorationBlock: EncounterExplorationBlock | null;
}

export function encounterCreatureSummary(encounter: Encounter): string {
  if (encounter.resolutionType === 'random_table') {
    const normalized = (encounter.randomTables ?? []).flatMap((row) => row.creatures.map((creature) => `${creature.quantityFormula} ${creature.name}`));
    const imported = (encounter.tables ?? []).flatMap((table) => table.table.flatMap((row) => row.creatures.map((creature) => `${creature.countDice ?? creature.countFixed ?? 1} ${creature.name}`)));
    const formulas = normalized.length ? normalized : imported;
    return formulas.length ? Array.from(new Set(formulas)).join(' + ') : 'Varies by roll';
  }
  const formulas = encounter.creatures.map((creature) => `${creature.quantityFormula ?? creature.quantity} ${creature.name}`);
  return formulas.length ? formulas.join(' + ') : '—';
}

/** No explicit encounter image (Encounter has no image field of its own) - use the image of
 * the highest-CR creature involved in the encounter (across the whole fixed roster, or every
 * random-table row's creatures), falling back to the first creature with any image when no CR
 * data is available. CR is compared via its XP value (monotonic with CR) rather than parsing
 * fraction strings directly. */
export function getEncounterFallbackImage(encounter: Encounter): string {
  const candidates: { imageSrc: string; cr?: string | null }[] =
    encounter.resolutionType === 'random_table'
      ? (encounter.randomTables ?? []).flatMap((row) => row.creatures)
      : encounter.creatures;
  const withImage = candidates.filter((c) => c.imageSrc);
  if (withImage.length === 0) return '';
  let best = withImage[0];
  let bestXp = xpForCR(best.cr ?? '');
  for (const candidate of withImage.slice(1)) {
    const xp = xpForCR(candidate.cr ?? '');
    if (xp > bestXp) {
      best = candidate;
      bestXp = xp;
    }
  }
  return best.imageSrc;
}
