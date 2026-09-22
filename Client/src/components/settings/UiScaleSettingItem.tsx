import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import { useNavMemoryStore } from '../../store/useNavMemoryStore';
import { UI_SCALE, UI_SCALE_OPTIONS } from '../../theme/uiScale';

/** How big the whole app is drawn. Rendered on both Settings pages next to the rail-labels
 * row, for the same reason: it is a property of the shell, not of a world or a campaign.
 *
 * Picking a value RELOADS the page. That is deliberate, not a shortcut - the theme could
 * rebuild live, but the chrome constants (top bar height, rail width, sidebar widths) are
 * module-level numbers read once at startup, and a half-applied scale looks broken in a way
 * that is hard to attribute. One reload keeps every reader in agreement. */
export function UiScaleSettingItem() {
  const setUiScale = useNavMemoryStore((s) => s.setUiScale);

  const apply = (next: number | null) => {
    if (next === null || next === UI_SCALE) return;
    setUiScale(next);
    // Let zustand's persist write before the document is torn down.
    window.setTimeout(() => window.location.reload(), 0);
  };

  return (
    <ListItem>
      <ListItemIcon sx={{ minWidth: 36 }}>
        <FormatSizeIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary="UI scale" secondary="How large everything is drawn. Reloads the page." />
      <ToggleButtonGroup
        exclusive
        size="small"
        value={UI_SCALE}
        onChange={(_, next: number | null) => apply(next)}
        aria-label="UI scale"
      >
        {UI_SCALE_OPTIONS.map((option) => (
          <ToggleButton key={option} value={option} aria-label={`${Math.round(option * 100)} percent`} sx={{ px: 1.25 }}>
            {Math.round(option * 100)}%
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </ListItem>
  );
}
