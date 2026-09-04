import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
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
import TextField from '@mui/material/TextField';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import CasinoIcon from '@mui/icons-material/Casino';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { EncountersTable } from './EncountersTable';
import { EncounterFormDialog } from './EncounterFormDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { FilterBar } from './FilterBar';
import { FilterChipGroup } from './FilterChipGroup';
import { RandomTablesBrowseView } from './randomTables/RandomTablesBrowseView';
import { EncounterDetailDialog } from './EncounterDetailDialog';
import { NpcFormDialog, type NpcRollPrefill } from './NpcFormDialog';
import { QuickNpcRollDialog } from './npc/QuickNpcRollDialog';
import { PlaceBuilderDialog, type PlaceType } from '../world/PlaceBuilderDialog';
import { EncounterBuilderDialog } from './encounter/EncounterBuilderDialog';
import { useEncounterStore, getEncountersForCampaign } from '../../store/useEncounterStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../store/useCreatureStore';
import { useEncounterDifficultySettingsStore } from '../../store/useEncounterDifficultySettingsStore';
import type { Encounter, EncounterPrimaryType } from '../../types/encounter';
import type { Creature } from '../../types/creature';

export type EncounterView = 'menu' | 'management' | 'random_tables';

interface EncountersSectionProps {
  campaignId: string;
  worldId?: string;
  /** Optional controlled view - lets a page-level owner (e.g. EncountersPage, via the
   * `?view=` query param) drive which sub-view is shown. Falls back to internal state
   * when omitted. */
  view?: EncounterView;
  onViewChange?: (view: EncounterView) => void;
  /** Deep-link support (e.g. from the Play page's Items window "open in new tab") - opens this
   * encounter's edit dialog once, as soon as it's loaded. */
  openEncounterId?: string;
  /** Same, for a single random table - opens its roll view in the Random Tables view. */
  openTableId?: string;
}

export function EncountersSection({ campaignId, worldId, view: controlledView, onViewChange, openEncounterId, openTableId }: EncountersSectionProps) {
  const [internalView, setInternalView] = useState<EncounterView>('menu');
  const view = controlledView ?? internalView;
  const setView = (next: EncounterView) => {
    if (onViewChange) onViewChange(next);
    else setInternalView(next);
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEncounter, setEditingEncounter] = useState<Encounter | undefined>(undefined);
  const [viewingEncounter, setViewingEncounter] = useState<Encounter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Encounter | null>(null);
  const [allCampaigns, setAllCampaigns] = useState(false);
  const [npcBuilderOpen, setNpcBuilderOpen] = useState(false);
  const [placeBuilderOpen, setPlaceBuilderOpen] = useState(false);
  const [placeBuilderType, setPlaceBuilderType] = useState<PlaceType | undefined>();
  const [encounterBuilderOpen, setEncounterBuilderOpen] = useState(false);
  const [encounterBuilderType, setEncounterBuilderType] = useState<EncounterPrimaryType | undefined>();
  const [npcFormOpen, setNpcFormOpen] = useState(false);
  const [npcPrefill, setNpcPrefill] = useState<NpcRollPrefill | undefined>();
  const [editingNpc, setEditingNpc] = useState<Creature | undefined>();

  const party = useEncounterDifficultySettingsStore((s) => s.getParty(campaignId));
  const setPartySize = useEncounterDifficultySettingsStore((s) => s.setPartySize);
  const setPartyLevel = useEncounterDifficultySettingsStore((s) => s.setPartyLevel);

  const encountersByCampaignId = useEncounterStore((s) => s.encountersByCampaignId);
  const addEncounterToCampaign = useEncounterStore((s) => s.addEncounterToCampaign);
  const updateEncounterInCampaign = useEncounterStore((s) => s.updateEncounterInCampaign);
  const deleteEncounterFromCampaign = useEncounterStore((s) => s.deleteEncounterFromCampaign);
  const fetchEncountersForCampaign = useEncounterStore((s) => s.fetchEncountersForCampaign);
  const fetchEncounterById = useEncounterStore((s) => s.fetchEncounterById);
  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);
  const addCreatureToCampaign = useCreatureStore((s) => s.addCreatureToCampaign);
  const updateCreatureInCampaign = useCreatureStore((s) => s.updateCreatureInCampaign);

  const encounters = getEncountersForCampaign(encountersByCampaignId, campaignId);
  const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);

  useEffect(() => {
    fetchCreaturesForCampaign(campaignId);
    fetchEncountersForCampaign(campaignId, allCampaigns ? 'all' : 'own_or_global');
  }, [campaignId, allCampaigns, fetchCreaturesForCampaign, fetchEncountersForCampaign]);

  const deepLinkedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openEncounterId || deepLinkedRef.current === openEncounterId) return;
    const target = encounters.find((e) => e.id === openEncounterId);
    if (!target) return;
    deepLinkedRef.current = openEncounterId;
    setEditingEncounter(target);
    setDialogOpen(true);
  }, [openEncounterId, encounters]);

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
              <Typography variant="h6">Random Tables</Typography>
              <Typography variant="body2" color="text.secondary">
                Roll for encounters, loot, roleplay & exploration prompts
              </Typography>
            </Stack>
          </Card>
        </Paper>

        <Paper elevation={2} sx={{ borderRadius: 4, width: 260 }}>
          <Card onClick={() => setView('management')} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <ListAltIcon sx={{ fontSize: 40 }} color="primary" />
              <Typography variant="h6">Encounters</Typography>
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
      <Box sx={{ width: '100%', height: '100%', minHeight: 0 }}>
        <RandomTablesBrowseView
          campaignId={campaignId}
          openTableId={openTableId}
          onBack={() => setView('menu')}
          onGoToEncounters={() => setView('management')}
          onOpenEncounter={(id) => { void fetchEncounterById(campaignId, id).then((encounter) => setViewingEncounter(encounter)); }}
          onOpenNpcBuilder={() => setNpcBuilderOpen(true)}
          onOpenPlaceBuilder={worldId ? (type) => { setPlaceBuilderType(type); setPlaceBuilderOpen(true); } : undefined}
          onOpenEncounterBuilder={(type) => { setEncounterBuilderType(type); setEncounterBuilderOpen(true); }}
        />
        <EncounterDetailDialog encounter={viewingEncounter} creatures={creatures} campaignId={campaignId} onClose={() => setViewingEncounter(null)} />
        <QuickNpcRollDialog
          open={npcBuilderOpen}
          onClose={() => setNpcBuilderOpen(false)}
          campaignId={campaignId}
          onAddToNew={(prefill) => { setEditingNpc(undefined); setNpcPrefill(prefill); setNpcBuilderOpen(false); setNpcFormOpen(true); }}
          onAddToExisting={(creature, prefill) => { setEditingNpc(creature); setNpcPrefill(prefill); setNpcBuilderOpen(false); setNpcFormOpen(true); }}
        />
        {worldId && (
          <PlaceBuilderDialog
            open={placeBuilderOpen}
            worldId={worldId}
            campaignId={campaignId}
            initialType={placeBuilderType}
            onClose={() => setPlaceBuilderOpen(false)}
            onCreated={() => setPlaceBuilderOpen(false)}
          />
        )}
        <NpcFormDialog
          open={npcFormOpen}
          onClose={() => { setNpcFormOpen(false); setNpcPrefill(undefined); setEditingNpc(undefined); }}
          campaignId={campaignId}
          worldId={worldId}
          initialCreature={editingNpc}
          prefill={npcPrefill}
          onSubmit={(creature) => {
            if (editingNpc) updateCreatureInCampaign(campaignId, creature);
            else addCreatureToCampaign(campaignId, creature);
            setNpcFormOpen(false);
            setNpcPrefill(undefined);
            setEditingNpc(undefined);
          }}
        />
        <EncounterBuilderDialog
          open={encounterBuilderOpen}
          campaignId={campaignId}
          initialType={encounterBuilderType}
          partySize={party.partySize}
          partyLevel={party.partyLevel}
          onClose={() => setEncounterBuilderOpen(false)}
          onAdd={(encounter) => { addEncounterToCampaign(campaignId, encounter); setEncounterBuilderOpen(false); setView('management'); }}
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
          <Tooltip title="Assumed party used to compute each encounter's live difficulty badge">
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mr: 0.5 }}>
              <TextField
                size="small"
                type="number"
                label="Players"
                value={party.partySize}
                onChange={(e) => setPartySize(campaignId, Number(e.target.value) || 1)}
                slotProps={{ htmlInput: { min: 1, max: 20 } }}
                sx={{ width: 88 }}
              />
              <TextField
                size="small"
                type="number"
                label="Level"
                value={party.partyLevel}
                onChange={(e) => setPartyLevel(campaignId, Number(e.target.value) || 1)}
                slotProps={{ htmlInput: { min: 1, max: 20 } }}
                sx={{ width: 88 }}
              />
            </Stack>
          </Tooltip>
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
          <Button variant="outlined" startIcon={<CasinoIcon />} onClick={() => setView('random_tables')}>Random Tables</Button>
          <Button variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={() => { setEncounterBuilderType(undefined); setEncounterBuilderOpen(true); }}>Generate Encounter</Button>
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
          partySize={party.partySize}
          partyLevel={party.partyLevel}
          onEdit={(encounter) => {
            setEditingEncounter(encounter);
            setDialogOpen(true);
          }}
          onDelete={(encounter) => setDeleteTarget(encounter)}
          onView={setViewingEncounter}
        />
      )}

      <EncounterDetailDialog
        encounter={viewingEncounter}
        creatures={creatures}
        campaignId={campaignId}
        onClose={() => setViewingEncounter(null)}
        onEdit={(encounter) => { setViewingEncounter(null); setEditingEncounter(encounter); setDialogOpen(true); }}
      />

      <EncounterFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        campaignId={campaignId}
        creatures={creatures}
        initialEncounter={editingEncounter}
        onSubmit={(encounter) => {
          if (editingEncounter) updateEncounterInCampaign(campaignId, encounter);
          else addEncounterToCampaign(campaignId, encounter);
          setDialogOpen(false);
          setEditingEncounter(undefined);
        }}
      />

      <EncounterBuilderDialog
        open={encounterBuilderOpen}
        campaignId={campaignId}
        initialType={encounterBuilderType}
        partySize={party.partySize}
        partyLevel={party.partyLevel}
        onClose={() => setEncounterBuilderOpen(false)}
        onAdd={(encounter) => { addEncounterToCampaign(campaignId, encounter); setEncounterBuilderOpen(false); }}
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
