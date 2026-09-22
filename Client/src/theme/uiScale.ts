/** THE UI scale, for the whole app.
 *
 * WHY THIS EXISTS. At 100% browser zoom the app was too big to use on a 1536x864 viewport -
 * it wanted roughly 1.5x the room it had, so it was only comfortable at 67% browser zoom.
 * This makes that density the app's own default instead of something you have to set per
 * origin, per machine, in the browser chrome.
 *
 * WHY NOT `zoom` / `transform: scale`. Both are one-liners and both are wrong here. MUI v9
 * positions every overlay through @popperjs/core v2 (Tooltip, Menu, Select, Autocomplete) or
 * through Popover's own getBoundingClientRect math, and neither compensates for a scaled
 * ancestor: with `zoom: 0.67` on html OR body, a rail tooltip lands 84px above its icon, and
 * the error grows with distance down the page. `height: 100vh` also stops meaning "the
 * viewport" under zoom (it rendered 579px tall in an 864px window). Measured, not assumed -
 * see checklist I-S. So the scale is applied through the design system instead, where the
 * numbers stay real px and every positioning calculation keeps working.
 *
 * WHAT ACTUALLY SCALES:
 *   - all typography, via the root font size (MUI's variants are rem)
 *   - MUI icon glyphs, which are also rem (1.5rem / 1.25rem)
 *   - every `sx` spacing prop (p, m, gap, ...), via theme.spacing
 *   - the px paddings MUI hardcodes in its own components, via theme.components overrides
 *   - this app's chrome constants (top bar, icon rail, sidebars, section headers), via `su`
 *
 * WHAT DOES NOT, BY DESIGN: map and note-canvas geometry (grid size, token size, SVG origin,
 * stage coordinates). Those are model values that happen to be measured in px; scaling them
 * would move tokens relative to the grid.
 *
 * WHY IT IS READ ONCE AT MODULE LOAD. Layout constants are module-level `const`s consumed by
 * `sx` all over the tree, so they cannot track a store that changes mid-session. Reading the
 * persisted value here, before React renders, lets those constants be plain numbers again;
 * the Settings control reloads the page after writing a new value, so the theme and the
 * constants can never disagree. */

/** localStorage key of useNavMemoryStore's persist record - the one place this file has to
 * know about the store, because it runs before any store is constructed. */
const NAV_MEMORY_KEY = 'worldwatcher-nav-memory';

/** The offered steps. 0.6 is the default: 0.67 matched the browser zoom the app had been
 * usable at, and one step tighter than that was what it actually wanted in practice. 1 is
 * "what it looked like before this existed", and 0.5 is there for a small laptop screen. */
export const UI_SCALE_OPTIONS = [0.5, 0.55, 0.6, 0.67, 0.75, 0.85, 1] as const;
export const DEFAULT_UI_SCALE = 0.6;

function readPersistedScale(): number {
  if (typeof window === 'undefined') return DEFAULT_UI_SCALE;
  try {
    const raw = window.localStorage.getItem(NAV_MEMORY_KEY);
    if (!raw) return DEFAULT_UI_SCALE;
    const value = JSON.parse(raw)?.state?.uiScale;
    // Anything unrecognised (a record from before this existed, a hand-edited value, a NaN)
    // falls back rather than laying the whole app out at some absurd size.
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.5 || value > 1.5) {
      return DEFAULT_UI_SCALE;
    }
    return value;
  } catch {
    return DEFAULT_UI_SCALE;
  }
}

export const UI_SCALE = readPersistedScale();

/** Scale a chrome measurement. Rounded, because a fractional px on a border or a fixed header
 * height is how you get a 1px seam that moves as you scroll. */
export function su(px: number): number {
  return Math.round(px * UI_SCALE);
}

/** The browser default every rem in the app resolves against. MUI's `theme.htmlFontSize` is
 * deliberately LEFT at 16 while this shrinks the real root size - that mismatch is precisely
 * what makes every rem-based size in MUI (and every icon glyph) come out scaled. */
const BASE_ROOT_FONT_SIZE = 16;

/** Applied imperatively rather than from index.css because the value is a runtime preference.
 * Called from main.tsx before the first render, so nothing paints at the wrong size. */
export function applyRootFontScale(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = `${BASE_ROOT_FONT_SIZE * UI_SCALE}px`;
}
