import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Avatar from '@mui/material/Avatar';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { isAllowedImageFile } from '../../utils/fileValidation';
import type { Spell } from '../../types/spell';

interface SpellFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (spell: Spell) => void;
  initialSpell?: Spell;
}

function emptyState() {
  return {
    name: '',
    level: 1,
    school: '',
    castingTime: '1 action',
    range: '',
    components: 'V, S',
    duration: '',
    classes: '',
    description: '',
    imageSrc: '',
  };
}

function stateFromSpell(spell: Spell) {
  return {
    name: spell.name,
    level: spell.level,
    school: spell.school,
    castingTime: spell.castingTime,
    range: spell.range,
    components: spell.components,
    duration: spell.duration,
    classes: spell.classes ?? '',
    description: spell.description,
    imageSrc: spell.imageSrc,
  };
}

export function SpellFormDialog({ open, onClose, onSubmit, initialSpell }: SpellFormDialogProps) {
  const isEditMode = !!initialSpell;
  const [state, setState] = useState(emptyState());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setState(initialSpell ? stateFromSpell(initialSpell) : emptyState());
  }, [open, initialSpell]);

  const set = <K extends keyof ReturnType<typeof emptyState>>(key: K, value: ReturnType<typeof emptyState>[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isAllowedImageFile(file)) return;
    set('imageSrc', URL.createObjectURL(file));
  };

  const isValid = state.name.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const now = Date.now();
    const spell: Spell = {
      id: initialSpell?.id ?? crypto.randomUUID(),
      name: state.name.trim(),
      level: state.level,
      school: state.school.trim(),
      castingTime: state.castingTime.trim(),
      range: state.range.trim(),
      components: state.components.trim(),
      duration: state.duration.trim(),
      classes: state.classes.trim() || undefined,
      description: state.description.trim(),
      imageSrc: state.imageSrc,
      createdAt: initialSpell?.createdAt ?? now,
      updatedAt: now,
    };
    onSubmit(spell);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEditMode ? 'Edit Spell' : 'Add Spell'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            {state.imageSrc ? (
              <Avatar src={state.imageSrc} variant="rounded" sx={{ width: 56, height: 56 }} />
            ) : (
              <Avatar variant="rounded" sx={{ width: 56, height: 56 }}>
                {state.name.charAt(0) || '?'}
              </Avatar>
            )}
            <Button size="small" variant="outlined" startIcon={<AddPhotoAlternateIcon />} onClick={() => fileInputRef.current?.click()}>
              Upload spell image
            </Button>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={handleFileSelected} />
          </Stack>

          <TextField label="Name" value={state.name} onChange={(e) => set('name', e.target.value)} required fullWidth autoFocus />
          <Grid container spacing={2}>
            <Grid size={4}>
              <TextField
                label="Level (0 = cantrip)"
                type="number"
                value={state.level}
                onChange={(e) => set('level', Number(e.target.value))}
                fullWidth
                size="small"
                slotProps={{ htmlInput: { min: 0, max: 9 } }}
              />
            </Grid>
            <Grid size={8}>
              <TextField label="School" value={state.school} onChange={(e) => set('school', e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid size={6}>
              <TextField label="Casting time" value={state.castingTime} onChange={(e) => set('castingTime', e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid size={6}>
              <TextField label="Range" value={state.range} onChange={(e) => set('range', e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid size={6}>
              <TextField label="Components" value={state.components} onChange={(e) => set('components', e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid size={6}>
              <TextField label="Duration" value={state.duration} onChange={(e) => set('duration', e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid size={12}>
              <TextField label="Classes" value={state.classes} onChange={(e) => set('classes', e.target.value)} fullWidth size="small" placeholder="Wizard, Sorcerer…" />
            </Grid>
          </Grid>
          <TextField
            label="Description"
            value={state.description}
            onChange={(e) => set('description', e.target.value)}
            fullWidth
            multiline
            minRows={3}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid}>
          {isEditMode ? 'Save Changes' : 'Add Spell'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
