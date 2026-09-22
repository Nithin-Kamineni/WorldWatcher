/** The outline of a d20 seen face-on, for the toolbar button's icon.
 *
 * This is ART, and only art - it draws the button you press. The die that actually gets
 * rolled is a 3D mesh with real numbering, simulated by @3d-dice/dice-box; see
 * DiceRollOverlay. An earlier version of this file also carried decorative face numerals for
 * a 2D "die", which was a lie - they were fixed strings that had nothing to do with the
 * result and could contradict it. Nothing here should ever show a number again.
 *
 * WHY THE GEOMETRY IS COMPUTED RATHER THAN A HAND-DRAWN PATH. A hand-traced d20 is always
 * slightly wrong: the facet lines don't meet and the inner triangle is sized by eye.
 * Orthographic projection of an icosahedron with one face toward the viewer, edge length `a`:
 *   - circumradius            R_c = a*sin(2*pi/5)     = 0.95106a
 *   - face-centre distance    r_f = a*phi^2/(2*sqrt3) = 0.75576a
 *   - the 3 front-face vertices project to radius sqrt(R_c^2 - r_f^2) = 0.57735a
 *   - the 6 middle-band vertices project to radius 0.93419a, every 60 degrees, so the
 *     silhouette is a regular hexagon
 * so the inner triangle's radius is 0.57735/0.93419 = 0.61803 of the hexagon's - 1/phi, as it
 * had to be. */

const VIEW = 100;
const CENTRE = VIEW / 2;

/** Radius of the silhouette. Short of 50 so a stroked outline stays inside the viewBox. */
const HEX_R = 46;
const INNER_R = HEX_R * 0.618034;

/** Polar to SVG-cartesian: angles are the usual maths convention (0 = right, CCW), y flipped
 * because SVG's y axis points down. */
function pt(deg: number, radius: number): readonly [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [CENTRE + radius * Math.cos(rad), CENTRE - radius * Math.sin(rad)] as const;
}

const hex = (deg: number) => pt(deg, HEX_R);
const inner = (deg: number) => pt(deg, INNER_R);

const poly = (points: (readonly [number, number])[]) =>
  points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');

export const D20_SILHOUETTE = poly([hex(30), hex(90), hex(150), hex(210), hex(270), hex(330)]);

/** The face pointing at the viewer, and the three sharing an edge with it. Just those four:
 * at the ~22px the icon is drawn at, the full 10-facet net turns into a grey smudge, and
 * these already read as "a d20, not a d6". */
export const D20_INNER_FACETS: string[] = [
  poly([inner(90), inner(210), inner(330)]),
  poly([inner(90), inner(330), hex(30)]),
  poly([inner(210), inner(90), hex(150)]),
  poly([inner(330), inner(210), hex(270)]),
];

export const D20_VIEWBOX = `0 0 ${VIEW} ${VIEW}`;
