import { su } from './uiScale';

/** Every chrome measurement that scales with the UI scale, in one place.
 *
 * They live here rather than beside the components that use them for two reasons. The first
 * is honest bookkeeping: this is the full list of what `su` touches outside the MUI theme, so
 * "why is the shell this size" has one answer to read. The second is mechanical - these are
 * computed values now, not literals, and an exported computed value in a file that also
 * exports a component is exactly what React Fast Refresh cannot handle (oxlint's
 * react(only-export-components)).
 *
 * Map and note-canvas geometry is deliberately NOT here; see theme/uiScale.ts. */

/** Height of the global top bar. */
export const TOP_BAR_HEIGHT = su(56);

/** Type size of the rail's WORLD / CAMPAIGN group headings, floored at 6px because below that
 * they stop being words. The letter-spacing goes away at the floor, where its 3px matters. */
export const RAIL_HEADING_FONT_SIZE = Math.max(su(11), 6);
export const RAIL_HEADING_LETTER_SPACING = RAIL_HEADING_FONT_SIZE >= 7 ? 0.4 : 0;

/** Type size of the short name under each icon when labels are on. Same 6px floor, same
 * reason: "Encounters" is the longest of them and it has to fit the rail's width. */
export const RAIL_ITEM_LABEL_FONT_SIZE = Math.max(su(10), 6);

/** Narrowest either rail may get: wide enough for "CAMPAIGN", which both modes show.
 *
 * DERIVED, not guessed. The heading's type floor means it stops shrinking at small scales
 * while `su(62)` keeps going, which is what clipped it to "AMPAIGN" in the first place - so
 * the floor has to track the heading's own metrics, not be a constant somebody eyeballed
 * (a 36px constant was tried and was 8px short at scale 0.6). 0.62em is a conservative
 * average advance for uppercase Segoe UI; +6 is the breathing room that absorbs the
 * approximation. Predicts 64px at scale 1, where "CAMPAIGN" measures 58. */
const HEADING_WIDEST_CHARS = 'CAMPAIGN'.length;
const RAIL_MIN_WIDTH =
  Math.ceil(HEADING_WIDEST_CHARS * (RAIL_HEADING_FONT_SIZE * 0.62 + RAIL_HEADING_LETTER_SPACING)) + 6;

/** Icon rail: with the short labels drawn under the icons (Settings > "Icon rail labels" on),
 * and the default icon-only rail. The latter is wider than an icon strictly needs because its
 * glyphs are drawn big - with no label under them the glyph IS the button, so it gets the room
 * the two lines of text used to take. Both are held open by RAIL_MIN_WIDTH. */
export const ICON_RAIL_WIDTH = Math.max(su(64), RAIL_MIN_WIDTH);
export const ICON_RAIL_WIDTH_COMPACT = Math.max(su(62), RAIL_MIN_WIDTH);

/** Context sidebar. Expanded is a little wider than the original 220 so the World manager's
 * grouped nav (icon + label + chevron) fits without its labels truncating; collapsed is just
 * enough for the reopen button - deliberately a visible strip rather than nothing, so the
 * sidebar can always be found again. */
export const SIDEBAR_WIDTH = su(232);
export const COLLAPSED_SIDEBAR_WIDTH = su(36);

/** Right panel: full detail width, the icon-only width it falls back to when given no
 * children, and the floating show/hide arrow.
 *
 * That arrow is deliberately outside the layout flow (the panel "will not occupy space in any
 * page, will be just floating"), which means it sits ON TOP of whatever is flush against the
 * right edge. A page whose right edge carries controls - the Play workspace's rightmost pane
 * header - reserves HANDLE_WIDTH of padding so its buttons stay clickable. */
export const RIGHT_PANEL_WIDTH = su(300);
export const RIGHT_PANEL_ICON_ONLY_WIDTH = su(56);
export const RIGHT_PANEL_HANDLE_WIDTH = su(20);

/** Map page's own right-hand rail and its two panel widths. */
export const MAP_RAIL_WIDTH = su(56);
export const MAP_PANEL_WIDTH = su(300);
export const MAP_WIDE_PANEL_WIDTH = su(420);
