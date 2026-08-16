import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/CardActionArea';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import CasinoIcon from '@mui/icons-material/Casino';
import ListAltIcon from '@mui/icons-material/ListAlt';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { EncountersTable } from './EncountersTable';
import { EncounterFormDialog } from './EncounterFormDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { RandomEncounterTableFormDialog } from './RandomEncounterTableFormDialog';
import { FilterBar } from './FilterBar';
import { FilterChipGroup } from './FilterChipGroup';
import { useEncounterStore, getEncountersForCampaign } from '../../store/useEncounterStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../store/useCreatureStore';
import {
  useRandomEncounterTableStore,
  getRandomEncounterTablesForCampaign,
} from '../../store/useRandomEncounterTableStore';
import type { Encounter } from '../../types/encounter';
import type { RandomEncounterTable } from '../../types/randomEncounterTable';

interface EncountersSectionProps {
  campaignId: string;
}

type EncounterView = 'menu' | 'management' | 'random_tables';

export function EncountersSection({ campaignId }: EncountersSectionProps) {
  const [view, setView] = useState<EncounterView>('menu');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEncounter, setEditingEncounter] = useState<Encounter | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Encounter | null>(null);
  const [allCampaigns, setAllCampaigns] = useState(false);

  const [randomTableDialogOpen, setRandomTableDialogOpen] = useState(false);
  const [editingRandomTable, setEditingRandomTable] = useState<RandomEncounterTable | undefined>(undefined);
  const [deleteRandomTableTarget, setDeleteRandomTableTarget] = useState<RandomEncounterTable | null>(null);

  const encountersByCampaignId = useEncounterStore((s) => s.encountersByCampaignId);
  const addEncounterToCampaign = useEncounterStore((s) => s.addEncounterToCampaign);
  const updateEncounterInCampaign = useEncounterStore((s) => s.updateEncounterInCampaign);
  const deleteEncounterFromCampaign = useEncounterStore((s) => s.deleteEncounterFromCampaign);
  const fetchEncountersForCampaign = useEncounterStore((s) => s.fetchEncountersForCampaign);
  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);

  const tablesByCampaignId = useRandomEncounterTableStore((s) => s.tablesByCampaignId);
  const addRandomTableAction = useRandomEncounterTableStore((s) => s.addTable);
  const updateRandomTableAction = useRandomEncounterTableStore((s) => s.updateTable);
  const deleteRandomTableAction = useRandomEncounterTableStore((s) => s.deleteTable);
  const fetchTablesForCampaign = useRandomEncounterTableStore((s) => s.fetchTablesForCampaign);
  const campaignRandomTables = getRandomEncounterTablesForCampaign(tablesByCampaignId, campaignId);
  const addRandomTable = (table: RandomEncounterTable) => addRandomTableAction(campaignId, table);
  const updateRandomTable = (table: RandomEncounterTable) => updateRandomTableAction(campaignId, table);
  const deleteRandomTable = (tableId: string) => deleteRandomTableAction(campaignId, tableId);

  const encounters = getEncountersForCampaign(encountersByCampaignId, campaignId);
  const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);

  useEffect(() => {
    fetchCreaturesForCampaign(campaignId);
    fetchEncountersForCampaign(campaignId, allCampaigns ? 'all' : 'own_or_global');
    fetchTablesForCampaign(campaignId);
  }, [campaignId, allCampaigns, fetchCreaturesForCampaign, fetchEncountersForCampaign, fetchTablesForCampaign]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState<string[]>([]);
  const [crFilter, setCrFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [resolutionFilter, setResolutionFilter] = useState<string[]>([]);

  const mobTypesFor = (encounter: Encounter): string[] =>
    Array.from(
      new Set([
        ...encounter.creatures
          .map((entry) => (entry.creatureId ? creatures.find((c) => c.id === entry.creatureId)?.type : undefined))
          .filter((t): t is string => !!t),
        ...(encounter.randomTables ?? []).flatMap((row) => row.creatures.map((c) => c.type)).filter((t): t is string => !!t),
      ]),
    );

  const themeOptions = Array.from(new Set(encounters.map((e) => e.theme).filter(Boolean))).sort();
  const crOptions = Array.from(new Set(encounters.map((e) => e.challengeRating).filter(Boolean))).sort();
  const typeOptions = Array.from(new Set(encounters.flatMap(mobTypesFor))).sort();

  const filteredEncounters = encounters.filter((encounter) => {
    const query = search.trim().toLowerCase();
    if (query && !encounter.name.toLowerCase().includes(query)) return false;
    if (themeFilter.length > 0 && !themeFilter.includes(encounter.theme)) return false;
    if (crFilter.length > 0 && !crFilter.includes(encounter.challengeRating)) return false;
    if (typeFilter.length > 0 && !mobTypesFor(encounter).some((t) => typeFilter.includes(t))) return false;
    if (resolutionFilter.length > 0 && !resolutionFilter.includes(encounter.resolutionType)) return false;
    return true;
  });

  const toggle = (setter: Dispatch<SetStateAction<string[]>>, value: string) => {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };
  const hasActiveFilters =
    themeFilter.length > 0 || crFilter.length > 0 || typeFilter.length > 0 || resolutionFilter.length > 0;
  const clearFilters = () => {
    setThemeFilter([]);
    setCrFilter([]);
    setTypeFilter([]);
    setResolutionFilter([]);
  };

  if (view === 'menu') {
    return (
      <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
        <Paper elevation={2} sx={{ borderRadius: 4, width: 260 }}>
          <Card onClick={() => setView('random_tables')} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <CasinoIcon sx={{ fontSize: 40 }} color="primary" />
              <Typography variant="h6">Random Encounters</Typography>
              <Typography variant="body2" color="text.secondary">
                {campaignRandomTables.length} table{campaignRandomTables.length === 1 ? '' : 's'}
              </Typography>
            </Stack>
          </Card>
        </Paper>

        <Paper elevation={2} sx={{ borderRadius: 4, width: 260 }}>
          <Card onClick={() => setView('management')} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <ListAltIcon sx={{ fontSize: 40 }} color="primary" />
              <Typography variant="h6">Encounter Management</Typography>
              <Typography variant="body2" color="text.secondary">
                {encounters.length} saved encounter{encounters.length === 1 ? '' : 's'}
              </Typography>
            </Stack>
          </Card>
        </Paper>
      </Stack>
    );
  }

  if (view === 'random_tables') {
    return (
      <Box>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <IconButton size="small" onClick={() => setView('menu')}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography variant="h5" component="h2">
              Random Encounters
            </Typography>
          </Stack>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingRandomTable(undefined);
              setRandomTableDialogOpen(true);
            }}
          >
            New Table
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Group several encounters into a table, then roll a die for it from the map toolbar's
          "Manage tokens" → Encounters tab to pick one at random.
        </Typography>

        {campaignRandomTables.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
            <CasinoIcon sx={{ fontSize: 56, mb: 1, color: 'text.disabled' }} />
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              No random encounter tables yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create one to roll for a random encounter on the map.
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Die</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Encounters</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {campaignRandomTables.map((table) => (
                  <TableRow key={table.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {table.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{table.dieExpression}</TableCell>
                    <TableCell>
                      {table.entries
                        .map((entry) => encounters.find((e) => e.id === entry.encounterId)?.name ?? 'Unknown')
                        .join(', ')}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit table">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingRandomTable(table);
                            setRandomTableDialogOpen(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete table">
                        <IconButton size="small" onClick={() => setDeleteRandomTableTarget(table)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <RandomEncounterTableFormDialog
          open={randomTableDialogOpen}
          onClose={() => setRandomTableDialogOpen(false)}
          encounters={encounters}
          campaignId={campaignId}
          initialTable={editingRandomTable}
          onSubmit={(table) => {
            if (editingRandomTable) updateRandomTable(table);
            else addRandomTable(table);
            setRandomTableDialogOpen(false);
            setEditingRandomTable(undefined);
          }}
        />

        <ConfirmDeleteDialog
          open={!!deleteRandomTableTarget}
          itemName={deleteRandomTableTarget?.name ?? ''}
          itemType="random encounter table"
          onCancel={() => setDeleteRandomTableTarget(null)}
          onConfirm={() => {
            if (deleteRandomTableTarget) deleteRandomTable(deleteRandomTableTarget.id);
            setDeleteRandomTableTarget(null);
          }}
        />
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
            Encounter Management
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Tooltip title="This campaign's own encounters and the shared reference library (imported random-encounter tables) are always shown. Turn this on to also include every other campaign's encounters.">
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
              setEditingEncounter(undefined);
              setDialogOpen(true);
            }}
          >
            Add Encounter
          </Button>
        </Stack>
      </Stack>

      {filterOpen && (
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search encounters by name…"
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        >
          <FilterChipGroup
            label="Theme"
            options={themeOptions.map((t) => ({ value: t, label: t }))}
            selected={themeFilter}
            onToggle={(v) => toggle(setThemeFilter, v)}
          />
          <FilterChipGroup
            label="Challenge rating"
            options={crOptions.map((c) => ({ value: c, label: c }))}
            selected={crFilter}
            onToggle={(v) => toggle(setCrFilter, v)}
          />
          <FilterChipGroup
            label="Creature type"
            options={typeOptions.map((t) => ({ value: t, label: t }))}
            selected={typeFilter}
            onToggle={(v) => toggle(setTypeFilter, v)}
          />
          <FilterChipGroup
            label="Type"
            options={[
              { value: 'fixed', label: 'Fixed roster' },
              { value: 'random_table', label: 'Random table' },
            ]}
            selected={resolutionFilter}
            onToggle={(v) => toggle(setResolutionFilter, v)}
          />
        </FilterBar>
      )}

      {encounters.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
          <ListAltIcon sx={{ fontSize: 56, mb: 1, color: 'text.disabled' }} />
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            No encounters yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add an encounter to get started.
          </Typography>
        </Box>
      ) : filteredEncounters.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No encounters match your search/filters.
        </Typography>
      ) : (
        <EncountersTable
          encounters={filteredEncounters}
          creatures={creatures}
          onEdit={(encounter) => {
            setEditingEncounter(encounter);
            setDialogOpen(true);
          }}
          onDelete={(encounter) => setDeleteTarget(encounter)}
        />
      )}

      <EncounterFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        creatures={creatures}
        initialEncounter={editingEncounter}
        onSubmit={(encounter) => {
          if (editingEncounter) updateEncounterInCampaign(campaignId, encounter);
          else addEncounterToCampaign(campaignId, encounter);
          setDialogOpen(false);
          setEditingEncounter(undefined);
        }}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        itemName={deleteTarget?.name ?? ''}
        itemType="encounter"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteEncounterFromCampaign(campaignId, deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </Box>
  );
}
