import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { ShortcutsSettingsDialog } from '../../components/settings/ShortcutsSettingsDialog';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';
import { useThemeMode } from '../../theme/ThemeModeContext';

const COMING_SOON_SECTIONS = ['Profile', 'Publishing', 'Players / invites', 'World settings', 'Integrations'];

export function WorldSettingsPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);
  const { mode, toggleMode } = useThemeMode();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  return (
    <SectionLayout worldId={worldId!}>
      <Breadcrumbs items={[{ label: world?.name ?? '…' }, { label: 'Settings' }]} />
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Settings
      </Typography>
      <Paper variant="outlined" sx={{ borderRadius: 3, maxWidth: 480, overflow: 'hidden' }}>
        <List disablePadding>
          <ListItemButton disableRipple sx={{ cursor: 'default' }}>
            <ListItemText primary="Appearance" secondary="Light / dark theme" />
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {mode === 'dark' ? 'Dark' : 'Light'}
              </Typography>
              <Switch checked={mode === 'dark'} onChange={toggleMode} size="small" />
            </Stack>
          </ListItemButton>
          <ListItemButton onClick={() => setShortcutsOpen(true)}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <KeyboardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Keyboard shortcuts" secondary="Customize map & combat hotkeys" />
            <ChevronRightIcon fontSize="small" color="disabled" />
          </ListItemButton>
          {COMING_SOON_SECTIONS.map((label) => (
            <ListItemButton key={label} disabled>
              <ListItemText primary={label} />
              <Box>
                <Chip label="Soon" size="small" variant="outlined" />
              </Box>
            </ListItemButton>
          ))}
        </List>
      </Paper>

      <ShortcutsSettingsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </SectionLayout>
  );
}
