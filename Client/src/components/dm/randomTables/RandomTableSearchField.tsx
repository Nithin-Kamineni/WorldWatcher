import { useMemo } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CasinoOutlinedIcon from '@mui/icons-material/CasinoOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { categoryPath } from '../../../store/useCategoryStore';
import {
  computeCategoryCounts,
  computeTagCounts,
  filterTablesByQuery,
  normalizeSearchText,
  queryTokens,
  rankTablesByQuery,
  tokenMatchesFuzzy,
  type TableSearchIndex,
  type TableUsefulnessSignals,
} from './tableSearch';
import type { Category } from '../../../types/category';
import type { RandomTable } from '../../../types/randomTable';
import type { Tag } from '../../../types/tag';

type Suggestion =
  | { key: string; group: string; kind: 'table'; label: string; secondary: string; table: RandomTable }
  | { key: string; group: string; kind: 'category'; label: string; secondary: string; count: number; id: string }
  | { key: string; group: string; kind: 'tag'; label: string; secondary: string; count: number; id: string };

interface RandomTableSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** The library in the current scope, before the text query is applied - facet counts are
   * computed against this so "how many tables sit under this tag/category" stays meaningful
   * while the typed text narrows the table suggestions. */
  tables: RandomTable[];
  index: TableSearchIndex;
  flatCategories: Category[];
  tags: Tag[];
  onPickTable?: (table: RandomTable) => void;
  onPickCategory?: (categoryId: string) => void;
  onPickTag?: (tagId: string) => void;
  placeholder?: string;
  size?: 'small' | 'medium';
  /** Play sub-window variant - drops the field label and narrows the dropdown. */
  dense?: boolean;
  /** Rolls/pins/ownership signals, so the first suggestion is the table this DM actually
   * reaches for rather than whichever match sorts first alphabetically. */
  usefulness?: TableUsefulnessSignals;
}

const MAX_PER_GROUP = 8;

/** The "easy random table search" field: one box that searches names, descriptions, source
 * books, category paths and tag labels at once, and whose dropdown answers "how many tables am
 * I actually looking at?" - a live match count on the field itself, a count on every group
 * header, and a per-item count on each suggested category and tag. Picking a table/category/tag
 * suggestion is a shortcut into that table, that branch, or that tag as a filter.
 *
 * Shared by the Encounters page browse view and the Play page's Random Tables sub-window so
 * both search the same way. */
export function RandomTableSearchField({
  value,
  onChange,
  tables,
  index,
  flatCategories,
  tags,
  onPickTable,
  onPickCategory,
  onPickTag,
  placeholder = 'Search tables, categories, tags...',
  size = 'small',
  dense = false,
  usefulness,
}: RandomTableSearchFieldProps) {
  const categoryCounts = useMemo(() => computeCategoryCounts(tables, flatCategories), [tables, flatCategories]);
  const tagCounts = useMemo(() => computeTagCounts(tables), [tables]);
  const matches = useMemo(() => filterTablesByQuery(tables, value, index), [tables, value, index]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const tokens = queryTokens(value);
    const matchedCategories = flatCategories
      .filter((category) => (categoryCounts.get(category.id) ?? 0) > 0)
      .filter((category) => tokens.length === 0 || tokens.every((token) => tokenMatchesFuzzy(token, normalizeSearchText(category.name))))
      .sort((a, b) => (categoryCounts.get(b.id) ?? 0) - (categoryCounts.get(a.id) ?? 0));
    const matchedTags = tags
      .filter((tag) => (tagCounts.get(tag.id) ?? 0) > 0)
      .filter(
        (tag) =>
          tokens.length === 0 ||
          tokens.every((token) => tokenMatchesFuzzy(token, normalizeSearchText(`${tag.namespace}:${tag.value} ${tag.label}`))),
      )
      .sort((a, b) => (tagCounts.get(b.id) ?? 0) - (tagCounts.get(a.id) ?? 0));

    const tableGroup = `Tables - ${matches.length}`;
    const categoryGroup = `Categories - ${matchedCategories.length}`;
    const tagGroup = `Tags - ${matchedTags.length}`;

    // With nothing typed the dropdown is a discovery aid (the busiest branches and tags) rather
    // than a match list, so the table group is left out until there is a query.
    const tableSuggestions: Suggestion[] =
      tokens.length === 0
        ? []
        : rankTablesByQuery(matches, value, usefulness)
            .slice(0, MAX_PER_GROUP)
            .map((table) => ({
              key: `table:${table.id}`,
              group: tableGroup,
              kind: 'table' as const,
              label: table.name,
              secondary: categoryPath(flatCategories, table.categoryId) || 'Uncategorized',
              table,
            }));

    return [
      ...tableSuggestions,
      ...matchedCategories.slice(0, MAX_PER_GROUP).map((category) => ({
        key: `category:${category.id}`,
        group: categoryGroup,
        kind: 'category' as const,
        label: category.name,
        secondary: categoryPath(flatCategories, category.parentId) || 'Top level',
        count: categoryCounts.get(category.id) ?? 0,
        id: category.id,
      })),
      ...matchedTags.slice(0, MAX_PER_GROUP).map((tag) => ({
        key: `tag:${tag.id}`,
        group: tagGroup,
        kind: 'tag' as const,
        label: tag.label || `${tag.namespace}:${tag.value}`,
        secondary: tag.namespace,
        count: tagCounts.get(tag.id) ?? 0,
        id: tag.id,
      })),
    ];
  }, [value, matches, flatCategories, tags, categoryCounts, tagCounts, usefulness]);

  return (
    <Autocomplete<Suggestion, false, false, true>
      freeSolo
      openOnFocus
      handleHomeEndKeys
      clearOnBlur={false}
      blurOnSelect
      size={size}
      options={suggestions}
      inputValue={value}
      value={null}
      // Suggestions are already ranked and filtered above (and deliberately include facets that
      // do not match the typed text by name), so MUI's own substring filter must not re-run.
      filterOptions={(options) => options}
      groupBy={(option) => option.group}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
      // Only the user's own keystrokes (and the clear button) may change the query. Picking a
      // suggestion must never rewrite the box with that suggestion's label, which is what MUI
      // does by default - here a pick is an action (open the table / add the facet), and the
      // query the DM typed has to survive it.
      onInputChange={(_event, next, reason) => {
        if (reason === 'input') onChange(next);
        else if (reason === 'clear') onChange('');
      }}
      onChange={(_event, picked) => {
        if (!picked || typeof picked === 'string') return;
        if (picked.kind === 'table') onPickTable?.(picked.table);
        if (picked.kind === 'category') onPickCategory?.(picked.id);
        if (picked.kind === 'tag') onPickTag?.(picked.id);
      }}
      noOptionsText="Nothing matches that"
      slotProps={{ paper: { sx: { minWidth: dense ? 250 : 340 } } }}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest} sx={{ gap: 1 }}>
            {option.kind === 'table' ? (
              <CasinoOutlinedIcon fontSize="small" color="action" />
            ) : option.kind === 'category' ? (
              <HubOutlinedIcon fontSize="small" color="action" />
            ) : (
              <LocalOfferOutlinedIcon fontSize="small" color="action" />
            )}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                {option.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {option.secondary}
              </Typography>
            </Box>
            {option.kind !== 'table' && (
              <Chip
                size="small"
                variant="outlined"
                label={`${option.count} table${option.count === 1 ? '' : 's'}`}
                sx={{ height: 20, fontSize: 11, flexShrink: 0 }}
              />
            )}
          </Box>
        );
      }}
      renderGroup={(params) => (
        <Box key={params.key}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              px: 1.5,
              py: 0.5,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'text.secondary',
              bgcolor: 'action.hover',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            {params.group}
          </Typography>
          {params.children}
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={dense ? undefined : 'Search'}
          placeholder={placeholder}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Chip
                    size="small"
                    color={matches.length === 0 ? 'default' : 'primary'}
                    variant={value.trim() ? 'filled' : 'outlined'}
                    label={`${matches.length}`}
                    title={`${matches.length} table${matches.length === 1 ? '' : 's'} match`}
                    sx={{ height: 20, fontSize: 11, fontWeight: 800, flexShrink: 0 }}
                  />
                  {params.slotProps.input.endAdornment}
                </Stack>
              ),
            },
          }}
        />
      )}
    />
  );
}
