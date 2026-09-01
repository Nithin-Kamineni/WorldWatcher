import type { SxProps, Theme } from '@mui/material/styles';

/** Neutral gray at 55% opacity - reads fine as a subtle scrollbar thumb against both light and
 * dark panel backgrounds without needing theme-aware color logic. */
const THUMB_COLOR = 'rgba(128,128,128,0.55)';

/** Marker class picked up by the app-wide scroll listener installed in App.tsx - it toggles
 * `data-ww-scrolling` on whichever element most recently fired a scroll event, so the CSS below
 * can key off "actively scrolling right now" instead of "hovered". */
export const FLOATING_SCROLLBAR_CLASS = 'ww-floating-scroll';

/** A floating scrollbar: invisible and reserving no layout space until the container is
 * actually being scrolled, at which point a thin overlay thumb fades in and back out again -
 * spread into any scrollable container's `sx` alongside `className={FLOATING_SCROLLBAR_CLASS}`
 * (the class is what the global scroll listener in App.tsx watches for). `overflow: overlay`
 * (Chromium/Electron/VSCode-webview only) is what keeps the thumb from reserving a gutter; other
 * engines fall back to plain `auto` and pay a small, unavoidable gutter width instead. */
export const thinScrollbarSx: SxProps<Theme> = {
  overflowY: 'auto',
  '@supports (overflow-y: overlay)': {
    overflowY: 'overlay',
  },
  scrollbarWidth: 'thin',
  scrollbarColor: 'transparent transparent',
  '&::-webkit-scrollbar': {
    width: 8,
    height: 8,
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'transparent',
    borderRadius: 4,
    transition: 'background-color 150ms ease',
  },
  '&[data-ww-scrolling="true"]': {
    scrollbarColor: `${THUMB_COLOR} transparent`,
  },
  '&[data-ww-scrolling="true"]::-webkit-scrollbar-thumb': {
    background: THUMB_COLOR,
  },
};
