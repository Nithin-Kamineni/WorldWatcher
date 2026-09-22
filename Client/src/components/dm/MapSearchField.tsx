import { useMemo } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LayersIcon from '@mui/icons-material/Layers';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { normalizeSearchText, queryTokens, tokenMatchesFuzzy } from './randomTables/tableSearch';
import { getMapKindOption, getPrimaryFloor, MAP_KIND_OPTIONS, type MapData, type MapKind } from '../../types/map';
import {
  computeKindCounts,
  computeLocationCounts,
  filterMapsByQuery,
  mapSettingLabel,
  rankMapsByQuery,
  type MapSearchIndex,
} from './mapSearch';

type Suggestion =
  | { key: string; group: string; kind: 'map'; label: string; secondary: string; map: MapData }
  | { key: string; group: string; kind: 'type'; label: string; secondary: string; count: number; value: MapKind }
  | { key: string; group: string; kind: 'location'; label: string; secondary: string; count: number; value: string };

interface MapSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** The campaign's maps before the text query is applied, so facet counts stay meaningful
   * while the typed text narrows the map suggestions. */
  maps: MapData[];
  index: MapSearchIndex;
  onPickMap: (map: MapData) => void;
  onPickKind: (kind: MapKind) => void;
  onPickLocation: (location: string) => void;
  placeholder?: string;
}

const MAX_PER_GROUP = 6;

/** One box that searches map names, descriptions, locations, story notes, types, floor names
 * and custom details at once - the maps-library twin of RandomTableSearchField, built the same
 * way so both libraries search and read alike.
 *
 * The dropdown is not only a match list: it answers "how many maps am I looking at" with a live
 * count on the field, and offers the types and locations present in this campaign as one-click
 * filters, each with its own count. With nothing typed it is a discovery aid - the busiest
 * types and locations, and the maps touched most recently - rather than an empty panel. */
export function MapSearchField({
  value,
  onChange,
  maps,
  index,
  onPickMap,
  onPickKind,
  onPickLocation,
  placeholder = 'Search maps by name, place, type, floor...',
}: MapSearchFieldProps) {
  const kindCounts = useMemo(() => computeKindCounts(maps), [maps]);
  const locationCounts = useMemo(() => computeLocationCounts(maps), [maps]);
  const matches = useMemo(() => filterMapsByQuery(maps, value, index), [maps, value, index]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const tokens = queryTokens(value);
    const facetMatches = (label: string) =>
      tokens.length === 0 || tokens.every((token) => tokenMatchesFuzzy(token, normalizeSearchText(label)));

    const matchedKinds = MAP_KIND_OPTIONS.filter((option) => (kindCounts.get(option.value) ?? 0) > 0)
      .filter((option) => facetMatches(option.label))
      .sort((a, b) => (kindCounts.get(b.value) ?? 0) - (kindCounts.get(a.value) ?? 0));
    const matchedLocations = [...locationCounts.entries()]
      .filter(([location]) => facetMatches(location))
      .sort((a, b) => b[1] - a[1]);

    const mapGroup = `Maps - ${matches.length}`;
    const typeGroup = `Types - ${matchedKinds.length}`;
    const locationGroup = `Locations - ${matchedLocations.length}`;

    const mapSuggestions: Suggestion[] = rankMapsByQuery(matches, value)
      .slice(0, MAX_PER_GROUP)
      .map((map) => ({
        key: `map:${map.id}`,
        group: mapGroup,
        kind: 'map' as const,
        label: map.name,
        secondary:
          [map.kinds.map((kind) => getMapKindOption(kind).label).join(', '), map.location?.trim(), mapSettingLabel(map.setting)]
            .filter(Boolean)
            .join(' · ') || `${map.floors.length} floor${map.floors.length === 1 ? '' : 's'}`,
        map,
      }));

    return [
      ...mapSuggestions,
      ...matchedKinds.slice(0, MAX_PER_GROUP).map((option) => ({
        key: `type:${option.value}`,
        group: typeGroup,
        kind: 'type' as const,
        label: option.label,
        secondary: 'Filter by type',
        count: kindCounts.get(option.value) ?? 0,
        value: option.value,
      })),
      ...matchedLocations.slice(0, MAX_PER_GROUP).map(([location, count]) => ({
        key: `location:${location}`,
        group: locationGroup,
        kind: 'location' as const,
        label: location,
        secondary: 'Filter by location',
        count,
        value: location,
      })),
    ];
  }, [value, matches, kindCounts, locationCounts]);

  return (
    <Autocomplete<Suggestion, false, false, true>
      freeSolo
      openOnFocus
      handleHomeEndKeys
      clearOnBlur={false}
      blurOnSelect
      size="small"
      options={suggestions}
      inputValue={value}
      value={null}
      // Suggestions are already ranked and filtered above (and deliberately include facets that
      // do not match the typed text by name), so MUI's own substring filter must not re-run.
      filterOptions={(options) => options}
      groupBy={(option) => option.group}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
      // Only the DM's own keystrokes (and the clear button) may change the query: picking a
      // suggestion here is an action - open that map, add that facet - and the query they typed
      // has to survive it rather than being overwritten with the suggestion's label.
      onInputChange={(_event, next, reason) => {
        if (reason === 'input') onChange(next);
        else if (reason === 'clear') onChange('');
      }}
      onChange={(_event, picked) => {
        if (!picked || typeof picked === 'string') return;
        if (picked.kind === 'map') onPickMap(picked.map);
        if (picked.kind === 'type') onPickKind(picked.value);
        if (picked.kind === 'location') onPickLocation(picked.value);
      }}
      noOptionsText="No map matches that"
      slotProps={{ paper: { sx: { minWidth: 340 } } }}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        const cover = option.kind === 'map' ? getPrimaryFloor(option.map)?.imageSrc : undefined;
        return (
          <Box component="li" key={key} {...rest} sx={{ gap: 1 }}>
            {option.kind === 'map' ? (
              cover ? (
                <Box
                  component="img"
                  src={cover}
                  alt=""
                  sx={{ width: 32, height: 32, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <LayersIcon fontSize="small" color="action" />
              )
            ) : option.kind === 'type' ? (
              <CategoryOutlinedIcon fontSize="small" color="action" />
            ) : (
              <PlaceOutlinedIcon fontSize="small" color="action" />
            )}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                {option.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {option.secondary}
              </Typography>
            </Box>
            {option.kind !== 'map' && (
              <Chip
                size="small"
                variant="outlined"
                label={`${option.count} map${option.count === 1 ? '' : 's'}`}
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
                    title={`${matches.length} map${matches.length === 1 ? '' : 's'} match`}
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
