import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import CasinoIcon from '@mui/icons-material/Casino';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ShieldIcon from '@mui/icons-material/Shield';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import { EncountersTable } from './EncountersTable';
import { EncounterFormDialog } from './EncounterFormDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { FilterChipGroup } from './FilterChipGroup';
import { EncounterDetailDialog } from './EncounterDetailDialog';
import { EncounterBuilderDialog } from './encounter/EncounterBuilderDialog';
import { useEncounterStore, getEncountersForCampaign } from '../../store/useEncounterStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../store/useCreatureStore';
import { useEncounterDifficultySettingsStore } from '../../store/useEncounterDifficultySettingsStore';
import type { Encounter, EncounterPrimaryType } from '../../types/encounter';
import { PageTitle } from '../shell/PageTitle';
import { su } from '../../theme/uiScale';

interface EncountersSectionProps {
  campaignId: string;
  /** Deep link from the Play page's Items window ("open in new tab" on an encounter row) -
   * opens that encounter's edit dialog once, as soon as it has loaded. */
  openEncounterId?: string;
  /** `?new=1`, which both the top bar's New menu and the command palette's "New encounter"
   * already send. Nothing read it before this page existed, so both were silently landing the
   * DM on a list instead of an open form. */
  openNew?: boolean;
  /** Crossing to the Random Tables page - the other half of what used to be one rail button. */
  onGoToTables?: () => void;
}

/** The Encounters page: the library of encounters this campaign has actually built.
 *
 * It was `view === 'management'`, a sub-screen behind a back arrow on the Random Tables page,
 * reachable only by finding a button labelled "Encounter table view" (checklist R4). It is a
 * page in its own right now, with its own rail button, because it answers a different question
 * than the table browser does: you arrive here knowing exactly which encounter you want - the
 * ambush you built for session 12 - rather than asking to be handed something at random.
 *
 * Browsing encounters by category/tag alongside tables still exists and is still good; it
 * lives on the Random Tables page's kind toggle (Task 11.3), one click away via "Random
 * Tables" in the header. */
export function EncountersSection({ campaignId, openEncounterId, openNew, onGoToTables }: EncountersSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEncounter, setEditingEncounter] = useState<Encounter | undefined>(undefined);
  const [viewingEncounter, setViewingEncounter] = useState<Encounter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Encounter | null>(null);
  const [allCampaigns, setAllCampaigns] = useState(false);
  const [encounterBuilderOpen, setEncounterBuilderOpen] = useState(false);
  const [encounterBuilderType, setEncounterBuilderType] = useState<EncounterPrimaryType | undefined>();

  const party = useEncounterDifficultySettingsStore((s) => s.getParty(campaignId));
  const setPartySize = useEncounterDifficultySettingsStore((s) => s.setPartySize);
  const setPartyLevel = useEncounterDifficultySettingsStore((s) => s.setPartyLevel);

  const encountersByCampaignId = useEncounterStore((s) => s.encountersByCampaignId);
  const addEncounterToCampaign = useEncounterStore((s) => s.addEncounterToCampaign);
  const updateEncounterInCampaign = useEncounterStore((s) => s.updateEncounterInCampaign);
  const deleteEncounterFromCampaign = useEncounterStore((s) => s.deleteEncounterFromCampaign);
  const fetchEncountersForCampaign = useEncounterStore((s) => s.fetchEncountersForCampaign);
  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);

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

  // `?new=1` fires once per mount, not once per render - reopening the form every time the
  // encounter list refetches would trap the DM in a dialog they just closed.
  const openedNewRef = useRef(false);
  useEffect(() => {
    if (!openNew || openedNewRef.current) return;
    openedNewRef.current = true;
    setEditingEncounter(undefined);
    setDialogOpen(true);
  }, [openNew]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeCard, setTypeCard] = useState<EncounterPrimaryType | null>(null);
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

  // The four summary cards count the whole loaded set, NOT the filtered one - a card that
  // restated the filter you just applied through it would always read 0 for the other three.
  const counts = useMemo(() => {
    const byType = { combat: 0, social: 0, exploration: 0 };
    encounters.forEach((encounter) => {
      if (encounter.primaryType) byType[encounter.primaryType] += 1;
    });
    return { total: encounters.length, ...byType, untyped: encounters.length - byType.combat - byType.social - byType.exploration };
  }, [encounters]);

  const filteredEncounters = encounters.filter((encounter) => {
    const query = search.trim().toLowerCase();
    if (query && !encounter.name.toLowerCase().includes(query)) return false;
    if (typeCard && encounter.primaryType !== typeCard) return false;
    if (themeFilter.length > 0 && !themeFilter.includes(encounter.theme)) return false;
    if (crFilter.length > 0 && !crFilter.includes(encounter.challengeRating)) return false;
    if (typeFilter.length > 0 && !mobTypesFor(encounter).some((t) => typeFilter.includes(t))) return false;
    if (resolutionFilter.length > 0 && !resolutionFilter.includes(encounter.resolutionType)) return false;
    return true;
  });

  const toggle = (setter: Dispatch<SetStateAction<string[]>>, value: string) => {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };
  const activeFilterCount =
    themeFilter.length + crFilter.length + typeFilter.length + resolutionFilter.length;
  const clearFilters = () => {
    setThemeFilter([]);
    setCrFilter([]);
    setTypeFilter([]);
    setResolutionFilter([]);
  };
  const narrowed = activeFilterCount > 0 || !!typeCard || search.trim().length > 0;
  const clearEverything = () => {
    clearFilters();
    setTypeCard(null);
    setSearch('');
  };

  const openCreate = () => {
    setEditingEncounter(undefined);
    setDialogOpen(true);
  };

  return (
    <Stack spacing={2.5}>
      {/* ---- Page header ---------------------------------------------------------------- */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Box
            sx={{
              width: su(48),
              height: su(48),
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              flexShrink: 0,
              '& .MuiSvgIcon-root': { fontSize: su(28) },
            }}
          >
            <ShieldIcon />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <PageTitle noWrap>Encounters</PageTitle>
            <Typography variant="body2" color="text.secondary">
              The fights, scenes and obstacles you have built for this campaign, scored against your party.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', flexShrink: 0 }}>
          {onGoToTables && (
            <Tooltip title="Browse the random table library - and search encounters by category and tag alongside it">
              <Button variant="outlined" startIcon={<CasinoIcon />} onClick={onGoToTables}>
                Random Tables
              </Button>
            </Tooltip>
          )}
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => {
              setEncounterBuilderType(undefined);
              setEncounterBuilderOpen(true);
            }}
          >
            Generate
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            New Encounter
          </Button>
        </Stack>
      </Stack>

      {/* ---- Summary cards, which double as the primary-type filter ----------------------- */}
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <SummaryCard
          icon={<ShieldIcon />}
          label="All encounters"
          value={counts.total}
          color="primary"
          selected={typeCard === null}
          onClick={() => setTypeCard(null)}
          hint={counts.untyped > 0 ? `${counts.untyped} have no type set yet` : undefined}
        />
        <SummaryCard
          icon={<SportsKabaddiIcon />}
          label="Combat"
          value={counts.combat}
          color="error"
          selected={typeCard === 'combat'}
          onClick={() => setTypeCard((current) => (current === 'combat' ? null : 'combat'))}
        />
        <SummaryCard
          icon={<ForumOutlinedIcon />}
          label="Social"
          value={counts.social}
          color="info"
          selected={typeCard === 'social'}
          onClick={() => setTypeCard((current) => (current === 'social' ? null : 'social'))}
        />
        <SummaryCard
          icon={<ExploreOutlinedIcon />}
          label="Exploration"
          value={counts.exploration}
          color="success"
          selected={typeCard === 'exploration'}
          onClick={() => setTypeCard((current) => (current === 'exploration' ? null : 'exploration'))}
        />
      </Stack>

      {/* ---- Control bar ------------------------------------------------------------------
          Search sits in the open rather than behind the magnifier it used to hide behind: on
          this page finding one encounter you already know the name of IS the primary job, so
          it should not cost a click to start typing. That is why this bar is hand-rolled
          instead of reusing FilterBar, whose search is part of the collapsed panel. */}
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ alignItems: { lg: 'center' } }}>
          <TextField
            size="small"
            placeholder="Search encounters by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 220 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', lg: 'block' } }} />

          <Tooltip title="The assumed party every encounter's difficulty badge is scored against">
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 850, letterSpacing: 0.4, color: 'text.secondary', textTransform: 'uppercase' }}
              >
                Party
              </Typography>
              <TextField
                size="small"
                type="number"
                label="Players"
                value={party.partySize}
                onChange={(e) => setPartySize(campaignId, Number(e.target.value) || 1)}
                slotProps={{ htmlInput: { min: 1, max: 20 } }}
                sx={{ width: su(104) }}
              />
              <TextField
                size="small"
                type="number"
                label="Level"
                value={party.partyLevel}
                onChange={(e) => setPartyLevel(campaignId, Number(e.target.value) || 1)}
                slotProps={{ htmlInput: { min: 1, max: 20 } }}
                sx={{ width: su(104) }}
              />
            </Stack>
          </Tooltip>

          <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', lg: 'block' } }} />

          <Tooltip title="This campaign's own encounters and the shared reference library are always shown. Turn this on to also include every other campaign's encounters.">
            <FormControlLabel
              sx={{ mr: 0, flexShrink: 0 }}
              control={<Switch size="small" checked={allCampaigns} onChange={(e) => setAllCampaigns(e.target.checked)} />}
              label={<Typography variant="body2">All campaigns</Typography>}
            />
          </Tooltip>

          <Button
            variant={filterOpen || activeFilterCount > 0 ? 'contained' : 'outlined'}
            startIcon={<TuneIcon />}
            onClick={() => setFilterOpen((v) => !v)}
            sx={{ flexShrink: 0 }}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
        </Stack>

        <Collapse in={filterOpen}>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: 'wrap' }}>
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
              label="Resolution"
              options={[
                { value: 'fixed', label: 'Fixed roster' },
                { value: 'random_table', label: 'Random table' },
              ]}
              selected={resolutionFilter}
              onToggle={(v) => toggle(setResolutionFilter, v)}
            />
          </Stack>
          {activeFilterCount > 0 && (
            <Button size="small" onClick={clearFilters} sx={{ mt: 1.5 }}>
              Clear filters
            </Button>
          )}
        </Collapse>
      </Paper>

      {/* ---- Result count, so a narrowed list never looks like an empty library ----------- */}
      {encounters.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
          <Chip
            size="small"
            label={`${filteredEncounters.length} of ${counts.total} shown`}
            variant={narrowed ? 'filled' : 'outlined'}
            color={narrowed ? 'primary' : 'default'}
          />
          {typeCard && <Chip size="small" label={TYPE_LABELS[typeCard]} onDelete={() => setTypeCard(null)} />}
          {search.trim() && <Chip size="small" label={`“${search.trim()}”`} onDelete={() => setSearch('')} />}
          {narrowed && (
            <Button size="small" color="inherit" onClick={clearEverything}>
              Reset
            </Button>
          )}
        </Stack>
      )}

      {/* ---- Results ---------------------------------------------------------------------- */}
      {encounters.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
          <ShieldIcon sx={{ fontSize: su(56), mb: 1, color: 'text.disabled' }} />
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            No encounters yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Build one by hand, roll one up from a generator, or pull one out of the random table library.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', flexWrap: 'wrap' }} useFlexGap>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              New Encounter
            </Button>
            <Button
              variant="outlined"
              startIcon={<AutoAwesomeIcon />}
              onClick={() => {
                setEncounterBuilderType(undefined);
                setEncounterBuilderOpen(true);
              }}
            >
              Generate
            </Button>
            {onGoToTables && (
              <Button variant="outlined" startIcon={<CasinoIcon />} onClick={onGoToTables}>
                Random Tables
              </Button>
            )}
          </Stack>
        </Box>
      ) : filteredEncounters.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
          <Typography variant="body1" sx={{ mb: 0.5 }}>
            Nothing matches those filters.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {counts.total} encounters are loaded — widen the search to see them.
          </Typography>
          <Button variant="outlined" onClick={clearEverything}>
            Reset filters
          </Button>
        </Box>
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
        onEdit={(encounter) => {
          setViewingEncounter(null);
          setEditingEncounter(encounter);
          setDialogOpen(true);
        }}
      />

      <EncounterFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingEncounter(undefined);
        }}
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
        onAdd={(encounter) => {
          addEncounterToCampaign(campaignId, encounter);
          setEncounterBuilderOpen(false);
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
    </Stack>
  );
}

const TYPE_LABELS: Record<EncounterPrimaryType, string> = {
  combat: 'Combat',
  social: 'Social',
  exploration: 'Exploration',
};

type SummaryColor = 'primary' | 'error' | 'info' | 'success';

/** One card in the summary strip. It is a button, not a statistic: the count and the filter for
 * that count are the same affordance, so a DM who reads "12 combat" can act on it where they
 * read it instead of hunting for Combat in a filter panel. */
function SummaryCard({
  icon,
  label,
  value,
  color,
  selected,
  onClick,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  color: SummaryColor;
  selected: boolean;
  onClick: () => void;
  hint?: string;
}) {
  // A count of 0 is worth showing - "you have no social encounters" is information - but it is
  // not worth clicking, since filtering to it can only produce the empty state.
  const dead = value === 0 && !selected;

  const card = (
    <ButtonBase
      onClick={onClick}
      disabled={dead}
      aria-pressed={selected}
      sx={{
        // Capped, not free-growing: four cards splitting a wide window gave each one ~370px of
        // near-empty card for a two-digit number and one word.
        flex: '1 1 auto',
        minWidth: su(150),
        maxWidth: su(240),
        justifyContent: 'flex-start',
        textAlign: 'left',
        p: 1.5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: selected ? `${color}.main` : 'divider',
        bgcolor: selected ? `${color}.main` : 'background.paper',
        color: selected ? `${color}.contrastText` : 'text.primary',
        opacity: dead ? 0.55 : 1,
        transition: 'border-color 120ms, background-color 120ms, opacity 120ms',
        '&:hover': { borderColor: `${color}.main`, bgcolor: selected ? `${color}.dark` : 'action.hover' },
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', width: '100%', minWidth: 0 }}>
        <Box
          sx={{
            width: su(36),
            height: su(36),
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            bgcolor: selected ? 'transparent' : `${color}.main`,
            color: selected ? 'inherit' : `${color}.contrastText`,
            border: selected ? '1px solid' : 'none',
            borderColor: 'currentColor',
            '& .MuiSvgIcon-root': { fontSize: su(20) },
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 850, lineHeight: 1.1 }}>
            {value}
          </Typography>
          <Typography variant="caption" noWrap sx={{ opacity: selected ? 0.9 : 0.7, display: 'block' }}>
            {label}
          </Typography>
        </Box>
      </Stack>
    </ButtonBase>
  );

  // The <span>-style wrapper is what lets a DISABLED card still raise its tooltip - a disabled
  // element fires no pointer events of its own (same trick as IconRail's rail buttons).
  return hint || dead ? (
    <Tooltip title={hint ?? `No ${label.toLowerCase()} encounters`}>
      <Box sx={{ display: 'flex', flex: '1 1 auto', minWidth: su(150), maxWidth: su(240) }}>{card}</Box>
    </Tooltip>
  ) : (
    card
  );
}
