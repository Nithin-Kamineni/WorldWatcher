import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Avatar from '@mui/material/Avatar';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { isAllowedImageFile } from '../../utils/fileValidation';
import { MAGIC_ITEM_RARITY_OPTIONS, type MagicItem, type MagicItemRarity } from '../../types/magicItem';

interface MagicItemFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (item: MagicItem) => void;
  initialItem?: MagicItem;
}

function emptyState() {
  return {
    name: '',
    type: '',
    rarity: 'common' as MagicItemRarity,
    attunement: false,
    attunementRequirement: '',
    description: '',
    imageSrc: '',
  };
}

function stateFromItem(item: MagicItem) {
  return {
    name: item.name,
    type: item.type,
    rarity: item.rarity,
    attunement: item.attunement,
    attunementRequirement: item.attunementRequirement ?? '',
    description: item.description,
    imageSrc: item.imageSrc,
  };
}

export function MagicItemFormDialog({ open, onClose, onSubmit, initialItem }: MagicItemFormDialogProps) {
  const isEditMode = !!initialItem;
  const [state, setState] = useState(emptyState());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setState(initialItem ? stateFromItem(initialItem) : emptyState());
  }, [open, initialItem]);

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
    const item: MagicItem = {
      id: initialItem?.id ?? crypto.randomUUID(),
      name: state.name.trim(),
      type: state.type.trim(),
      rarity: state.rarity,
      attunement: state.attunement,
      attunementRequirement: state.attunement ? state.attunementRequirement.trim() || undefined : undefined,
      description: state.description.trim(),
      imageSrc: state.imageSrc,
      createdAt: initialItem?.createdAt ?? now,
      updatedAt: now,
    };
    onSubmit(item);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEditMode ? 'Edit Magic Item' : 'Add Magic Item'}</DialogTitle>
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
              Upload item image
            </Button>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={handleFileSelected} />
          </Stack>

          <TextField label="Name" value={state.name} onChange={(e) => set('name', e.target.value)} required fullWidth autoFocus />
          <TextField label="Type" value={state.type} onChange={(e) => set('type', e.target.value)} fullWidth placeholder="Weapon, wondrous item…" />
          <FormControl fullWidth>
            <InputLabel id="rarity-label">Rarity</InputLabel>
            <Select
              labelId="rarity-label"
              label="Rarity"
              value={state.rarity}
              onChange={(e) => set('rarity', e.target.value as MagicItemRarity)}
            >
              {MAGIC_ITEM_RARITY_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Checkbox checked={state.attunement} onChange={(e) => set('attunement', e.target.checked)} />}
            label="Requires attunement"
          />
          {state.attunement && (
            <TextField
              label="Attunement requirement"
              value={state.attunementRequirement}
              onChange={(e) => set('attunementRequirement', e.target.value)}
              fullWidth
              placeholder="By a spellcaster…"
            />
          )}
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
          {isEditMode ? 'Save Changes' : 'Add Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
