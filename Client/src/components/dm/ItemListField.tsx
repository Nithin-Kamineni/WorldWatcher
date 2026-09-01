import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import CasinoIcon from '@mui/icons-material/Casino';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';

interface ItemListFieldProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  /** Returns one candidate value from the randomizer bank; called a few times to try to
   * avoid appending an exact duplicate of what's already in the list. */
  onPickRandom: () => string;
  /** Omit for callers with no "randomize all" lock concept (e.g. ArticleForm) - defaults to
   * unlocked with no lock toggle shown. */
  locked?: boolean;
  onToggleLock?: () => void;
  placeholder?: string;
}

const MAX_RANDOM_ATTEMPTS = 5;

/** Itemized multi-value field: a chip per entry (deletable), a dice button that appends one
 * random pick from a bank, and a small text input to add custom entries - the itemized
 * counterpart to FieldRandomizer's single-value overwrite for fields like NPC Personality/
 * Appearance/Secrets/Relationships where an NPC can have several at once. */
export function ItemListField({ label, items, onChange, onPickRandom, locked = false, onToggleLock, placeholder }: ItemListFieldProps) {
  const [draft, setDraft] = useState('');

  const addItem = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onChange([...items, trimmed]);
  };

  const handleAddDraft = () => {
    addItem(draft);
    setDraft('');
  };

  const handleRandomAdd = () => {
    if (locked) return;
    let pick = '';
    for (let i = 0; i < MAX_RANDOM_ATTEMPTS; i++) {
      pick = onPickRandom();
      if (pick && !items.includes(pick)) break;
    }
    if (pick) addItem(pick);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        {onToggleLock && (
          <Tooltip title={locked ? 'Unlock field' : 'Lock field (protects it from randomizing)'}>
            <IconButton size="small" onClick={onToggleLock} color={locked ? 'primary' : 'default'}>
              {locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={locked ? 'Field is locked' : 'Add a random entry'}>
          <span>
            <IconButton size="small" onClick={handleRandomAdd} disabled={locked}>
              <CasinoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        {items.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            None yet
          </Typography>
        )}
        {items.map((item, index) => (
          <Chip key={`${item}-${index}`} label={item} size="small" onDelete={() => removeItem(index)} sx={{ maxWidth: '100%' }} />
        ))}
      </Stack>

      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <TextField
          size="small"
          fullWidth
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder ?? 'Add a custom entry…'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddDraft();
            }
          }}
        />
        <Tooltip title="Add entry">
          <span>
            <IconButton size="small" onClick={handleAddDraft} disabled={!draft.trim()}>
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}
