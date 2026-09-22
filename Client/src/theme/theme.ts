import { createTheme, type PaletteMode, type Theme } from '@mui/material/styles';
import { UI_SCALE, su } from './uiScale';

const amber = '#c8873a';
const amberLight = '#e0a75f';
/** The brand amber, deepened until it is legible as TEXT on the light theme's near-white
 * surfaces. `amber` itself only reaches ~2.5:1 there - fine as a fill behind contrastText, well
 * under the 4.5:1 text minimum as a foreground. MUI's own derived primary.dark (a flat 20%
 * darken) only gets to ~3.5:1, so the light palette states this shade outright. */
const amberDeep = '#8a5a1f';
const slate = '#3c3a4a';

/** The brand colour when it is being used as a FOREGROUND - icon or text - rather than as a
 * fill with contrastText over it.
 *
 * Dark mode's amberLight is already legible on the dark surfaces; light mode's amber is not,
 * which is how the Play toolbar ended up drawing the ACTIVE layout glyph - the one thing the
 * button exists to communicate - at 2.5:1 while every inactive one sat at 21:1 (checklist
 * I-U5). Anything painting primary onto a surface should go through this. */
export function primaryForeground(theme: Theme): string {
  return theme.palette.mode === 'dark' ? theme.palette.primary.main : theme.palette.primary.dark;
}

export function getTheme(mode: PaletteMode): Theme {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? amberLight : amber,
        // Stated rather than derived in light mode - see amberDeep and primaryForeground.
        ...(isDark ? {} : { dark: amberDeep }),
        contrastText: '#1a1720',
      },
      secondary: {
        main: slate,
      },
      background: isDark
        ? { default: '#17151d', paper: '#211e29' }
        : { default: '#f6f1e7', paper: '#ffffff' },
    },
    shape: {
      borderRadius: su(14),
    },
    // Every `sx` spacing prop in the app multiplies this, so one number moves all of them.
    spacing: 8 * UI_SCALE,
    typography: {
      fontFamily: '"Segoe UI", Roboto, system-ui, sans-serif',
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    components: {
      // --- density overrides -------------------------------------------------------------
      // MUI hardcodes these paddings and min-heights in px, so they are the one part of the
      // design system the root-font-size scale cannot reach (see theme/uiScale.ts). Each
      // value below is MUI's own default put through `su`, nothing more - this is a scale,
      // not a redesign. Components whose sizing is already rem or theme.spacing based are
      // deliberately absent; they scale on their own.
      MuiIconButton: {
        styleOverrides: {
          sizeSmall: { padding: su(5) },
          sizeMedium: { padding: su(8) },
          sizeLarge: { padding: su(12) },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: { paddingTop: su(8), paddingBottom: su(8), paddingLeft: su(16), paddingRight: su(16) },
        },
      },
      MuiListItem: {
        styleOverrides: {
          root: { paddingTop: su(8), paddingBottom: su(8) },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: { minWidth: su(56) },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { minHeight: su(48), paddingTop: su(6), paddingBottom: su(6) },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { padding: su(16) },
          sizeSmall: { padding: `${su(6)}px ${su(16)}px` },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { height: su(32) },
          sizeSmall: { height: su(24) },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { minHeight: su(48), padding: `${su(12)}px ${su(16)}px` },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          dense: { minHeight: su(48) },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          // `inputSizeSmall` is not a slot in MUI v9's OutlinedInput classes, so the small
          // variant is reached through its class from the input slot instead.
          input: {
            padding: `${su(16.5)}px ${su(14)}px`,
            '&.MuiInputBase-inputSizeSmall': { padding: `${su(8.5)}px ${su(14)}px` },
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { padding: `${su(16)}px ${su(24)}px` },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: { padding: `${su(20)}px ${su(24)}px` },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: { padding: su(8) },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: su(16), '&:last-child': { paddingBottom: su(24) } },
        },
      },
      MuiAccordionSummary: {
        styleOverrides: {
          root: { minHeight: su(48), paddingLeft: su(16), paddingRight: su(16) },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          option: { minHeight: su(48), paddingTop: su(6), paddingBottom: su(6) },
        },
      },
      // --- end density overrides ---------------------------------------------------------
      MuiCssBaseline: {
        styleOverrides: {
          '*': {
            scrollbarWidth: 'thin',
            scrollbarColor: `${isDark ? '#625c6d' : '#8a8378'} transparent`,
          },
          '*::-webkit-scrollbar': { width: su(8), height: su(8) },
          '*::-webkit-scrollbar-track': { background: 'transparent' },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? '#625c6d99' : '#8a837899',
            borderRadius: 999,
            border: '2px solid transparent',
            backgroundClip: 'padding-box',
          },
          '*::-webkit-scrollbar-thumb:hover': { backgroundColor: isDark ? '#81798e' : '#6f685f' },
          '*::-webkit-scrollbar-corner': { background: 'transparent' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            transition: 'transform 160ms ease, box-shadow 160ms ease',
          },
        },
      },
      MuiCardActionArea: {
        styleOverrides: {
          root: {
            '&:hover': {
              transform: 'translateY(-4px)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: su(10),
            textTransform: 'none',
            fontWeight: 600,
          },
          // MUI's own per-size paddings, scaled - see the density block above.
          sizeSmall: { padding: `${su(4)}px ${su(10)}px` },
          sizeMedium: { padding: `${su(6)}px ${su(16)}px` },
          sizeLarge: { padding: `${su(8)}px ${su(22)}px` },
        },
        // A text or outlined primary button paints the brand amber as a LABEL, which in light
        // mode sat at 2.7:1 - well under the 4.5:1 text minimum (checklist I-U5). Deepen just
        // the label; contained buttons are untouched, since there the amber is the fill with
        // contrastText over it, and the outline keeps the lighter amber on purpose.
        //
        // A `variants` entry rather than the classic textPrimary/outlinedPrimary style slots:
        // MUI v9 emits `MuiButton-text MuiButton-colorPrimary` as two separate classes and no
        // longer has the composite class those slots key off, so they silently do nothing.
        variants: isDark
          ? []
          : [
              { props: { variant: 'text' as const, color: 'primary' as const }, style: { color: amberDeep } },
              { props: { variant: 'outlined' as const, color: 'primary' as const }, style: { color: amberDeep } },
            ],
      },
      MuiSelect: {
        defaultProps: {
          // Keep menus anchored inside their dialog/popover. Portaled menus can
          // appear under the pointer between mouse-down and mouse-up, which made
          // every other click select an item immediately instead of opening.
          MenuProps: { disablePortal: true },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  });
}
