import { useState } from 'react';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface MapNumberInputPopoverProps {
  open: boolean;
  anchorPosition: { top: number; left: number };
  title: string;
  targetCount: number;
  onSubmit: (amount: number) => void;
  onClose: () => void;
}

/** The "small temp tab" bulk quick-action popover - one numeric value applied to every
 * currently-selected token at once (Apply Damage/Healing/Temporary HP hotkeys). */
export function MapNumberInputPopover({
  open,
  anchorPosition,
  title,
  targetCount,
  onSubmit,
  onClose,
}: MapNumberInputPopoverProps) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount > 0) onSubmit(amount);
    setValue('');
    onClose();
  };

  return (
    <Popover
      open={open}
      onClose={() => {
        setValue('');
        onClose();
      }}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition}
      anchorOrigin={{ vertical: 'center', horizontal: 'center' }}
      transformOrigin={{ vertical: 'center', horizontal: 'center' }}
    >
      <Stack spacing={1.5} sx={{ p: 2, width: 240 }}>
        <Typography variant="subtitle2">
          {title}
          {targetCount > 1 ? ` (${targetCount} combatants)` : ''}
        </Typography>
        <TextField
          autoFocus
          type="number"
          size="small"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          slotProps={{ htmlInput: { min: 1 } }}
        />
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={handleSubmit}>
            Apply
          </Button>
        </Stack>
      </Stack>
    </Popover>
  );
}
