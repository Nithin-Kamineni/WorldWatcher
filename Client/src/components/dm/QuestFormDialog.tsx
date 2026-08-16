import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import { QUEST_DIFFICULTY_PRESETS, QUEST_STATUS_OPTIONS, type Quest, type QuestStatus } from '../../types/quest';
import type { Faction } from '../../types/faction';

interface QuestFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (quest: Quest) => void;
  initialQuest?: Quest;
  factions: Faction[];
}

function emptyState() {
  return {
    name: '',
    description: '',
    status: 'not_started' as QuestStatus,
    difficulty: '',
    location: '',
    npcs: [] as string[],
    relatedFactionIds: [] as string[],
    rewards: '',
    notes: '',
  };
}

function stateFromQuest(quest: Quest) {
  return {
    name: quest.name,
    description: quest.description,
    status: quest.status,
    difficulty: quest.difficulty,
    location: quest.location,
    npcs: quest.npcs,
    relatedFactionIds: quest.relatedFactionIds,
    rewards: quest.rewards,
    notes: quest.notes,
  };
}

export function QuestFormDialog({ open, onClose, onSubmit, initialQuest, factions }: QuestFormDialogProps) {
  const isEditMode = !!initialQuest;
  const [state, setState] = useState(emptyState());

  useEffect(() => {
    if (!open) return;
    setState(initialQuest ? stateFromQuest(initialQuest) : emptyState());
  }, [open, initialQuest]);

  const set = <K extends keyof ReturnType<typeof emptyState>>(key: K, value: ReturnType<typeof emptyState>[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const isValid = state.name.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const now = Date.now();
    const quest: Quest = {
      id: initialQuest?.id ?? crypto.randomUUID(),
      name: state.name.trim(),
      description: state.description.trim(),
      status: state.status,
      difficulty: state.difficulty,
      location: state.location.trim(),
      npcs: state.npcs,
      relatedFactionIds: state.relatedFactionIds,
      objectives: initialQuest?.objectives ?? [],
      rewards: state.rewards.trim(),
      notes: state.notes.trim(),
      createdAt: initialQuest?.createdAt ?? now,
      updatedAt: now,
    };
    onSubmit(quest);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEditMode ? 'Edit Quest' : 'Add Quest'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField label="Name" value={state.name} onChange={(e) => set('name', e.target.value)} required fullWidth autoFocus />
          <TextField
            label="Description"
            value={state.description}
            onChange={(e) => set('description', e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
          />

          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Status"
              value={state.status}
              onChange={(e) => set('status', e.target.value as QuestStatus)}
              sx={{ flex: 1 }}
            >
              {QUEST_STATUS_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              freeSolo
              options={QUEST_DIFFICULTY_PRESETS}
              value={state.difficulty}
              onChange={(_e, value) => set('difficulty', value ?? '')}
              onInputChange={(_e, value) => set('difficulty', value)}
              sx={{ flex: 1 }}
              renderInput={(params) => <TextField {...params} label="Difficulty" placeholder="Easy, Medium, Hard, Deadly…" />}
            />
          </Stack>

          <TextField
            label="Location"
            value={state.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Where this quest takes place"
            fullWidth
          />

          <Autocomplete<string, true, false, true>
            multiple
            freeSolo
            options={[]}
            value={state.npcs}
            onChange={(_e, next) => set('npcs', next as string[])}
            renderValue={(vals, getItemProps) =>
              vals.map((npc, index) => <Chip label={npc} size="small" {...getItemProps({ index })} key={npc} />)
            }
            renderInput={(params) => <TextField {...params} label="NPCs Involved" placeholder="Type and press Enter" />}
          />

          <Autocomplete
            multiple
            options={factions.map((f) => f.id)}
            getOptionLabel={(id) => factions.find((f) => f.id === id)?.name ?? id}
            value={state.relatedFactionIds}
            onChange={(_e, next) => set('relatedFactionIds', next)}
            renderInput={(params) => <TextField {...params} label="Related Factions" placeholder="Pick factions…" />}
          />

          <TextField
            label="Reward"
            value={state.rewards}
            onChange={(e) => set('rewards', e.target.value)}
            placeholder="500 gp, a magic item, a favor…"
            fullWidth
          />

          <Divider />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Notes
          </Typography>
          <TextField
            value={state.notes}
            onChange={(e) => set('notes', e.target.value)}
            multiline
            minRows={2}
            maxRows={6}
            fullWidth
            placeholder="Anything else the DM should remember about this quest…"
          />
          <Typography variant="caption" color="text.secondary">
            Sub-quests are added and ticked off from the quest row itself - expand it after saving.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid}>
          {isEditMode ? 'Save Changes' : 'Add Quest'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
