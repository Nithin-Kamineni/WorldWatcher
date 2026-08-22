import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import TablePagination from '@mui/material/TablePagination';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import BadgeIcon from '@mui/icons-material/Badge';
import { CreaturesTable } from './CreaturesTable';
import { NpcFormDialog } from './NpcFormDialog';
import { CreatureStatBlockDialog } from './CreatureStatBlockDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { FilterBar } from './FilterBar';
import { FilterChipGroup } from './FilterChipGroup';
import { useCreatureStore } from '../../store/useCreatureStore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { CREATURE_IMPORTANCE_OPTIONS, CREATURE_RELATION_OPTIONS, type Creature } from '../../types/creature';

interface NpcsSectionProps {
  campaignId: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export function NpcsSection({ campaignId }: NpcsSectionProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [allCampaigns, setAllCampaigns] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCreature, setEditingCreature] = useState<Creature | undefined>(undefined);
  const [viewingCreature, setViewingCreature] = useState<Creature | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Creature | null>(null);
  const [relationFilter, setRelationFilter] = useState<string[]>([]);
  const [importanceFilter, setImportanceFilter] = useState<string[]>([]);

  const creatureBrowse = useCreatureStore((s) => s.creatureBrowse);
  const creatureBrowseLoading = useCreatureStore((s) => s.creatureBrowseLoading);
  const fetchCreatureBrowse = useCreatureStore((s) => s.fetchCreatureBrowse);
  const addCreatureToCampaign = useCreatureStore((s) => s.addCreatureToCampaign);
  const updateCreatureInCampaign = useCreatureStore((s) => s.updateCreatureInCampaign);
  const deleteCreatureFromCampaign = useCreatureStore((s) => s.deleteCreatureFromCampaign);

  const scope = allCampaigns ? 'all' : 'own_or_global';

  const filterSignature = JSON.stringify({ scope, debouncedSearch, relationFilter, importanceFilter });
  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature]);

  useEffect(() => {
    fetchCreatureBrowse({
      campaignId,
      category: 'npc',
      scope,
      page: page + 1,
      pageSize,
      search: debouncedSearch,
      relation: relationFilter,
      importance: importanceFilter,
    });
  }, [campaignId, scope, page, pageSize, debouncedSearch, relationFilter, importanceFilter, fetchCreatureBrowse]);

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPageSize(Number(e.target.value));
    setPage(0);
  };

  const items = creatureBrowse?.items ?? [];
  const total = creatureBrowse?.total ?? 0;
  const hasActiveFilters = relationFilter.length > 0 || importanceFilter.length > 0;
  const isFiltered = !!debouncedSearch || hasActiveFilters;

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" component="h2">
          NPCs
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Tooltip title="This campaign's homebrew and the shared reference library are always shown. Turn this on to also include homebrew from every other campaign.">
            <FormControlLabel
              sx={{ mr: 0.5 }}
              control={<Switch size="small" checked={allCampaigns} onChange={(e) => setAllCampaigns(e.target.checked)} />}
              label={<Typography variant="body2">All campaigns</Typography>}
            />
          </Tooltip>
          <Tooltip title="Search & filter">
            <IconButton color={filterOpen ? 'primary' : 'default'} onClick={() => setFilterOpen((v) => !v)}>
              <SearchIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingCreature(undefined);
              setDialogOpen(true);
            }}
          >
            Add NPC
          </Button>
        </Stack>
      </Stack>

      {filterOpen && (
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search NPCs by name or traits…"
          hasActiveFilters={hasActiveFilters}
          onClearFilters={() => {
            setRelationFilter([]);
            setImportanceFilter([]);
          }}
        >
          <FilterChipGroup
            label="Relation"
            options={CREATURE_RELATION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selected={relationFilter}
            onToggle={(v) => setRelationFilter((prev) => toggleInArray(prev, v))}
          />
          <FilterChipGroup
            label="Importance"
            options={CREATURE_IMPORTANCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selected={importanceFilter}
            onToggle={(v) => setImportanceFilter((prev) => toggleInArray(prev, v))}
          />
        </FilterBar>
      )}

      {creatureBrowseLoading && items.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : total === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
          <BadgeIcon sx={{ fontSize: 56, mb: 1, color: 'text.disabled' }} />
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            No NPCs yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isFiltered ? 'Nothing matches your search/filters.' : 'Add one to get started.'}
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ opacity: creatureBrowseLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            <CreaturesTable
              creatures={items}
              category="npc"
              onView={(creature) => setViewingCreature(creature)}
              onEdit={(creature) => {
                setEditingCreature(creature);
                setDialogOpen(true);
              }}
              onDelete={(creature) => setDeleteTarget(creature)}
              onUpdateCreature={(creature) => updateCreatureInCampaign(campaignId, creature)}
            />
          </Box>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={PAGE_SIZE_OPTIONS}
          />
        </>
      )}

      <NpcFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialCreature={editingCreature}
        campaignId={campaignId}
        onSubmit={(creature) => {
          if (editingCreature) updateCreatureInCampaign(campaignId, creature);
          else addCreatureToCampaign(campaignId, creature);
          setDialogOpen(false);
          setEditingCreature(undefined);
        }}
      />
      <CreatureStatBlockDialog open={!!viewingCreature} creature={viewingCreature} onClose={() => setViewingCreature(null)} />
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        itemName={deleteTarget?.name ?? ''}
        itemType="NPC"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteCreatureFromCampaign(campaignId, deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </Box>
  );
}
