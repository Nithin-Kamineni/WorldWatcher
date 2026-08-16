import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { PRESET_EFFECTS } from '../../../types/effect';
import { useCustomEffectsStore } from '../../../store/useCustomEffectsStore';

interface TokenEffectsEditorProps {
  effects: string[];
  onChange: (effects: string[]) => void;
}

export function TokenEffectsEditor({ effects, onChange }: TokenEffectsEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');
  const customEffectNames = useCustomEffectsStore((state) => state.customEffectNames);
  const addCustomEffect = useCustomEffectsStore((state) => state.addCustomEffect);
  const fetchCustomEffects = useCustomEffectsStore((state) => state.fetchCustomEffects);

  useEffect(() => {
    fetchCustomEffects();
  }, [fetchCustomEffects]);

  const catalog = useMemo(() => {
    const all = [...PRESET_EFFECTS, ...customEffectNames];
    return Array.from(new Set(all));
  }, [customEffectNames]);

  const visibleEffects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalog
      .filter((name) => !query || name.toLowerCase().includes(query))
      .sort((a, b) => {
        const aChecked = effects.includes(a);
        const bChecked = effects.includes(b);
        if (aChecked !== bChecked) return aChecked ? -1 : 1;
        return a.localeCompare(b);
      });
  }, [catalog, search, effects]);

  const toggleEffect = (name: string) => {
    if (effects.includes(name)) {
      onChange(effects.filter((e) => e !== name));
    } else {
      onChange([...effects, name]);
    }
  };

  const handleAddCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    addCustomEffect(trimmed);
    if (!effects.some((e) => e.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...effects, trimmed]);
    }
    setCustomInput('');
  };

  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
        {effects.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            No effects
          </Typography>
        )}
        {effects.map((name) => (
          <Chip key={name} label={name} size="small" onDelete={() => toggleEffect(name)} />
        ))}
        <Tooltip title={expanded ? 'Close effects picker' : 'Add effect'}>
          <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {expanded && (
        <Box sx={{ mt: 1, p: 1, borderRadius: 2, bgcolor: 'background.default' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search effects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.6 }} /> } }}
          />
          <Stack sx={{ maxHeight: 160, overflowY: 'auto', mt: 0.5 }}>
            {visibleEffects.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                No matching effects.
              </Typography>
            )}
            {visibleEffects.map((name) => (
              <Stack
                key={name}
                direction="row"
                spacing={0.5}
                onClick={() => toggleEffect(name)}
                sx={{ alignItems: 'center', cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Checkbox size="small" checked={effects.includes(name)} tabIndex={-1} disableRipple />
                <Typography variant="body2">{name}</Typography>
              </Stack>
            ))}
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, alignItems: 'center' }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Add custom effect..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
            />
            <Tooltip title="Add custom effect">
              <IconButton size="small" onClick={handleAddCustom} disabled={!customInput.trim()}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
