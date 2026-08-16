import { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import MapIcon from '@mui/icons-material/Map';
import SwordsIcon from '@mui/icons-material/Shield';
import PetsIcon from '@mui/icons-material/Pets';
import GroupsIcon from '@mui/icons-material/Groups';
import AssignmentIcon from '@mui/icons-material/Assignment';
import NotesIcon from '@mui/icons-material/Notes';
import CastleIcon from '@mui/icons-material/Castle';
import { AppShell } from '../components/layout/AppShell';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { MapsTable } from '../components/dm/MapsTable';
import { MapFormDialog } from '../components/dm/MapFormDialog';
import { ConfirmDeleteDialog } from '../components/dm/ConfirmDeleteDialog';
import { EncountersSection } from '../components/dm/EncountersSection';
import { CreaturesSection } from '../components/dm/CreaturesSection';
import { FactionsSection } from '../components/dm/FactionsSection';
import { QuestsSection } from '../components/dm/QuestsSection';
import { BastionsSection } from '../components/dm/BastionsSection';
import { FilterBar } from '../components/dm/FilterBar';
import { FilterChipGroup } from '../components/dm/FilterChipGroup';
import { useCampaignStore, getCampaignById, getMapsForCampaign } from '../store/useCampaignStore';
import { MAP_KIND_OPTIONS, type MapData } from '../types/map';

type DMSection = 'maps' | 'encounters' | 'creatures' | 'factions' | 'quests' | 'bastions' | 'notes';

function EmptyPlaceholder({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
      {icon}
      <Typography variant="h6" sx={{ mb: 0.5, mt: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Coming soon.
      </Typography>
    </Box>
  );
}

export function DMPanelPage() {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  const campaigns = useCampaignStore((state) => state.campaigns);
  const campaignsLoaded = useCampaignStore((state) => state.campaignsLoaded);
  const fetchCampaigns = useCampaignStore((state) => state.fetchCampaigns);
  const mapsByCampaignId = useCampaignStore((state) => state.mapsByCampaignId);
  const mapsLoadedByCampaignId = useCampaignStore((state) => state.mapsLoadedByCampaignId);
  const fetchMapsForCampaign = useCampaignStore((state) => state.fetchMapsForCampaign);
  const addMapToCampaign = useCampaignStore((state) => state.addMapToCampaign);
  const updateMapInCampaign = useCampaignStore((state) => state.updateMapInCampaign);
  const deleteMapFromCampaign = useCampaignStore((state) => state.deleteMapFromCampaign);

  const [section, setSection] = useState<DMSection>('maps');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMap, setEditingMap] = useState<MapData | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<MapData | null>(null);
  const [mapsFilterOpen, setMapsFilterOpen] = useState(false);
  const [mapsSearch, setMapsSearch] = useState('');
  const [mapsKindFilter, setMapsKindFilter] = useState<string[]>([]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (campaignId) fetchMapsForCampaign(campaignId);
  }, [campaignId, fetchMapsForCampaign]);

  const campaign = getCampaignById(campaigns, campaignId);
  const maps = getMapsForCampaign(mapsByCampaignId, campaignId);
  const mapsLoaded = campaignId ? !!mapsLoadedByCampaignId[campaignId] : false;
  const filteredMaps = maps.filter((map) => {
    const query = mapsSearch.trim().toLowerCase();
    if (query && !map.name.toLowerCase().includes(query)) return false;
    if (mapsKindFilter.length > 0 && !map.kinds.some((k) => mapsKindFilter.includes(k))) return false;
    return true;
  });
  const toggleKindFilter = (kind: string) => {
    setMapsKindFilter((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  };

  if (!campaign || !campaignId) {
    if (!campaignsLoaded) {
      return (
        <AppShell>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        </AppShell>
      );
    }
    return <Navigate to="/campaigns" replace />;
  }

  const handleAddClick = () => {
    setEditingMap(undefined);
    setDialogOpen(true);
  };

  const handleEditClick = (map: MapData) => {
    setEditingMap(map);
    setDialogOpen(true);
  };

  const handleDialogSubmit = (map: MapData) => {
    if (editingMap) {
      updateMapInCampaign(campaignId, map);
    } else {
      addMapToCampaign(campaignId, map);
    }
    setDialogOpen(false);
    setEditingMap(undefined);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMapFromCampaign(campaignId, deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  return (
    <AppShell>
      <Breadcrumbs
        items={[
          { label: 'Campaigns', to: '/campaigns' },
          { label: campaign.name, to: `/campaigns/${campaign.id}` },
          { label: 'Dungeon Master' },
        ]}
      />

      <Tabs value={section} onChange={(_e, v) => setSection(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="maps" label="Maps" icon={<MapIcon fontSize="small" />} iconPosition="start" data-tour="tab-maps" />
        <Tab value="encounters" label="Encounters" icon={<SwordsIcon fontSize="small" />} iconPosition="start" data-tour="tab-encounters" />
        <Tab value="creatures" label="Creatures" icon={<PetsIcon fontSize="small" />} iconPosition="start" data-tour="tab-creatures" />
        <Tab value="factions" label="Factions" icon={<GroupsIcon fontSize="small" />} iconPosition="start" data-tour="tab-factions" />
        <Tab value="quests" label="Quests" icon={<AssignmentIcon fontSize="small" />} iconPosition="start" data-tour="tab-quests" />
        <Tab value="bastions" label="Bastions" icon={<CastleIcon fontSize="small" />} iconPosition="start" data-tour="tab-bastions" />
        <Tab value="notes" label="Notes" icon={<NotesIcon fontSize="small" />} iconPosition="start" data-tour="tab-notes" />
      </Tabs>

      {section === 'maps' && (
        <>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h4" component="h1">
              Maps
            </Typography>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Search & filter">
                <IconButton
                  color={mapsFilterOpen ? 'primary' : 'default'}
                  onClick={() => setMapsFilterOpen((v) => !v)}
                >
                  <SearchIcon />
                </IconButton>
              </Tooltip>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddClick}>
                Add Map
              </Button>
            </Stack>
          </Stack>

          {mapsFilterOpen && (
            <FilterBar
              search={mapsSearch}
              onSearchChange={setMapsSearch}
              searchPlaceholder="Search maps by name…"
              hasActiveFilters={mapsKindFilter.length > 0}
              onClearFilters={() => setMapsKindFilter([])}
            >
              <FilterChipGroup
                label="Type"
                options={MAP_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                selected={mapsKindFilter}
                onToggle={toggleKindFilter}
              />
            </FilterBar>
          )}

          {!mapsLoaded ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : maps.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                px: 3,
                borderRadius: 4,
                border: '1px dashed',
                borderColor: 'divider',
              }}
            >
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
            <MapsTable
              maps={filteredMaps}
              onOpen={(map) => navigate(`/campaigns/${campaign.id}/dm/map/${map.id}`)}
              onEdit={handleEditClick}
              onDelete={(map) => setDeleteTarget(map)}
            />
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
        </>
      )}

      {section === 'encounters' && <EncountersSection campaignId={campaignId} />}
      {section === 'creatures' && <CreaturesSection campaignId={campaignId} />}
      {section === 'factions' && <FactionsSection campaignId={campaignId} />}
      {section === 'quests' && <QuestsSection campaignId={campaignId} />}
      {section === 'bastions' && <BastionsSection campaignId={campaignId} />}
      {section === 'notes' && <EmptyPlaceholder icon={<NotesIcon sx={{ fontSize: 56, color: 'text.disabled' }} />} title="No notes yet" />}
    </AppShell>
  );
}
