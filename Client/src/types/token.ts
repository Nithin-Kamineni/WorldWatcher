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
  concentrating?: boolean;
  deathSaves?: { successes: number; failures: number };
  /** freeform notes - spell slots, abilities, whatever the DM wants to track while in combat */
  notes?: string;
  /** Derived at render time only (see MapPage's mapTokens) - never persisted. */
  relationTint?: string;
  /** Derived at render time only (see MapPage's mapTokens) - never persisted. */
  isCurrentTurn?: boolean;
}

export const DEFAULT_TOKEN_SIZE = 60;
export const MIN_TOKEN_SIZE = 16;
export const MAX_TOKEN_SIZE = 110;
export const DEFAULT_TOKEN_OUTLINE_COLOR = '#f5c542';
export const TOKEN_OUTLINE_WIDTH = 2;
/** fallback max/current HP given to any token placed on the map without linked creature stats */
export const DEFAULT_TOKEN_HP = 10;
