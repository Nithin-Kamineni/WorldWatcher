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
import { EFFECT_GROUP_LABELS, type EffectCatalogEntry, type EffectGroup } from '../../../types/effect';
import { useEffectCatalogStore } from '../../../store/useEffectCatalogStore';

interface TokenEffectsEditorProps {
  effects: string[];
  onChange: (effects: string[]) => void;
}

const GROUP_ORDER: EffectGroup[] = ['condition', 'status', 'spell', 'disease', 'custom'];

export function TokenEffectsEditor({ effects, onChange }: TokenEffectsEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');
  const entries = useEffectCatalogStore((state) => state.entries);
  const addCustomEffect = useEffectCatalogStore((state) => state.addCustomEffect);
  const fetchCatalog = useEffectCatalogStore((state) => state.fetchCatalog);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  /** Rules text keyed by name, so an applied chip can explain itself without reopening the picker. */
  const descriptionByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of entries) {
      if (entry.description) map.set(entry.name.toLowerCase(), entry.description);
    }
    return map;
  }, [entries]);

  /**
   * Applied effects float to the top of their own group so a mid-combat glance
   * confirms what is already on the token before scrolling for the next one.
   */
  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const applied = new Set(effects.map((name) => name.toLowerCase()));
    const matching = entries.filter((entry) => !query || entry.name.toLowerCase().includes(query));
    return GROUP_ORDER.map((group) => ({
      group,
      items: matching
        .filter((entry) => entry.group === group)
        .sort((a, b) => {
          const aOn = applied.has(a.name.toLowerCase());
          const bOn = applied.has(b.name.toLowerCase());
          if (aOn !== bOn) return aOn ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    })).filter((section) => section.items.length > 0);
  }, [entries, search, effects]);

  const totalVisible = groups.reduce((sum, section) => sum + section.items.length, 0);

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

  const renderRow = (entry: EffectCatalogEntry) => {
    const row = (
      <Stack
        direction="row"
        spacing={0.5}
        onClick={() => toggleEffect(entry.name)}
        sx={{ alignItems: 'center', cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Checkbox size="small" checked={effects.includes(entry.name)} tabIndex={-1} disableRipple />
        <Typography variant="body2" noWrap>
          {entry.name}
        </Typography>
      </Stack>
    );
    if (!entry.description) return <Box key={entry.name}>{row}</Box>;
    return (
      <Tooltip
        key={entry.name}
        title={entry.description}
        placement="right"
        enterDelay={400}
        slotProps={{ tooltip: { sx: { maxWidth: 320, whiteSpace: 'pre-line' } } }}
      >
        <Box>{row}</Box>
      </Tooltip>
    );
  };

  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
        {effects.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            No effects
          </Typography>
        )}
        {effects.map((name) => {
          const description = descriptionByName.get(name.toLowerCase());
          const chip = <Chip label={name} size="small" onDelete={() => toggleEffect(name)} />;
          return description ? (
            <Tooltip
              key={name}
              title={description}
              enterDelay={400}
              slotProps={{ tooltip: { sx: { maxWidth: 320, whiteSpace: 'pre-line' } } }}
            >
              <span>{chip}</span>
            </Tooltip>
          ) : (
            <span key={name}>{chip}</span>
          );
        })}
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
          <Stack sx={{ maxHeight: 200, overflowY: 'auto', mt: 0.5 }}>
            {totalVisible === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                No matching effects.
              </Typography>
            )}
            {groups.map((section) => (
              <Box key={section.group}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'block',
                    px: 0.5,
                    pt: 0.75,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    fontSize: 10,
                  }}
                >
                  {EFFECT_GROUP_LABELS[section.group]}
                </Typography>
                {section.items.map(renderRow)}
              </Box>
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
