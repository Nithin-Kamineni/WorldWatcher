/**
 * Wall geometry and fog-of-war state for a map floor.
 *
 * Both live in IMAGE-PIXEL space - the background image's own natural
 * coordinates - NOT the stage-local space that tokens and AoE shapes use.
 * That is deliberate: walls trace features drawn on the image, so they have
 * to stay glued to it when the frozen background fit is recomputed (which
 * Reset View does, see MapBackgroundLayer's fitResetEpoch). Stage-local
 * coordinates would drift off the rocks the moment the viewport changed.
 * Rendering converts through a BackgroundFit - see utils/mapFit.ts.
 */

/** A sight-blocking polyline. Two points is the common case (one straight
 * wall drawn by dragging); auto-detected walls come back as long traced
 * contours. */
export interface WallSegment {
  id: string;
  /** flat [x1,y1,x2,y2,...] in image-pixel space; at least 2 points (4 numbers) */
  points: number[];
}

export interface FogState {
  /** Master switch. Off = the fog layer renders nothing at all, and no
   * line-of-sight work is done. */
  enabled: boolean;
  /** Explored-mask resolution, in cells across the image. Derived from the
   * image's aspect ratio at creation so cells stay roughly square. */
  cols: number;
  rows: number;
  /** Base64 of the bit-packed explored mask, row-major, `cols * rows` bits.
   * See utils/fogMask.ts. */
  explored: string;
}

/** Cells across the image's LONG edge. 120 keeps a 2500px-wide battlemap at
 * ~21px per cell - finer than a grid square, coarse enough that the packed
 * mask stays around 1.5kB of base64 in the floor's raw_data. */
export const FOG_CELLS_LONG_EDGE = 120;

/** Fog left over an area the party has explored but cannot currently see,
 * relative to unexplored fog. 0 = explored areas stay fully lit once seen,
 * 1 = they go fully dark again the moment they leave line of sight. */
export const FOG_EXPLORED_OPACITY = 0.55;

export const FOG_COLOR = '#05070c';

/** The DM is the only viewer this app has - there is no player-facing screen
 * yet - so fog can never be fully opaque during play or the DM loses the map
 * they are running. It renders translucent, and the "preview as players see
 * it" toggle switches to the opaque version. */
export const FOG_DM_OPACITY = 0.72;
export const FOG_PLAYER_OPACITY = 1;

/** Default paint radius for the manual reveal/hide brushes, in image px. */
export const FOG_BRUSH_RADIUS = 70;
export const FOG_BRUSH_MIN = 20;
export const FOG_BRUSH_MAX = 400;

/**
 * How long to wait before committing accumulated line-of-sight reveals into
 * the stored explored mask.
 *
 * Writing it on every token move costs a SECOND full MapPage render per move
 * on top of the one the move itself causes, which measured as ~85ms of extra
 * blocked main thread per step and was most of why dragging felt like it
 * froze. Nothing visible waits on this: the currently-visible tier is drawn
 * straight from `visionPolygons`, so what the party can see right now is
 * always immediate, and only the dimmed "we have been here" trail settles a
 * beat later.
 */
export const FOG_PERSIST_DEBOUNCE_MS = 400;

/** Default token sight range in GRID SQUARES. 12 squares is 60ft at the
 * usual 5ft grid - D&D 5e darkvision's most common range. */
export const DEFAULT_VISION_SQUARES = 12;

/**
 * Which image-processing pipeline the server should run when auto-detecting
 * walls. The two map styles want genuinely different treatment:
 *
 * - `painted` - a rendered/painted battlemap (soft shadows, textured rock,
 *   no ink lines). Edge detection, because there is no colour that reliably
 *   means "wall".
 * - `lineart` - a dungeon map exported from DungeonScrawl/Dungeondraft and
 *   friends: dark ink walls on a light floor. Thresholding the dark pixels
 *   is both faster and far more accurate than edges there.
 */
export type WallDetectMode = 'painted' | 'lineart';

export const WALL_DETECT_MODES: { value: WallDetectMode; label: string; hint: string }[] = [
  { value: 'painted', label: 'Painted', hint: 'Rendered or hand-painted battlemaps' },
  { value: 'lineart', label: 'Line art', hint: 'Dark-ink dungeon maps on a light floor' },
];

export const DEFAULT_FOG_STATE: FogState = { enabled: false, cols: 0, rows: 0, explored: '' };

export function createFogState(imageWidth: number, imageHeight: number, enabled = false): FogState {
  if (!(imageWidth > 0) || !(imageHeight > 0)) return { ...DEFAULT_FOG_STATE, enabled };
  const long = Math.max(imageWidth, imageHeight);
  const cols = Math.max(1, Math.round((imageWidth / long) * FOG_CELLS_LONG_EDGE));
  const rows = Math.max(1, Math.round((imageHeight / long) * FOG_CELLS_LONG_EDGE));
  return { enabled, cols, rows, explored: '' };
}
