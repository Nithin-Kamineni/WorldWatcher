import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import { SHORTCUT_ACTIONS } from '../../types/shortcut';
import { getEffectiveCombo, getEffectiveToolbar, type ShortcutOverride } from '../../store/useShortcutStore';
import { formatCombo } from '../../types/shortcut';

interface ShortcutQuickBarProps {
  overrides: Record<string, ShortcutOverride>;
  hasTarget: boolean;
  onAction: (actionId: string) => void;
}

/** Floating icon-button bar reflecting the settings dialog's per-action "Toolbar" checkbox -
 * only wired actions with that checkbox on ever show up here. Combatant-category buttons
 * disable themselves (with an explanatory tooltip) when there's nothing to act on. */
export function ShortcutQuickBar({ overrides, hasTarget, onAction }: ShortcutQuickBarProps) {
  const encounterActions = SHORTCUT_ACTIONS.filter(
    (a) => a.category === 'encounter' && a.wired && getEffectiveToolbar(overrides, a.id),
  );
  const combatantActions = SHORTCUT_ACTIONS.filter(
    (a) => a.category === 'combatant' && a.wired && getEffectiveToolbar(overrides, a.id),
  );

  if (encounterActions.length === 0 && combatantActions.length === 0) return null;

  return (
    <Paper
      elevation={4}
      sx={{
        pointerEvents: 'auto',
        bgcolor: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(3px)',
        borderRadius: 3,
        px: 1,
        py: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        width: 'fit-content',
      }}
    >
      <Stack direction="row" spacing={0.25}>
        {encounterActions.map((action) => {
          const Icon = action.icon;
          return (
            <Tooltip key={action.id} title={`${action.label} (${formatCombo(getEffectiveCombo(overrides, action.id))})`}>
              <IconButton size="small" onClick={() => onAction(action.id)} sx={{ color: 'common.white' }}>
                <Icon fontSize="small" />
              </IconButton>
            </Tooltip>
          );
        })}
      </Stack>

      {encounterActions.length > 0 && combatantActions.length > 0 && (
        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)', mx: 0.5 }} />
      )}

      <Stack direction="row" spacing={0.25}>
        {combatantActions.map((action) => {
          const Icon = action.icon;
          const combo = formatCombo(getEffectiveCombo(overrides, action.id));
          return (
            <Tooltip
              key={action.id}
              title={hasTarget ? `${action.label} (${combo})` : `${action.label} (${combo}) - select a combatant first`}
            >
              <span>
                <IconButton
                  size="small"
                  disabled={!hasTarget}
                  onClick={() => onAction(action.id)}
                  sx={{ color: 'common.white' }}
                >
                  <Icon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          );
        })}
      </Stack>
    </Paper>
  );
}
