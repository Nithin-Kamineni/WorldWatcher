import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CasinoIcon from '@mui/icons-material/Casino';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';

interface FieldRandomizerProps {
  locked: boolean;
  onToggleLock: () => void;
  onRandomize: () => void;
  size?: 'small' | 'medium';
}

/** Lock/dice pair for a single randomizable field - locking prevents both this field's own
 * dice and the form-wide "randomize all" from touching the field until unlocked again. */
export function FieldRandomizer({ locked, onToggleLock, onRandomize, size = 'small' }: FieldRandomizerProps) {
  return (
    <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
      <Tooltip title={locked ? 'Unlock field' : 'Lock field (protects it from randomizing)'}>
        <IconButton size={size} onClick={onToggleLock} color={locked ? 'primary' : 'default'}>
          {locked ? <LockIcon fontSize={size} /> : <LockOpenIcon fontSize={size} />}
        </IconButton>
      </Tooltip>
      <Tooltip title={locked ? 'Field is locked' : 'Randomize this field'}>
        <span>
          <IconButton size={size} onClick={onRandomize} disabled={locked}>
            <CasinoIcon fontSize={size} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
