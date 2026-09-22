/** The brand colours, as plain strings, in a module that imports NOTHING.
 *
 * theme.ts is where they are turned into an MUI palette, and that is still the only place
 * app chrome should get a colour from. This file exists for the one case that cannot reach
 * for the theme: code in the eager entry chunk. Importing `@mui/material/styles` there - even
 * just `useTheme` - pulls MUI's whole styles runtime in ahead of first paint, measured at
 * +198 kB on the entry chunk (198 -> 399). DiceRollOverlay is mounted from App.tsx and needs
 * exactly one colour, so it takes it from here instead. */

/** Brand amber. Also the die's material colour. */
export const BRAND_AMBER = '#c8873a';

/** Brand amber lifted for dark surfaces, where the base amber goes muddy. */
export const BRAND_AMBER_LIGHT = '#e0a75f';

/** The brand amber deepened until it is legible as TEXT on the light theme's near-white
 * surfaces - `BRAND_AMBER` itself only reaches ~2.5:1 there, well under the 4.5:1 minimum,
 * and MUI's own derived `primary.dark` (a flat 20% darken) only gets to ~3.5:1. */
export const BRAND_AMBER_DEEP = '#8a5a1f';

/** The secondary slate. */
export const BRAND_SLATE = '#3c3a4a';
