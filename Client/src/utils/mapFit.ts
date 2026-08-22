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
