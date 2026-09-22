import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CasinoIcon from '@mui/icons-material/Casino';
import { useDiceRollStore, DICE_DISMISS_OPTIONS } from '../../store/useDiceRollStore';

/** How long a rolled d20 stays on screen. On both Settings pages for the same reason the UI
 * scale and rail labels are: the die is thrown over the whole app from the top bar, so it is
 * shell chrome rather than something a world or a campaign owns.
 *
 * This one does NOT reload the page - unlike the UI scale, nothing reads it at module load;
 * each die picks the value up when it lands. */
export function DiceRollSettingItem() {
  const dismissSeconds = useDiceRollStore((s) => s.dismissSeconds);
  const setDismissSeconds = useDiceRollStore((s) => s.setDismissSeconds);

  return (
    <ListItem>
      <ListItemIcon sx={{ minWidth: 36 }}>
        <CasinoIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary="Dice on screen" secondary="How long a rolled d20 rests before it fades. Clicking clears it sooner." />
      <ToggleButtonGroup
        exclusive
        size="small"
        value={dismissSeconds}
        onChange={(_, next: number | null) => next !== null && setDismissSeconds(next)}
        aria-label="How long dice stay on screen"
      >
        {DICE_DISMISS_OPTIONS.map((option) => (
          <ToggleButton key={option} value={option} aria-label={`${option} seconds`} sx={{ px: 1.25 }}>
            {option}s
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </ListItem>
  );
}
