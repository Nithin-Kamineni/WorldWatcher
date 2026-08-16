import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/CardActionArea';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import CastleIcon from '@mui/icons-material/Castle';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { BastionFacilitiesTable } from './BastionFacilitiesTable';
import { BastionsTable } from './BastionsTable';
import { BastionFormDialog } from './BastionFormDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { FilterBar } from './FilterBar';
import { FilterChipGroup } from './FilterChipGroup';
import { useBastionFacilityStore } from '../../store/useBastionFacilityStore';
import { useBastionStore, getBastionsForCampaign } from '../../store/useBastionStore';
import { BASTION_FACILITY_TYPE_OPTIONS, type Bastion } from '../../types/bastion';

interface BastionsSectionProps {
  campaignId: string;
}

type BastionsView = 'menu' | 'catalog' | 'tracker';

export function BastionsSection({ campaignId }: BastionsSectionProps) {
  const [view, setView] = useState<BastionsView>('menu');

  const facilityBrowse = useBastionFacilityStore((s) => s.facilityBrowse);
  const facilityBrowseLoading = useBastionFacilityStore((s) => s.facilityBrowseLoading);
  const fetchFacilityBrowse = useBastionFacilityStore((s) => s.fetchFacilityBrowse);

  const bastionsByCampaignId = useBastionStore((s) => s.bastionsByCampaignId);
  const fetchBastionsForCampaign = useBastionStore((s) => s.fetchBastionsForCampaign);
  const fetchBastionDetail = useBastionStore((s) => s.fetchBastionDetail);
  const addBastionToCampaign = useBastionStore((s) => s.addBastionToCampaign);
  const updateBastionInCampaign = useBastionStore((s) => s.updateBastionInCampaign);
  const deleteBastionFromCampaign = useBastionStore((s) => s.deleteBastionFromCampaign);
  const addFacilityToBastion = useBastionStore((s) => s.addFacilityToBastion);
  const updateFacilityInstance = useBastionStore((s) => s.updateFacilityInstance);
  const removeFacilityInstance = useBastionStore((s) => s.removeFacilityInstance);

  const bastions = getBastionsForCampaign(bastionsByCampaignId, campaignId);
  const facilityCatalog = facilityBrowse?.items ?? [];

  useEffect(() => {
    // Only 61 facilities total - one unfiltered fetch covers both the catalog browser
    // (filtered client-side below) and the tracker's "build a facility" picker.
    fetchFacilityBrowse({ page: 1, pageSize: 200 });
    fetchBastionsForCampaign(campaignId);
  }, [campaignId, fetchFacilityBrowse, fetchBastionsForCampaign]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBastion, setEditingBastion] = useState<Bastion | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Bastion | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const filteredFacilities = facilityCatalog.filter((f) => {
    const query = search.trim().toLowerCase();
    if (query && !f.name.toLowerCase().includes(query)) return false;
    if (typeFilter.length > 0 && !typeFilter.includes(f.facilityType)) return false;
    return true;
  });

  if (view === 'menu') {
    return (
      <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
        <Paper elevation={2} sx={{ borderRadius: 4, width: 260 }}>
          <Card onClick={() => setView('catalog')} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <MenuBookIcon sx={{ fontSize: 40 }} color="primary" />
              <Typography variant="h6">Facility Catalog</Typography>
              <Typography variant="body2" color="text.secondary">
                {facilityCatalog.length} facilities
              </Typography>
            </Stack>
          </Card>
        </Paper>

        <Paper elevation={2} sx={{ borderRadius: 4, width: 260 }}>
          <Card onClick={() => setView('tracker')} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <CastleIcon sx={{ fontSize: 40 }} color="primary" />
              <Typography variant="h6">Party Bastions</Typography>
              <Typography variant="body2" color="text.secondary">
                {bastions.length} bastion{bastions.length === 1 ? '' : 's'}
              </Typography>
            </Stack>
          </Card>
        </Paper>
      </Stack>
    );
  }

  if (view === 'catalog') {
    return (
      <Box>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <IconButton size="small" onClick={() => setView('menu')}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography variant="h5" component="h2">
              Facility Catalog
            </Typography>
          </Stack>
          <Tooltip title="Search & filter">
            <IconButton color={filterOpen ? 'primary' : 'default'} onClick={() => setFilterOpen((v) => !v)}>
              <SearchIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {filterOpen && (
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search facilities by name…"
            hasActiveFilters={typeFilter.length > 0}
            onClearFilters={() => setTypeFilter([])}
          >
            <FilterChipGroup
              label="Type"
              options={BASTION_FACILITY_TYPE_OPTIONS}
              selected={typeFilter}
              onToggle={(v) => setTypeFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))}
            />
          </FilterBar>
        )}

        {facilityBrowseLoading && facilityCatalog.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <BastionFacilitiesTable facilities={filteredFacilities} />
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <IconButton size="small" onClick={() => setView('menu')}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h5" component="h2">
            Party Bastions
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingBastion(undefined);
            setDialogOpen(true);
          }}
        >
          Add Bastion
        </Button>
      </Stack>

      {bastions.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
          <CastleIcon sx={{ fontSize: 56, mb: 1, color: 'text.disabled' }} />
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            No bastions yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add one to start tracking a PC's stronghold.
          </Typography>
        </Box>
      ) : (
        <BastionsTable
          bastions={bastions}
          facilityCatalog={facilityCatalog}
          onEdit={(bastion) => {
            setEditingBastion(bastion);
            setDialogOpen(true);
          }}
          onDelete={(bastion) => setDeleteTarget(bastion)}
          onExpand={(bastion) => fetchBastionDetail(campaignId, bastion.id)}
          onAddFacility={(bastionId, instance) => addFacilityToBastion(campaignId, bastionId, instance)}
          onUpdateFacility={(bastionId, instance) => updateFacilityInstance(campaignId, bastionId, instance)}
          onRemoveFacility={(bastionId, instanceId) => removeFacilityInstance(campaignId, bastionId, instanceId)}
        />
      )}

      <BastionFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialBastion={editingBastion}
        onSubmit={(bastion) => {
          if (editingBastion) updateBastionInCampaign(campaignId, bastion);
          else addBastionToCampaign(campaignId, bastion);
          setDialogOpen(false);
          setEditingBastion(undefined);
        }}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        itemName={deleteTarget?.name ?? ''}
        itemType="bastion"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteBastionFromCampaign(campaignId, deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </Box>
  );
}
