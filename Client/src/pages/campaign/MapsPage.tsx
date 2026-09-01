import { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import MapIcon from '@mui/icons-material/Map';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { MapsTable } from '../../components/dm/MapsTable';
import { MapFormDialog } from '../../components/dm/MapFormDialog';
import { ConfirmDeleteDialog } from '../../components/dm/ConfirmDeleteDialog';
import { FilterBar } from '../../components/dm/FilterBar';
import { FilterChipGroup } from '../../components/dm/FilterChipGroup';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById, getMapsForCampaign } from '../../store/useCampaignStore';
import { MAP_KIND_OPTIONS, type MapData } from '../../types/map';

export function MapsPage() {
  const navigate = useNavigate();
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>();
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<string[]>([]);

  useEffect(() => {
    if (campaignId) fetchMapsForCampaign(campaignId);
  }, [campaignId, fetchMapsForCampaign]);

  if (!worldId || !campaignId) return <Navigate to="/dashboard" replace />;

  const maps = getMapsForCampaign(mapsByCampaignId, campaignId);
  const mapsLoaded = !!mapsLoadedByCampaignId[campaignId];
  const filteredMaps = maps.filter((map) => {
    const query = search.trim().toLowerCase();
    if (query && !map.name.toLowerCase().includes(query)) return false;
    if (kindFilter.length > 0 && !map.kinds.some((k) => kindFilter.includes(k))) return false;
    return true;
  });
  const toggleKindFilter = (kind: string) => {
    setKindFilter((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  };

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

  return (
    <SectionLayout
      worldId={worldId}
      campaignId={campaignId}
      sidebar={
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', px: 1, mb: 0.5 }}>
            Maps
          </Typography>
          {maps.length === 0 ? (
            <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>
              No maps yet
            </Typography>
          ) : (
            <List dense disablePadding>
              {maps.map((m) => (
                <ListItemButton key={m.id} onClick={() => openMap(m.id)} sx={{ borderRadius: 1.5 }}>
                  <ListItemText primary={m.name} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      }
    >
      <Breadcrumbs items={[{ label: world?.name ?? '…', to: `/w/${worldId}/home` }, { label: campaign?.name ?? '…', to: `/w/${worldId}/c/${campaignId}/home` }, { label: 'Maps' }]} />

      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Maps
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Search & filter">
            <IconButton color={filterOpen ? 'primary' : 'default'} onClick={() => setFilterOpen((v) => !v)}>
              <SearchIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddClick}>
            Add Map
          </Button>
        </Stack>
      </Stack>

      {filterOpen && (
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search maps by name…"
          hasActiveFilters={kindFilter.length > 0}
          onClearFilters={() => setKindFilter([])}
        >
          <FilterChipGroup
            label="Type"
            options={MAP_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selected={kindFilter}
            onToggle={toggleKindFilter}
          />
        </FilterBar>
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
          <Typography variant="body2" color="text.secondary">
            Add a map to get started.
          </Typography>
        </Box>
      ) : filteredMaps.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No maps match your search/filters.
        </Typography>
      ) : (
        <MapsTable maps={filteredMaps} onOpen={(map) => openMap(map.id)} onEdit={handleEditClick} onDelete={(map) => setDeleteTarget(map)} />
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
