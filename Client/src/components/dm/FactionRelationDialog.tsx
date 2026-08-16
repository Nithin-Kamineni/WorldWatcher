import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import {
  RELATION_TYPES,
  RELATION_TYPE_META,
  type FactionRelation,
  type FactionRelationType,
} from '../../types/factionRelation';
import type { Faction } from '../../types/faction';

interface FactionRelationDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (relation: FactionRelation) => void;
  onDelete?: () => void;
  factions: Faction[];
  campaignId: string;
  factionAId: string;
  factionBId: string;
  initialRelation?: FactionRelation;
}

export function FactionRelationDialog({
  open,
  onClose,
  onSubmit,
  onDelete,
  factions,
  campaignId,
  factionAId,
  factionBId,
  initialRelation,
}: FactionRelationDialogProps) {
  const [type, setType] = useState<FactionRelationType>('neutral');
  const [strength, setStrength] = useState(40);
  const [treaties, setTreaties] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setType(initialRelation?.type ?? 'neutral');
    setStrength(initialRelation?.strength ?? 40);
    setTreaties(initialRelation?.treaties ?? []);
    setNotes(initialRelation?.notes ?? '');
  }, [open, initialRelation]);

  const factionA = factions.find((f) => f.id === factionAId);
  const factionB = factions.find((f) => f.id === factionBId);

  const handleSubmit = () => {
    const relation: FactionRelation = {
      id: initialRelation?.id ?? crypto.randomUUID(),
      campaignId,
      factionAId,
      factionBId,
      type,
      strength,
      treaties,
      notes: notes.trim(),
    };
    onSubmit(relation);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {factionA?.name ?? 'Faction'} &harr; {factionB?.name ?? 'Faction'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField
            select
            label="Diplomatic status"
            value={type}
            onChange={(e) => setType(e.target.value as FactionRelationType)}
            fullWidth
          >
            {RELATION_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {RELATION_TYPE_META[t].label}
              </MenuItem>
            ))}
          </TextField>

          <Stack spacing={0.5}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2">Relationship strength</Typography>
              <Typography variant="body2" color="text.secondary">
                {strength}
              </Typography>
            </Stack>
            <Slider size="small" value={strength} min={0} max={100} onChange={(_e, v) => setStrength(v as number)} />
          </Stack>

          <Autocomplete<string, true, false, true>
            multiple
            freeSolo
            options={[]}
            value={treaties}
            onChange={(_e, next) => setTreaties(next as string[])}
            renderValue={(vals, getItemProps) =>
              vals.map((tag, index) => <Chip label={tag} size="small" {...getItemProps({ index })} key={tag} />)
            }
            renderInput={(params) => <TextField {...params} label="Treaties" placeholder="Type and press Enter" />}
          />

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {onDelete && (
          <Button onClick={onDelete} color="error" sx={{ mr: 'auto' }}>
            Remove relation
          </Button>
        )}
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
