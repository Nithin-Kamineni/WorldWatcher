/**
 * The fog-of-war "explored" mask: a coarse boolean grid laid over the
 * background image, bit-packed and base64'd so it fits in the floor's
 * raw_data JSONB alongside initiative.
 *
 * A grid rather than a union of revealed polygons, on purpose. A polygon
 * union grows without bound as the party walks around and has to be
 * re-simplified to stay renderable; a fixed grid is a few kB no matter how
 * long the session runs, diffs cleanly over the WS relay, and is trivial to
 * paint into with a brush. The cost is ~20px of granularity at the edge of a
 * reveal, which the dimming gradient hides anyway.
 *
 * Working form is one byte per cell (Uint8Array, 0 or 1) because every
 * operation here is a read-modify-write over spans; packing happens only at
 * the persistence boundary.
 */
import type { FogState } from '../types/fog';

export interface FogGrid {
  cols: number;
  rows: number;
  cells: Uint8Array;
}

function packedLength(cols: number, rows: number): number {
  return Math.ceil((cols * rows) / 8);
}

/** Unpacks a FogState into a working grid. Returns an all-hidden grid if the
 * stored payload is missing, malformed, or sized for a different resolution -
 * a floor saved before fog existed, or one whose background image was
 * swapped, must degrade to "nothing explored" rather than to garbage. */
export function decodeFogGrid(fog: FogState | null | undefined): FogGrid | null {
  if (!fog || !(fog.cols > 0) || !(fog.rows > 0)) return null;
  const { cols, rows } = fog;
  const cells = new Uint8Array(cols * rows);
  if (!fog.explored) return { cols, rows, cells };

  let binary: string;
  try {
    binary = atob(fog.explored);
  } catch {
    return { cols, rows, cells };
  }
  if (binary.length !== packedLength(cols, rows)) return { cols, rows, cells };

  for (let i = 0; i < cells.length; i += 1) {
    const byte = binary.charCodeAt(i >> 3);
    cells[i] = (byte >> (i & 7)) & 1;
  }
  return { cols, rows, cells };
}

export function encodeFogGrid(grid: FogGrid): string {
  const bytes = new Uint8Array(packedLength(grid.cols, grid.rows));
  for (let i = 0; i < grid.cells.length; i += 1) {
    if (grid.cells[i]) bytes[i >> 3] |= 1 << (i & 7);
  }
  let binary = '';
  // Chunked so a large mask never blows the argument limit on String.fromCharCode.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function cloneFogGrid(grid: FogGrid): FogGrid {
  return { cols: grid.cols, rows: grid.rows, cells: new Uint8Array(grid.cells) };
}

export function fogGridsEqual(a: FogGrid, b: FogGrid): boolean {
  if (a.cols !== b.cols || a.rows !== b.rows) return false;
  for (let i = 0; i < a.cells.length; i += 1) {
    if (a.cells[i] !== b.cells[i]) return false;
  }
  return true;
}

export function setAllCells(grid: FogGrid, value: 0 | 1): FogGrid {
  const next = cloneFogGrid(grid);
  next.cells.fill(value);
  return next;
}

/** Size of one cell in image pixels. */
function cellSize(grid: FogGrid, imageWidth: number, imageHeight: number) {
  return { w: imageWidth / grid.cols, h: imageHeight / grid.rows };
}

/** Paints a filled circle (image-space centre and radius) into the grid.
 * Mutates in place - callers clone first when they need the old value. */
export function markCircle(
  grid: FogGrid,
  imageWidth: number,
  imageHeight: number,
  cx: number,
  cy: number,
  radius: number,
  value: 0 | 1,
): boolean {
  const { w, h } = cellSize(grid, imageWidth, imageHeight);
  const minCol = Math.max(0, Math.floor((cx - radius) / w));
  const maxCol = Math.min(grid.cols - 1, Math.floor((cx + radius) / w));
  const minRow = Math.max(0, Math.floor((cy - radius) / h));
  const maxRow = Math.min(grid.rows - 1, Math.floor((cy + radius) / h));
  const r2 = radius * radius;
  let changed = false;

  for (let row = minRow; row <= maxRow; row += 1) {
    const py = (row + 0.5) * h;
    for (let col = minCol; col <= maxCol; col += 1) {
      const px = (col + 0.5) * w;
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy > r2) continue;
      const idx = row * grid.cols + col;
      if (grid.cells[idx] !== value) {
        grid.cells[idx] = value;
        changed = true;
      }
    }
  }
  return changed;
}

/** Scanline-fills a closed polygon (flat [x,y,...] in image space) into the
 * grid. Used to union each token's line-of-sight polygon into the explored
 * mask, which is what makes a revealed area stay revealed. */
export function markPolygon(
  grid: FogGrid,
  imageWidth: number,
  imageHeight: number,
  points: number[],
  value: 0 | 1,
): boolean {
  if (points.length < 6) return false;
  const { w, h } = cellSize(grid, imageWidth, imageHeight);
  const n = points.length / 2;

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < points.length; i += 2) {
    if (points[i] < minY) minY = points[i];
    if (points[i] > maxY) maxY = points[i];
  }
  const minRow = Math.max(0, Math.floor(minY / h));
  const maxRow = Math.min(grid.rows - 1, Math.floor(maxY / h));
  let changed = false;
  const crossings: number[] = [];

  for (let row = minRow; row <= maxRow; row += 1) {
    const py = (row + 0.5) * h;
    crossings.length = 0;

    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const y1 = points[i * 2 + 1];
      const y2 = points[j * 2 + 1];
      if (y1 === y2) continue;
      if (py < Math.min(y1, y2) || py >= Math.max(y1, y2)) continue;
      const x1 = points[i * 2];
      const x2 = points[j * 2];
      crossings.push(x1 + ((py - y1) / (y2 - y1)) * (x2 - x1));
    }
    if (crossings.length < 2) continue;
    crossings.sort((a, b) => a - b);

    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const startCol = Math.max(0, Math.ceil(crossings[k] / w - 0.5));
      const endCol = Math.min(grid.cols - 1, Math.floor(crossings[k + 1] / w - 0.5));
      for (let col = startCol; col <= endCol; col += 1) {
        const idx = row * grid.cols + col;
        if (grid.cells[idx] !== value) {
          grid.cells[idx] = value;
          changed = true;
        }
      }
    }
  }
  return changed;
}
