/**
 * Line-of-sight: the visibility polygon seen from a point, given a set of
 * sight-blocking segments.
 *
 * Classic angular sweep. Fire a ray at every wall endpoint (plus a hair to
 * either side, which is what catches the silhouette edges where a wall ends
 * and vision spills past it), keep the nearest hit, then stitch the hits
 * together in angle order. Uniform filler rays are mixed in so the
 * unobstructed edge at max range reads as a circle rather than a polygon
 * with visible facets.
 *
 * Everything here works in IMAGE-PIXEL space, the same space walls and the
 * fog mask are stored in - see types/fog.ts. Callers convert token positions
 * and sight radii in through the BackgroundFit, and convert the resulting
 * polygon back out for rendering.
 */
import type { WallSegment } from '../types/fog';

export interface VisibilitySegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Angular nudge applied either side of each endpoint ray. Small enough not
 * to visibly round off a corner, large enough to survive float error at the
 * map scales involved. */
const EDGE_EPSILON = 0.00012;

/** Filler ray spacing, radians. ~3 degrees: 120 rays for a full circle. */
const FILL_STEP = (Math.PI * 2) / 120;

/** Explodes each wall polyline into its individual segments. */
export function wallsToSegments(walls: WallSegment[]): VisibilitySegment[] {
  const segments: VisibilitySegment[] = [];
  for (const wall of walls) {
    const pts = wall.points;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x1 = pts[i];
      const y1 = pts[i + 1];
      const x2 = pts[i + 2];
      const y2 = pts[i + 3];
      if (x1 === x2 && y1 === y2) continue;
      segments.push({ x1, y1, x2, y2 });
    }
  }
  return segments;
}

/** Segments whose bounding box overlaps the sight circle's bounding box.
 * Everything past that cannot occlude anything inside the radius, and
 * dropping it early is what keeps a map with a few thousand auto-detected
 * wall segments interactive. */
function segmentsInRange(
  segments: VisibilitySegment[],
  ox: number,
  oy: number,
  radius: number,
): VisibilitySegment[] {
  const minX = ox - radius;
  const maxX = ox + radius;
  const minY = oy - radius;
  const maxY = oy + radius;
  return segments.filter(
    (s) =>
      Math.max(s.x1, s.x2) >= minX &&
      Math.min(s.x1, s.x2) <= maxX &&
      Math.max(s.y1, s.y2) >= minY &&
      Math.min(s.y1, s.y2) <= maxY,
  );
}

/** Distance along the ray at which it first crosses the segment, or
 * Infinity. Ray is (ox,oy) + t*(dx,dy) with (dx,dy) a unit vector. */
function rayHitDistance(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  s: VisibilitySegment,
): number {
  const ex = s.x2 - s.x1;
  const ey = s.y2 - s.y1;
  const den = dx * ey - dy * ex;
  if (den > -1e-9 && den < 1e-9) return Infinity; // parallel

  const wx = s.x1 - ox;
  const wy = s.y1 - oy;
  const t = (wx * ey - wy * ex) / den;
  if (t < 0) return Infinity;
  const u = (wx * dy - wy * dx) / den;
  if (u < 0 || u > 1) return Infinity;
  return t;
}

/**
 * The polygon visible from (ox, oy), bounded by `radius`.
 *
 * Returns a flat [x,y,x,y,...] ring. An empty result means the radius was
 * non-positive; an unobstructed point returns a 120-gon approximating the
 * sight circle.
 */
export function computeVisibilityPolygon(
  ox: number,
  oy: number,
  radius: number,
  segments: VisibilitySegment[],
): number[] {
  if (!(radius > 0)) return [];

  const near = segmentsInRange(segments, ox, oy, radius);
  const angles: number[] = [];

  for (let a = 0; a < Math.PI * 2; a += FILL_STEP) angles.push(a);

  for (const s of near) {
    const a1 = Math.atan2(s.y1 - oy, s.x1 - ox);
    const a2 = Math.atan2(s.y2 - oy, s.x2 - ox);
    angles.push(a1 - EDGE_EPSILON, a1, a1 + EDGE_EPSILON);
    angles.push(a2 - EDGE_EPSILON, a2, a2 + EDGE_EPSILON);
  }

  angles.sort((a, b) => a - b);

  const points: number[] = [];
  let lastAngle = Number.NEGATIVE_INFINITY;

  for (const angle of angles) {
    // Duplicate angles produce duplicate vertices, which Konva renders fine
    // but which bloat the polygon that later gets scanline-filled into the
    // explored mask.
    if (angle - lastAngle < 1e-9) continue;
    lastAngle = angle;

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let best = radius;
    for (const s of near) {
      const t = rayHitDistance(ox, oy, dx, dy, s);
      if (t < best) best = t;
    }

    const px = ox + dx * best;
    const py = oy + dy * best;
    // Drop vertices that land on top of the previous one. A wall-dense map
    // fires three rays at every endpoint, and most of them resolve to the
    // same hit - on a real map this cut the polygon from ~1390 vertices to a
    // few hundred, which is that much less for Konva to path and for the
    // mask's scanline fill to walk. The threshold is well under the size of
    // one fog cell, so the silhouette is unchanged.
    const n = points.length;
    if (n >= 2 && Math.abs(points[n - 2] - px) < 0.75 && Math.abs(points[n - 1] - py) < 0.75) continue;
    points.push(px, py);
  }
  return points;
}
