import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { getEncounterFallbackImage, type Encounter } from '../../types/encounter';
import { TokenThumbnail } from '../map/TokenThumbnail';
import type { RandomEncounterTable, RandomEncounterTableEntry } from '../../types/randomEncounterTable';

interface RandomEncounterTableFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (table: RandomEncounterTable) => void;
  initialTable?: RandomEncounterTable;
  encounters: Encounter[];
  campaignId: string;
}

function emptyState() {
  return { name: '', dieExpression: '1d8', entries: [] as RandomEncounterTableEntry[] };
}

function stateFromTable(table: RandomEncounterTable) {
  return { name: table.name, dieExpression: table.dieExpression, entries: table.entries };
}

export function RandomEncounterTableFormDialog({
  open,
  onClose,
  onSubmit,
  initialTable,
  encounters,
  campaignId,
}: RandomEncounterTableFormDialogProps) {
  const isEditMode = !!initialTable;
  const [state, setState] = useState(emptyState());

  useEffect(() => {
    if (!open) return;
    setState(initialTable ? stateFromTable(initialTable) : emptyState());
  }, [open, initialTable]);

  const isValid = state.name.trim().length > 0 && state.entries.length > 0;

  const availableEncounters = encounters.filter((e) => !state.entries.some((entry) => entry.encounterId === e.id));

  const addEncounter = (encounter: Encounter | null) => {
    if (!encounter) return;
    setState((prev) => ({ ...prev, entries: [...prev.entries, { id: crypto.randomUUID(), encounterId: encounter.id }] }));
  };

  const removeEntry = (id: string) => {
    setState((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }));
  };

  const moveEntry = (index: number, direction: -1 | 1) => {
    setState((prev) => {
      const next = [...prev.entries];
      const swapWith = index + direction;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return { ...prev, entries: next };
    });
  };

  const handleSubmit = () => {
    if (!isValid) return;
    const now = Date.now();
    const table: RandomEncounterTable = {
      id: initialTable?.id ?? crypto.randomUUID(),
      campaignId,
      name: state.name.trim(),
      dieExpression: state.dieExpression.trim() || '1d8',
      entries: state.entries,
      createdAt: initialTable?.createdAt ?? now,
      updatedAt: now,
    };
    onSubmit(table);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEditMode ? 'Edit Random Encounter Table' : 'New Random Encounter Table'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField
            label="Name"
            value={state.name}
            onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
            required
            fullWidth
            autoFocus
          />
          <TextField
            label="Die to roll"
            value={state.dieExpression}
            onChange={(e) => setState((prev) => ({ ...prev, dieExpression: e.target.value }))}
            helperText="e.g. 1d8, 1d20 - the roll maps onto your encounters below in order, wrapping if there are fewer entries than faces"
            sx={{ maxWidth: 220 }}
          />

          <Autocomplete
            options={availableEncounters}
            getOptionLabel={(e) => e.name}
            value={null}
            onChange={(_e, value) => addEncounter(value)}
            renderInput={(params) => <TextField {...params} label="Add an encounter" placeholder="Search encounters…" />}
          />

          <Stack spacing={0.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Encounters in this table
            </Typography>
            {state.entries.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Add at least one encounter above.
              </Typography>
            )}
            {state.entries.map((entry, index) => {
              const encounter = encounters.find((e) => e.id === entry.encounterId);
              return (
                <Stack
                  key={entry.id}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', p: 0.75, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ width: 20 }}>
                    {index + 1}
                  </Typography>
                  <TokenThumbnail
                    src={encounter ? getEncounterFallbackImage(encounter) : ''}
                    name={encounter?.name ?? '?'}
                    size={28}
                  />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                      {encounter?.name ?? 'Unknown encounter'}
                    </Typography>
                  </Box>
                  <Tooltip title="Move up">
                    <span>
                      <IconButton size="small" disabled={index === 0} onClick={() => moveEntry(index, -1)}>
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move down">
                    <span>
                      <IconButton size="small" disabled={index === state.entries.length - 1} onClick={() => moveEntry(index, 1)}>
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Remove">
                    <IconButton size="small" onClick={() => removeEntry(entry.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              );
            })}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid}>
          {isEditMode ? 'Save Changes' : 'Create Table'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
