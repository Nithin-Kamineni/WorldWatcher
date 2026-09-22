import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import { useNavMemoryStore } from '../../store/useNavMemoryStore';

/** The "text under the rail icons" switch, rendered inside the settings <List> on both the
 * world and the campaign Settings page - the icon rail is shell chrome, visible from every
 * page, so the preference has to be reachable from whichever Settings page you landed on and
 * is one global value, not one per world or campaign. Off by default: the rail is icon-only
 * and each icon names itself through its tooltip. */
export function RailLabelsSettingItem() {
  const railLabelsVisible = useNavMemoryStore((s) => s.railLabelsVisible);
  const setRailLabelsVisible = useNavMemoryStore((s) => s.setRailLabelsVisible);

  return (
    <ListItemButton onClick={() => setRailLabelsVisible(!railLabelsVisible)}>
      <ListItemIcon sx={{ minWidth: 36 }}>
        <ViewSidebarIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary="Icon rail labels" secondary="Show text names under the icons in the left rail" />
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {railLabelsVisible ? 'On' : 'Off'}
        </Typography>
        <Switch
          checked={railLabelsVisible}
          onChange={(e) => setRailLabelsVisible(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          size="small"
          slotProps={{ input: { 'aria-label': 'Show text names under the icon rail icons' } }}
        />
      </Stack>
    </ListItemButton>
  );
}
