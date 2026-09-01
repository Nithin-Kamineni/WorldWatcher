import { useState } from 'react';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface MapTextInputPopoverProps {
  open: boolean;
  anchorPosition: { top: number; left: number };
  title: string;
  initialValue: string;
  multiline?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

/** Small popover for the hotkey-triggered single-text-field combatant actions - Rename, Add
 * Tag, Update Persistent Notes - each just needs one string in, no dedicated dialog. */
export function MapTextInputPopover({
  open,
  anchorPosition,
  title,
  initialValue,
  multiline,
  onSubmit,
  onClose,
}: MapTextInputPopoverProps) {
  const [value, setValue] = useState(initialValue);

  // Re-seed the field's starting value whenever a fresh popover instance opens (key trick
  // below avoids needing an effect just to sync a prop into local state).
  const handleSubmit = () => {
    onSubmit(value);
    onClose();
  };

  return (
    <Popover
      key={open ? `${title}-${initialValue}` : 'closed'}
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition}
      anchorOrigin={{ vertical: 'center', horizontal: 'center' }}
      transformOrigin={{ vertical: 'center', horizontal: 'center' }}
    >
      <Stack spacing={1.5} sx={{ p: 2, width: 280 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <TextField
          autoFocus
          size="small"
          multiline={multiline}
          minRows={multiline ? 3 : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !multiline) handleSubmit();
          }}
        />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={handleSubmit}>
            Save
          </Button>
        </Stack>
      </Stack>
    </Popover>
  );
}
