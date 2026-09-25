export interface TokenDefinition {
  id: string;
  name: string;
  imageSrc: string;
  isFavorite: boolean;
  /** grid-relative size multiplier (1.0 = one full grid cell); reset target for currentSize */
  defaultSize: number;
  /** grid-relative size multiplier actually used the next time this token is placed */
  currentSize: number;
}

export const DEFAULT_RELATIVE_SIZE = 1;
export const MIN_RELATIVE_SIZE = 0.25;
export const MAX_RELATIVE_SIZE = 4;

/** D&D 5e size category -> grid-relative token scale (1.0 = one full grid cell), matching the
 * standard 5e token footprint for each category. Lowercase keys. Older/non-5e size words that
 * can still show up via imported stat blocks (Fine/Diminutive/Colossal/Varies) get a sane
 * fallback since 5e has no official square-count for them. */
export const SIZE_CATEGORY_SCALE: Record<string, number> = {
  fine: 0.25,
  diminutive: 0.25,
  tiny: 0.5,
  small: 1,
  medium: 1,
  large: 2,
  huge: 3,
  gargantuan: 4,
  colossal: 4,
  varies: 1,
};

/** Maps a creature's `size` text (e.g. "Medium", or multi-size "Small/Medium" for
 * shapechangers) to a grid-relative token scale. Takes the first listed category for
 * multi-size values. Falls back to DEFAULT_RELATIVE_SIZE for unknown/empty input. */
export function sizeCategoryToScale(size: string | null | undefined): number {
  const first = size?.split('/')[0]?.trim().toLowerCase();
  if (!first) return DEFAULT_RELATIVE_SIZE;
  return SIZE_CATEGORY_SCALE[first] ?? DEFAULT_RELATIVE_SIZE;
}

export interface PlacedToken {
  id: string;
  tokenId: string;
  name: string;
  imageSrc: string;
  x: number;
  y: number;
  /** diameter, in stage-local px */
  size: number;
  outlineColor: string;
  /** names of active conditions/status effects, preset or custom */
  effects: string[];
  /** EncounterCreatureEntry.id this token was placed from, if any */
  encounterEntryId?: string;
  /** Creature.id this token represents, if placed from a known creature (encounter roster or
   * a favorited monster/NPC) - drives the stat block viewer, DEX-mod initiative roll, and the
   * relation tint below. */
  creatureId?: string;
  hp?: { current: number; max: number };
  /** temporary HP - absorbs damage before hp.current, per 5e rules; not additive with itself. */
  tempHp?: number;
  concentrating?: boolean;
  /** whether this combatant's reaction is already spent this round */
  reactionSpent?: boolean;
  deathSaves?: { successes: number; failures: number };
  /** freeform notes - spell slots, abilities, whatever the DM wants to track while in combat */
  notes?: string;
  /** How far this token sees, in stage px (the same unit as `size`), for
   * fog-of-war line of sight. Undefined or 0 means this token reveals
   * nothing - the default, so dropping a monster on the map never lights it
   * up for the party. See types/fog.ts and MapPage's visionPolygons. */
  visionRadius?: number;
  /** Derived at render time only (see MapPage's mapTokens) - never persisted. */
  relationTint?: string;
  /** Derived at render time only (see MapPage's mapTokens) - never persisted. */
  isCurrentTurn?: boolean;
  /** Linked creature's armor class, derived at render time only (see MapPage's mapTokens) -
   * never persisted. Used by the initiative sidebar's collapsed-row AC display. */
  ac?: number;
}

/** Stage px of one square when a map has no usable grid size - the only place a token's size
 * is not derived from the grid. */
export const DEFAULT_TOKEN_SIZE = 20;

function squarePx(gridSize: number | null | undefined): number {
  return gridSize && gridSize > 0 ? gridSize : DEFAULT_TOKEN_SIZE;
}

/** Grid-relative size (1 = one square) -> the stage-px diameter a PlacedToken stores. */
export function tokenSizeFromSquares(squares: number, gridSize: number | null | undefined): number {
  const clamped = Math.min(MAX_RELATIVE_SIZE, Math.max(MIN_RELATIVE_SIZE, Number.isFinite(squares) ? squares : 1));
  return clamped * squarePx(gridSize);
}

/** The inverse, for editing a placed token's size in squares. Rounded to 0.05 so a token
 * placed at 1 square reads back as 1, not 0.99999. */
export function tokenSizeToSquares(size: number, gridSize: number | null | undefined): number {
  return Math.round((size / squarePx(gridSize)) * 20) / 20;
}
export const DEFAULT_TOKEN_OUTLINE_COLOR = '#f5c542';
export const TOKEN_OUTLINE_WIDTH = 2;
/** fallback max/current HP given to any token placed on the map without linked creature stats */
export const DEFAULT_TOKEN_HP = 10;
