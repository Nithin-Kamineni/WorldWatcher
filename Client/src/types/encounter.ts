export interface EncounterCreatureEntry {
  id: string;
  /** null = a one-off custom creature entered inline, not saved to the creature library */
  creatureId: string | null;
  name: string;
  imageSrc: string;
  quantity: number;
  /** grid-relative size multiplier, only used for custom (creatureId === null) entries - linked creatures use their own currentSize */
  size?: number;
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

export interface Encounter {
  id: string;
  name: string;
  description: string;
  challengeRating: string;
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
}

/** No explicit encounter image (Encounter has no image field of its own) - fall back to the
 * first creature of the first table, per Bugs.txt #7. For a fixed roster, "first table" is
 * just `creatures`; for a random-table encounter, tables/creatures are already in roll order
 * (min ascending / sort_order) so [0] is correct without re-sorting here. */
export function getEncounterFallbackImage(encounter: Encounter): string {
  if (encounter.resolutionType === 'random_table') {
    return encounter.randomTables?.[0]?.creatures?.[0]?.imageSrc ?? '';
  }
  return encounter.creatures[0]?.imageSrc ?? '';
}
