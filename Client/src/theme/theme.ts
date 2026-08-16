import { createTheme, type PaletteMode, type Theme } from '@mui/material/styles';

const amber = '#c8873a';
const amberLight = '#e0a75f';
const slate = '#3c3a4a';

export function getTheme(mode: PaletteMode): Theme {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? amberLight : amber,
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
      borderRadius: 14,
    },
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
            borderRadius: 10,
            textTransform: 'none',
            fontWeight: 600,
          },
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
