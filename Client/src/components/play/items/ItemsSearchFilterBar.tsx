import { useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import { thinScrollbarSx, FLOATING_SCROLLBAR_CLASS } from '../../../theme/scrollbarSx';

export interface FilterGroupOption {
  value: string;
  label: string;
}

export interface FilterGroupDef {
  key: string;
  label: string;
  options: FilterGroupOption[];
}

interface FilterGroupSectionProps {
  group: FilterGroupDef;
  selected: string[];
  onToggle: (value: string) => void;
}

/** One filter group inside the popover - has its own small search box to narrow a long option
 * list down (issues.txt 10.c.3a: "filter options should themselves have a search"), so this
 * scales to a large/growing catalog without becoming an unscrollable wall of chips. */
function FilterGroupSection({ group, selected, onToggle }: FilterGroupSectionProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return group.options;
    return group.options.filter((o) => o.label.toLowerCase().includes(q));
  }, [group.options, query]);

  if (group.options.length === 0) return null;

  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {group.label}
      </Typography>
      {group.options.length > 8 && (
        <TextField
          size="small"
          fullWidth
          placeholder={`Filter ${group.label.toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ mb: 0.75 }}
          slotProps={{ input: { sx: { fontSize: 13 } } }}
        />
      )}
      <Stack
        direction="row"
        spacing={0.5}
        useFlexGap
        className={FLOATING_SCROLLBAR_CLASS}
        sx={{ flexWrap: 'wrap', maxHeight: 140, overflowY: 'auto', ...thinScrollbarSx }}
      >
        {filtered.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            No matches
          </Typography>
        )}
        {filtered.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            size="small"
            color={selected.includes(option.value) ? 'primary' : 'default'}
            variant={selected.includes(option.value) ? 'filled' : 'outlined'}
            onClick={() => onToggle(option.value)}
          />
        ))}
      </Stack>
    </Box>
  );
}

interface ItemsSearchFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  groups: FilterGroupDef[];
  selected: Record<string, string[]>;
  onToggle: (groupKey: string, value: string) => void;
  onClear: () => void;
  /** e.g. Stats' All/Creature/Spell/Magic-Item toggle - rendered above search+filter. */
  extra?: ReactNode;
  /** Replaces the built-in search box, keeping the filter popover and layout. Used by Random
   * Tables, whose search is a counted suggestion field (RandomTableSearchField) rather than a
   * plain text box; `search`/`onSearchChange` are then owned by that field. */
  searchSlot?: ReactNode;
  /** Right-hand actions on the search row (e.g. a "clear everything" button). */
  trailing?: ReactNode;
}

/** One-row search + filter-popover bar shared by all 4 Items sub-windows (issues.txt 10.c.3a,
 * generalizing EncountersTokenTab's one-off inline filter Popover into a reusable, scalable
 * component with per-group option search built in). */
export function ItemsSearchFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  groups,
  selected,
  onToggle,
  onClear,
  extra,
  searchSlot,
  trailing,
}: ItemsSearchFilterBarProps) {
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const activeFilterCount = Object.values(selected).reduce((sum, values) => sum + values.length, 0);

  return (
    <Box sx={{ px: 1.5, pt: 1.25, pb: 1 }}>
      {extra && <Box sx={{ mb: 1 }}>{extra}</Box>}
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        {searchSlot ? (
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>{searchSlot}</Box>
        ) : (
          <TextField
            size="small"
            fullWidth
            placeholder={searchPlaceholder ?? 'Search…'}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
            }}
          />
        )}
        {groups.length > 0 && (
          <Tooltip title="Filters">
            <IconButton
              size="small"
              onClick={(e) => setFilterAnchor(e.currentTarget)}
              color={activeFilterCount > 0 ? 'primary' : 'default'}
              sx={{ border: 1, borderColor: activeFilterCount > 0 ? 'primary.main' : 'divider' }}
            >
              <FilterListIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {trailing}
      </Stack>

      <Popover
        open={!!filterAnchor}
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 1.5, width: 260 }}>
          {groups.map((group) => (
            <FilterGroupSection key={group.key} group={group} selected={selected[group.key] ?? []} onToggle={(v) => onToggle(group.key, v)} />
          ))}
          {activeFilterCount > 0 && (
            <>
              <Divider sx={{ my: 1 }} />
              <Button size="small" fullWidth onClick={onClear}>
                Clear filters
              </Button>
            </>
          )}
        </Box>
      </Popover>
    </Box>
  );
}
