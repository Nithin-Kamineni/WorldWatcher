import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Badge from '@mui/material/Badge';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import SortIcon from '@mui/icons-material/Sort';
import MapIcon from '@mui/icons-material/Map';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { MapsTable } from '../../components/dm/MapsTable';
import { MapFormDialog } from '../../components/dm/MapFormDialog';
import { MapSearchField } from '../../components/dm/MapSearchField';
import { ConfirmDeleteDialog } from '../../components/dm/ConfirmDeleteDialog';
import { FilterChipGroup } from '../../components/dm/FilterChipGroup';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById, getMapsForCampaign } from '../../store/useCampaignStore';
import { MAP_KIND_OPTIONS, MAP_SETTING_OPTIONS, type MapData, type MapKind, type MapSetting } from '../../types/map';
import {
  applyMapFilters,
  buildMapSearchIndex,
  computeKindCounts,
  computeLocationCounts,
  computeSettingCounts,
  countActiveMapFilters,
  EMPTY_MAP_FILTERS,
  filterMapsByQuery,
  getMapKindLabel,
  hasActiveMapFilters,
  MAP_SORT_OPTIONS,
  mapSettingLabel,
  sortMaps,
  type MapFilters,
  type MapSortKey,
} from '../../components/dm/mapSearch';

/** How many location chips the filter panel offers before it stops - locations are free text,
 * so a long campaign can accumulate dozens and the panel is a shortcut, not an index. Anything
 * past this is still reachable by typing it into the search box. */
const MAX_LOCATION_CHIPS = 12;

export function MapsPage() {
  const navigate = useNavigate();
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);

  const campaigns = useCampaignStore((s) => s.campaigns);
  const campaign = getCampaignById(campaigns, campaignId);
  const mapsByCampaignId = useCampaignStore((s) => s.mapsByCampaignId);
  const mapsLoadedByCampaignId = useCampaignStore((s) => s.mapsLoadedByCampaignId);
  const fetchMapsForCampaign = useCampaignStore((s) => s.fetchMapsForCampaign);
  const addMapToCampaign = useCampaignStore((s) => s.addMapToCampaign);
  const updateMapInCampaign = useCampaignStore((s) => s.updateMapInCampaign);
  const deleteMapFromCampaign = useCampaignStore((s) => s.deleteMapFromCampaign);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMap, setEditingMap] = useState<MapData | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<MapData | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<MapSortKey>('relevance');
  const [filters, setFilters] = useState<MapFilters>(EMPTY_MAP_FILTERS);

  useEffect(() => {
    if (campaignId) fetchMapsForCampaign(campaignId);
  }, [campaignId, fetchMapsForCampaign]);

  // TopBar's "New map" lands here with ?new=1 rather than on a create route, so the page has
  // to honour it and then drop the param - otherwise a later reload reopens the dialog.
  const wantsNew = searchParams.get('new') === '1';
  useEffect(() => {
    if (!wantsNew) return;
    setEditingMap(undefined);
    setDialogOpen(true);
    setSearchParams(
      (prev) => {
        prev.delete('new');
        return prev;
      },
      { replace: true },
    );
  }, [wantsNew, setSearchParams]);

  const maps = getMapsForCampaign(mapsByCampaignId, campaignId);
  const searchIndex = useMemo(() => buildMapSearchIndex(maps), [maps]);
  const kindCounts = useMemo(() => computeKindCounts(maps), [maps]);
  const settingCounts = useMemo(() => computeSettingCounts(maps), [maps]);
  const locationCounts = useMemo(() => computeLocationCounts(maps), [maps]);
  const visibleMaps = useMemo(
    () => sortMaps(applyMapFilters(filterMapsByQuery(maps, search, searchIndex), filters), sort, search),
    [maps, search, searchIndex, filters, sort],
  );

  if (!worldId || !campaignId) return <Navigate to="/dashboard" replace />;

  const mapsLoaded = !!mapsLoadedByCampaignId[campaignId];
  const activeFilterCount = countActiveMapFilters(filters);
  const isNarrowed = !!search.trim() || hasActiveMapFilters(filters);

  const toggleKind = (kind: MapKind) =>
    setFilters((prev) => ({ ...prev, kinds: prev.kinds.includes(kind) ? prev.kinds.filter((k) => k !== kind) : [...prev.kinds, kind] }));
  const toggleSetting = (setting: MapSetting) =>
    setFilters((prev) => ({
      ...prev,
      settings: prev.settings.includes(setting) ? prev.settings.filter((s) => s !== setting) : [...prev.settings, setting],
    }));
  const toggleLocation = (location: string) =>
    setFilters((prev) => ({
      ...prev,
      locations: prev.locations.includes(location) ? prev.locations.filter((l) => l !== location) : [...prev.locations, location],
    }));

  const openMap = (mapId: string) => navigate(`/w/${worldId}/c/${campaignId}/maps/${mapId}`);

  const handleAddClick = () => {
    setEditingMap(undefined);
    setDialogOpen(true);
  };
  const handleEditClick = (map: MapData) => {
    setEditingMap(map);
    setDialogOpen(true);
  };
  const handleDialogSubmit = (map: MapData) => {
    if (editingMap) updateMapInCampaign(campaignId, map);
    else addMapToCampaign(campaignId, map);
    setDialogOpen(false);
    setEditingMap(undefined);
  };
  const handleDeleteConfirm = () => {
    if (deleteTarget) deleteMapFromCampaign(campaignId, deleteTarget.id);
    setDeleteTarget(null);
  };

  const sortedLocations = [...locationCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <SectionLayout worldId={worldId} campaignId={campaignId}>
      <Breadcrumbs items={[{ label: world?.name ?? '…', to: `/w/${worldId}/home` }, { label: campaign?.name ?? '…', to: `/w/${worldId}/c/${campaignId}/home` }, { label: 'Maps' }]} />

      {/* No page title: the breadcrumb trail already ends in "Maps", and a second heading
          saying the same thing only pushed the library itself further down the page. */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' }, mb: 2 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: { md: 560 } }}>
          <MapSearchField
            value={search}
            onChange={setSearch}
            maps={maps}
            index={searchIndex}
            onPickMap={(map) => openMap(map.id)}
            onPickKind={(kind) => {
              toggleKind(kind);
              setFiltersOpen(true);
            }}
            onPickLocation={(location) => {
              toggleLocation(location);
              setFiltersOpen(true);
            }}
          />
        </Box>
        <TextField
          select
          size="small"
          value={sort}
          onChange={(e) => setSort(e.target.value as MapSortKey)}
          sx={{ minWidth: 190 }}
          slotProps={{ input: { startAdornment: <SortIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> } }}
        >
          {MAP_SORT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Badge badgeContent={activeFilterCount} color="primary">
          <Button
            variant={filtersOpen ? 'contained' : 'outlined'}
            color={filtersOpen ? 'primary' : 'inherit'}
            startIcon={<TuneIcon />}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            Filters
          </Button>
        </Badge>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddClick}>
          Add Map
        </Button>
      </Stack>

      {filtersOpen && (
        <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <FilterChipGroup
                label="Type"
                options={MAP_KIND_OPTIONS.filter((option) => (kindCounts.get(option.value) ?? 0) > 0).map((option) => ({
                  value: option.value,
                  label: `${option.label} (${kindCounts.get(option.value) ?? 0})`,
                }))}
                selected={filters.kinds}
                onToggle={(value) => toggleKind(value as MapKind)}
              />
              <FilterChipGroup
                label="Indoor / Outdoor"
                options={MAP_SETTING_OPTIONS.filter((option) => (settingCounts.get(option.value) ?? 0) > 0).map((option) => ({
                  value: option.value,
                  label: `${option.label} (${settingCounts.get(option.value) ?? 0})`,
                }))}
                selected={filters.settings}
                onToggle={(value) => toggleSetting(value as MapSetting)}
              />
              <FilterChipGroup
                label="Location"
                options={sortedLocations.slice(0, MAX_LOCATION_CHIPS).map(([location, count]) => ({
                  value: location,
                  label: `${location} (${count})`,
                }))}
                selected={filters.locations}
                onToggle={toggleLocation}
              />
            </Stack>
            {activeFilterCount > 0 && (
              <Button size="small" onClick={() => setFilters(EMPTY_MAP_FILTERS)} sx={{ alignSelf: 'flex-start' }}>
                Clear filters
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {/* The active-filter row lives outside the panel on purpose: collapsing Filters must not
          hide the fact that the library is still being narrowed by them. */}
      {isNarrowed && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {visibleMaps.length} of {maps.length} map{maps.length === 1 ? '' : 's'}
          </Typography>
          {search.trim() && <Chip size="small" label={`“${search.trim()}”`} onDelete={() => setSearch('')} />}
          {filters.kinds.map((kind) => (
            <Chip key={`kind-${kind}`} size="small" color="primary" variant="outlined" label={getMapKindLabel(kind)} onDelete={() => toggleKind(kind)} />
          ))}
          {filters.settings.map((setting) => (
            <Chip
              key={`setting-${setting}`}
              size="small"
              color="primary"
              variant="outlined"
              label={mapSettingLabel(setting)}
              onDelete={() => toggleSetting(setting)}
            />
          ))}
          {filters.locations.map((location) => (
            <Chip key={`loc-${location}`} size="small" color="primary" variant="outlined" label={location} onDelete={() => toggleLocation(location)} />
          ))}
          <Button
            size="small"
            color="inherit"
            onClick={() => {
              setSearch('');
              setFilters(EMPTY_MAP_FILTERS);
            }}
          >
            Reset
          </Button>
        </Stack>
      )}

      {!mapsLoaded ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : maps.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
          <MapIcon sx={{ fontSize: 56, mb: 1, color: 'text.disabled' }} />
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            No maps yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add a map to get started.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddClick}>
            Add Map
          </Button>
        </Box>
      ) : visibleMaps.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No maps match that search or those filters.
          </Typography>
          <Button
            size="small"
            onClick={() => {
              setSearch('');
              setFilters(EMPTY_MAP_FILTERS);
            }}
          >
            Clear search and filters
          </Button>
        </Box>
      ) : (
        <MapsTable maps={visibleMaps} onOpen={(map) => openMap(map.id)} onEdit={handleEditClick} onDelete={(map) => setDeleteTarget(map)} />
      )}

      <MapFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={handleDialogSubmit} initialMap={editingMap} />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        itemName={deleteTarget?.name ?? ''}
        itemType="map"
        description="and all of its floor images will be removed from this campaign."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </SectionLayout>
  );
}
