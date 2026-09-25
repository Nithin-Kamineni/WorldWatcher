export type MapRotation = 0 | 90 | 180 | 270;

const ROTATIONS: MapRotation[] = [0, 90, 180, 270];

/** Tries all 4 axis-aligned rotations and picks whichever makes a `contentW`x`contentH`
 * image fill the most of a `viewportW`x`viewportH` viewport, without disproportionate
 * stretching (uniform contain-fit scale per rotation - 90/270 swap the effective
 * width/height since the on-screen bounding box rotates with the image). */
export function computeBestFitRotation(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
): { rotation: MapRotation; scale: number } {
  let best: { rotation: MapRotation; scale: number } = { rotation: 0, scale: 0 };
  for (const rotation of ROTATIONS) {
    const rotated = rotation === 90 || rotation === 270;
    const effW = rotated ? contentH : contentW;
    const effH = rotated ? contentW : contentH;
    const scale = Math.min(viewportW / effW, viewportH / effH);
    if (scale > best.scale) best = { rotation, scale };
  }
  return best;
}

/**
 * Where the background image actually lands in stage-local space.
 *
 * MapCanvas owns one of these per (image, fitResetEpoch) and freezes it -
 * tokens/grid/shapes live in raw stage pixels and never move on their own,
 * so re-fitting the image on every container resize would make them appear
 * to drift off their squares. Walls and fog-of-war are stored in image-pixel
 * space instead (see types/fog.ts) and convert through this on the way to
 * the canvas.
 */
export interface BackgroundFit {
  /** uniform image-px -> stage-px factor */
  scale: number;
  /** stage-local position of the image's top-left corner */
  x: number;
  y: number;
  /** the image's natural size, carried so consumers can bound fog to it */
  imageWidth: number;
  imageHeight: number;
}

/** Contain-fit of an `imageW`x`imageH` image into a `stageW`x`stageH` stage.
 * `rotation` only affects the SCALE (90/270 swap the on-screen bounding box);
 * the offset stays in unrotated image space because the render-time Konva
 * Group rotates around the stage centre after the fact. Mirrors what
 * MapBackgroundLayer drew inline before this was lifted out of it. */
export function computeBackgroundFit(
  stageW: number,
  stageH: number,
  imageW: number,
  imageH: number,
  rotation?: number,
): BackgroundFit | null {
  if (!(stageW > 0) || !(stageH > 0) || !(imageW > 0) || !(imageH > 0)) return null;
  const rotated = rotation === 90 || rotation === 270;
  const effW = rotated ? imageH : imageW;
  const effH = rotated ? imageW : imageH;
  const scale = Math.min(stageW / effW, stageH / effH);
  return {
    scale,
    x: (stageW - imageW * scale) / 2,
    y: (stageH - imageH * scale) / 2,
    imageWidth: imageW,
    imageHeight: imageH,
  };
}

export function imagePointToStage(px: number, py: number, fit: BackgroundFit): { x: number; y: number } {
  return { x: fit.x + px * fit.scale, y: fit.y + py * fit.scale };
}

export function stagePointToImage(sx: number, sy: number, fit: BackgroundFit): { x: number; y: number } {
  return { x: (sx - fit.x) / fit.scale, y: (sy - fit.y) / fit.scale };
}

/** Converts a flat [x,y,x,y,...] polyline from image space to stage space. */
export function imagePointsToStage(points: number[], fit: BackgroundFit): number[] {
  const out: number[] = new Array(points.length);
  for (let i = 0; i < points.length; i += 2) {
    out[i] = fit.x + points[i] * fit.scale;
    out[i + 1] = fit.y + points[i + 1] * fit.scale;
  }
  return out;
}

/** An axis-aligned area in a floor's LOCAL (pre-flip, pre-rotation) stage space. */
export interface GridBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** How much of local space the grid has to rule so that it covers everything the DM can see
 * of the floor, whatever its rotation.
 *
 * Content layers draw inside a Group that flips and rotates about the canvas centre, so the
 * grid is laid out in that Group's local space. Unrotated, the canvas rectangle is enough.
 * At 90/270 it is not: that rectangle turns into a tall band down the middle of the screen,
 * and the image - which at 90/270 is fitted with its sides swapped - overhangs the canvas in
 * local space. So this is the union of three rectangles:
 *   - the canvas itself (what the grid always covered, letterbox included);
 *   - the canvas's footprint seen through the rotation, i.e. the same size with width and
 *     height swapped about the same centre - the part of local space that lands on screen;
 *   - the background image, from the fit.
 * Flips need nothing: they mirror about the centre, which maps each of these onto itself. */
export function gridBoundsFor(
  stageW: number,
  stageH: number,
  rotation: number | undefined,
  fit: BackgroundFit | null,
): GridBounds {
  const cx = stageW / 2;
  const cy = stageH / 2;
  let minX = 0;
  let minY = 0;
  let maxX = stageW;
  let maxY = stageH;
  if (rotation === 90 || rotation === 270) {
    minX = Math.min(minX, cx - stageH / 2);
    maxX = Math.max(maxX, cx + stageH / 2);
    minY = Math.min(minY, cy - stageW / 2);
    maxY = Math.max(maxY, cy + stageW / 2);
  }
  if (fit) {
    minX = Math.min(minX, fit.x);
    minY = Math.min(minY, fit.y);
    maxX = Math.max(maxX, fit.x + fit.imageWidth * fit.scale);
    maxY = Math.max(maxY, fit.y + fit.imageHeight * fit.scale);
  }
  return { minX, minY, maxX, maxY };
}
