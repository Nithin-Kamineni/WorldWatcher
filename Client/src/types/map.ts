import type { PlacedToken } from './token';
import type { AoEShape } from './shape';
import type { InitiativeState } from './initiative';
import { DEFAULT_INITIATIVE_STATE } from './initiative';
import type { EncounterCreatureEntry } from './encounter';
import type { FogState, WallSegment } from './fog';
import { DEFAULT_FOG_STATE } from './fog';

export type MapKind = 'battle' | 'city' | 'region' | 'continent' | 'world';

export interface MapKindOption {
  value: MapKind;
  label: string;
  color: 'error' | 'warning' | 'info' | 'secondary' | 'success';
}

export const MAP_KIND_OPTIONS: MapKindOption[] = [
  { value: 'battle', label: 'Battle Map', color: 'error' },
  { value: 'city', label: 'City', color: 'warning' },
  { value: 'region', label: 'Region Map', color: 'info' },
  { value: 'continent', label: 'Continent Map', color: 'secondary' },
  { value: 'world', label: 'World Map', color: 'success' },
];

export function getMapKindOption(kind: MapKind): MapKindOption {
  return MAP_KIND_OPTIONS.find((option) => option.value === kind) ?? MAP_KIND_OPTIONS[0];
}

export type MapSetting = 'indoor' | 'outdoor' | 'both';

export interface MapSettingOption {
  value: MapSetting;
  label: string;
}

export const MAP_SETTING_OPTIONS: MapSettingOption[] = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'both', label: 'Indoor & Outdoor' },
];

/** freeform label/value pair for whatever extra info the DM wants to track on a map */
export interface MapCustomDetail {
  id: string;
  label: string;
  value: string;
}

export interface MapFloor {
  id: string;
  name: string;
  imageSrc: string;
  placedTokens: PlacedToken[];
  shapes: AoEShape[];
  flippedHorizontal?: boolean;
  flippedVertical?: boolean;
  /** cumulative 90deg rotation, wraps at 360 */
  rotation?: number;
  lockedEncounterId?: string | null;
  /** For a locked random-table encounter only: the roster resolved by the map toolbar's roll
   * flow (Bugs.txt #4e/4f) - a fresh roll per "instance" of running that encounter, so it's kept
   * separate from the encounter's own reusable `tables` template. Null/undefined = not rolled
   * yet (or the locked encounter is a fixed roster, which uses its own `creatures[]` directly). */
  resolvedEncounterRoster?: EncounterCreatureEntry[] | null;
  initiative: InitiativeState;
  /** Sight-blocking geometry, in IMAGE-pixel space - see types/fog.ts. */
  walls: WallSegment[];
  fog: FogState;
  /**
   * The canvas size this floor's contents were authored against.
   *
   * Tokens, AoE shapes and the grid are all stored in raw stage pixels, and the background
   * image is laid out by contain-fitting it into the canvas. If that fit is computed from
   * the LIVE canvas size, then opening the map at a different window size - a different
   * monitor, the sidebar open, fullscreen - re-fits the background while the tokens stay on
   * their old numbers, and every token appears to have moved.
   *
   * Pinning the size the content was authored at makes the fit a pure function of stored
   * data, so a token's coordinates mean the same thing forever. Adapting to whatever window
   * is actually open is then a single transform on the Konva Stage, which moves the
   * background and the tokens together. Written once, on the first load of a floor that
   * does not have it yet - see MapPage's migration effect.
   */
  authoredStage?: { width: number; height: number };
}

export const DEFAULT_GRID_SIZE = 70;
export type GridType = 'square' | 'hex';
export const DEFAULT_GRID_COLOR = 'rgba(128,128,128,0.35)';
export const DEFAULT_GRID_THICKNESS = 1;
export const DEFAULT_GRID_TYPE: GridType = 'square';

export interface MapData {
  id: string;
  name: string;
  description: string;
  kinds: MapKind[];
  floors: MapFloor[];
  /** id of the floor whose image represents this map in lists/thumbnails */
  primaryFloorId: string;
  gridEnabled: boolean;
  gridSize: number;
  gridColor: string;
  gridThickness: number;
  gridType: GridType;
  /** where in the world this map takes place, e.g. "Northern Eboron, near the Frosthold pass" */
  location?: string;
  setting?: MapSetting;
  /** what's planned / happening / happened here - the story context for this map */
  activity?: string;
  /** extra freeform details the DM wants to track, shown in the "More info" view */
  customDetails?: MapCustomDetail[];
  createdAt: number;
  updatedAt: number;
  // future: layers: LayerConfig[]
}

export function createEmptyFloor(id: string, name: string, imageSrc: string): MapFloor {
  return {
    id,
    name,
    imageSrc,
    placedTokens: [],
    shapes: [],
    initiative: { ...DEFAULT_INITIATIVE_STATE, entries: [] },
    walls: [],
    fog: { ...DEFAULT_FOG_STATE },
  };
}

export function getPrimaryFloor(map: MapData): MapFloor | undefined {
  return map.floors.find((floor) => floor.id === map.primaryFloorId) ?? map.floors[0];
}
