import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import type { Bastion } from '../../types/bastion';

interface BastionFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (bastion: Bastion) => void;
  initialBastion?: Bastion;
}

function emptyState() {
  return { name: '', ownerName: '', notes: '', treasury: 0 };
}

function stateFromBastion(bastion: Bastion) {
  return { name: bastion.name, ownerName: bastion.ownerName, notes: bastion.notes, treasury: bastion.treasury };
}

export function BastionFormDialog({ open, onClose, onSubmit, initialBastion }: BastionFormDialogProps) {
  const isEditMode = !!initialBastion;
  const [state, setState] = useState(emptyState());

  useEffect(() => {
    if (!open) return;
    setState(initialBastion ? stateFromBastion(initialBastion) : emptyState());
  }, [open, initialBastion]);

  const set = <K extends keyof ReturnType<typeof emptyState>>(key: K, value: ReturnType<typeof emptyState>[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const isValid = state.name.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const now = Date.now();
    const bastion: Bastion = {
      id: initialBastion?.id ?? crypto.randomUUID(),
      characterId: initialBastion?.characterId ?? null,
      ownerName: state.ownerName.trim(),
      name: state.name.trim(),
      notes: state.notes.trim(),
      treasury: state.treasury,
      facilities: initialBastion?.facilities ?? [],
      createdAt: initialBastion?.createdAt ?? now,
      updatedAt: now,
    };
    onSubmit(bastion);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEditMode ? 'Edit Bastion' : 'Add Bastion'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField
            label="Bastion Name"
            value={state.name}
            onChange={(e) => set('name', e.target.value)}
            required
            fullWidth
            autoFocus
          />
          <TextField
            label="Owner (PC)"
            value={state.ownerName}
            onChange={(e) => set('ownerName', e.target.value)}
            placeholder="Which player character owns this bastion?"
            fullWidth
          />
          <TextField
            label="Treasury (gp)"
            type="number"
            value={state.treasury}
            onChange={(e) => set('treasury', Number(e.target.value))}
            sx={{ maxWidth: 200 }}
          />
          <TextField
            label="Notes"
            value={state.notes}
            onChange={(e) => set('notes', e.target.value)}
            multiline
            minRows={2}
            maxRows={6}
            fullWidth
            placeholder="Anything else the DM should remember about this bastion…"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid}>
          {isEditMode ? 'Save Changes' : 'Add Bastion'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
