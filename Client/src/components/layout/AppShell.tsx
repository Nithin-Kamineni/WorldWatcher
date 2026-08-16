import type { ReactNode } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import CastleIcon from '@mui/icons-material/Castle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import { useThemeMode } from '../../theme/ThemeModeContext';
import { useTutorialStore } from '../../store/useTutorialStore';
import { TutorialOverlay } from './TutorialOverlay';

interface AppShellProps {
  children: ReactNode;
  disableGutters?: boolean;
  fullHeight?: boolean;
  hideHeader?: boolean;
}

export const APP_HEADER_HEIGHT = 64;

export function AppShell({ children, disableGutters, fullHeight, hideHeader }: AppShellProps) {
  const { mode, toggleMode } = useThemeMode();
  const startTutorial = useTutorialStore((s) => s.start);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {!hideHeader && (
        <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar sx={{ height: APP_HEADER_HEIGHT }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }} data-tour="navbar-brand">
              <CastleIcon sx={{ mr: 1.5 }} color="primary" />
              <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
                WorldWatcher
              </Typography>
            </Box>
            <Tooltip title="Take the tour">
              <IconButton onClick={startTutorial} color="inherit" aria-label="Start tutorial">
                <HelpOutlineIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={toggleMode} color="inherit" aria-label="Toggle light/dark mode" data-tour="theme-toggle">
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Toolbar>
        </AppBar>
      )}
      <TutorialOverlay />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: fullHeight ? (hideHeader ? '100vh' : `calc(100vh - ${APP_HEADER_HEIGHT}px)`) : undefined,
        }}
      >
        {disableGutters ? (
          children
        ) : (
          <Container maxWidth="lg" sx={{ py: 4, flexGrow: fullHeight ? 1 : undefined, display: fullHeight ? 'flex' : undefined, flexDirection: fullHeight ? 'column' : undefined }}>
            {children}
          </Container>
        )}
      </Box>
    </Box>
  );
}
