import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { MAX_RELATIVE_SIZE, MIN_RELATIVE_SIZE } from '../../types/token';

interface SizeControlProps {
  currentSize: number;
  defaultSize: number;
  onCurrentChange: (size: number) => void;
  size?: 'small' | 'medium';
}

function clampRelative(value: number): number {
  if (Number.isNaN(value)) return MIN_RELATIVE_SIZE;
  return Math.min(MAX_RELATIVE_SIZE, Math.max(MIN_RELATIVE_SIZE, value));
}

export function SizeControl({ currentSize, defaultSize, onCurrentChange, size = 'small' }: SizeControlProps) {
  const isModified = Math.abs(currentSize - defaultSize) > 0.001;

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <TextField
        type="number"
        size={size}
        variant="standard"
        value={currentSize}
        onChange={(e) => onCurrentChange(clampRelative(Number(e.target.value)))}
        sx={{ width: 44 }}
        slotProps={{
          htmlInput: { step: 0.1, min: MIN_RELATIVE_SIZE, max: MAX_RELATIVE_SIZE, style: { textAlign: 'right' } },
        }}
      />
      <Tooltip title={isModified ? `Reset to default (${defaultSize}×)` : 'At default size'}>
        <span>
          <IconButton size="small" disabled={!isModified} onClick={() => onCurrentChange(defaultSize)}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
