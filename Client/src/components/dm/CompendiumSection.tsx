import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/CardActionArea';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import TablePagination from '@mui/material/TablePagination';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PetsIcon from '@mui/icons-material/Pets';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import DiamondIcon from '@mui/icons-material/Diamond';
import { CreaturesTable } from './CreaturesTable';
import { CreatureFormDialog } from './CreatureFormDialog';
import { CreatureStatBlockDialog } from './CreatureStatBlockDialog';
import { SpellsTable } from './SpellsTable';
import { SpellFormDialog } from './SpellFormDialog';
import { MagicItemsTable } from './MagicItemsTable';
import { MagicItemFormDialog } from './MagicItemFormDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { FilterBar } from './FilterBar';
import { FilterChipGroup } from './FilterChipGroup';
import { useCreatureStore, getCreaturesForCampaign } from '../../store/useCreatureStore';
import { useSpellStore, getSpellsForCampaign } from '../../store/useSpellStore';
import { useMagicItemStore, getMagicItemsForCampaign } from '../../store/useMagicItemStore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { CREATURE_ALIGNMENT_OPTIONS, CREATURE_TYPE_OPTIONS, type Creature } from '../../types/creature';
import TextField from '@mui/material/TextField';
import { SPELL_CLASS_OPTIONS, SPELL_SCHOOL_OPTIONS, formatSpellLevel, type Spell } from '../../types/spell';
import { MAGIC_ITEM_RARITY_OPTIONS, type MagicItem } from '../../types/magicItem';

interface CompendiumSectionProps {
  campaignId: string;
  /** World this CompendiumSection is rendered under, if any - threaded into the
   * Creature/Spell/MagicItem FormDialogs so they can offer the "also create a world
   * article" checkbox (issue 4c/4g). Omit when this section is rendered without a world
   * in scope. */
  worldId?: string;
  /** Deep-link support (e.g. from the Play page's Items window "open in new tab") - opens the
   * matching creature/spell/item's detail as soon as it's found, independent of whatever page/
   * filter the browse table is currently on. */
  openCreatureId?: string;
  openSpellId?: string;
  openItemId?: string;
  /** Pins the section to one catalog and drops the card menu entirely: the World manager
   * renders Monsters under People and Spells/Magic Items under Codex, where the sidebar is
   * already the navigation and a "back to menu" arrow would lead nowhere sensible. Omit it
   * to get the normal menu -> catalog flow the standalone Compendium page uses. */
  lockedView?: Exclude<CompendiumView, 'menu'>;
}

/** Reference/catalog material - monster stat blocks, spells, and magic items. NPCs (people
 * in the campaign, as opposed to vanilla monster-manual stat blocks) moved to their own
 * top-level DM Panel tab (NpcsSection) since they gained enough NPC-only structure (a
 * Custom/Creature toggle, a base-creature link, roleplay fields) to no longer fit this
 * "menu -> catalog sub-view" shape cleanly. */
type CompendiumView = 'menu' | 'monsters' | 'spells' | 'items';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

const MENU_CARDS: { view: CompendiumView; icon: React.ReactNode; title: string; description: string }[] = [
  { view: 'monsters', icon: <PetsIcon sx={{ fontSize: 40 }} color="primary" />, title: 'Monsters', description: 'Vanilla stat blocks' },
  { view: 'spells', icon: <AutoStoriesIcon sx={{ fontSize: 40 }} color="primary" />, title: 'Spells', description: 'Spell reference' },
  { view: 'items', icon: <DiamondIcon sx={{ fontSize: 40 }} color="primary" />, title: 'Magic Items', description: 'Item reference' },
];

function SectionHeader({
  title,
  onBack,
  onAdd,
  addLabel,
  filterOpen,
  onToggleFilter,
  allCampaigns,
  onToggleAllCampaigns,
}: {
  title: string;
  /** Omitted when the section is pinned to one catalog (`lockedView`) - there is no menu to
   * go back to, so the arrow is left out rather than rendered inert. */
  onBack?: () => void;
  onAdd: () => void;
  addLabel: string;
  filterOpen: boolean;
  onToggleFilter: () => void;
  allCampaigns: boolean;
  onToggleAllCampaigns: (value: boolean) => void;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        {onBack && (
          <IconButton size="small" onClick={onBack}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Tooltip title="This campaign's homebrew and the shared reference library are always shown. Turn this on to also include homebrew from every other campaign.">
          <FormControlLabel
            sx={{ mr: 0.5 }}
            control={
              <Switch size="small" checked={allCampaigns} onChange={(e) => onToggleAllCampaigns(e.target.checked)} />
            }
            label={<Typography variant="body2">All campaigns</Typography>}
          />
        </Tooltip>
        <Tooltip title="Search & filter">
          <IconButton color={filterOpen ? 'primary' : 'default'} onClick={onToggleFilter}>
            <SearchIcon />
          </IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
          {addLabel}
        </Button>
      </Stack>
    </Stack>
  );
}

function EmptyState({ icon, title, isFiltered }: { icon: React.ReactNode; title: string; isFiltered: boolean }) {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
      {icon}
      <Typography variant="h6" sx={{ mb: 0.5, mt: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {isFiltered ? 'Nothing matches your search/filters.' : 'Add one to get started.'}
      </Typography>
    </Box>
  );
}

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export function CompendiumSection({ campaignId, worldId, openCreatureId, openSpellId, openItemId, lockedView }: CompendiumSectionProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<CompendiumView>(lockedView ?? 'menu');
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // Shared across all 3 browse views - only one is ever visible at a time.
  const [page, setPage] = useState(0); // 0-indexed, matches MUI TablePagination
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [allCampaigns, setAllCampaigns] = useState(false);

  // monsters
  const [creatureDialogOpen, setCreatureDialogOpen] = useState(false);
  const [editingCreature, setEditingCreature] = useState<Creature | undefined>(undefined);
  const [viewingCreature, setViewingCreature] = useState<Creature | null>(null);
  const [deleteCreatureTarget, setDeleteCreatureTarget] = useState<Creature | null>(null);
  const [alignmentFilter, setAlignmentFilter] = useState<string[]>([]);
  const [typeFilterMonster, setTypeFilterMonster] = useState<string[]>([]);
  const [acMin, setAcMin] = useState<number | ''>('');
  const [acMax, setAcMax] = useState<number | ''>('');
  const [crMinFilter, setCrMinFilter] = useState<number | ''>('');
  const [crMaxFilter, setCrMaxFilter] = useState<number | ''>('');
  const creatureBrowse = useCreatureStore((s) => s.creatureBrowse);
  const creatureBrowseLoading = useCreatureStore((s) => s.creatureBrowseLoading);
  const fetchCreatureBrowse = useCreatureStore((s) => s.fetchCreatureBrowse);
  const addCreatureToCampaign = useCreatureStore((s) => s.addCreatureToCampaign);
  const updateCreatureInCampaign = useCreatureStore((s) => s.updateCreatureInCampaign);
  const deleteCreatureFromCampaign = useCreatureStore((s) => s.deleteCreatureFromCampaign);

  // spells
  const [spellDialogOpen, setSpellDialogOpen] = useState(false);
  const [editingSpell, setEditingSpell] = useState<Spell | undefined>(undefined);
  const [deleteSpellTarget, setDeleteSpellTarget] = useState<Spell | null>(null);
  const [schoolFilter, setSchoolFilter] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const spellBrowse = useSpellStore((s) => s.spellBrowse);
  const spellBrowseLoading = useSpellStore((s) => s.spellBrowseLoading);
  const fetchSpellBrowse = useSpellStore((s) => s.fetchSpellBrowse);
  const addSpellToCampaign = useSpellStore((s) => s.addSpellToCampaign);
  const updateSpellInCampaign = useSpellStore((s) => s.updateSpellInCampaign);
  const deleteSpellFromCampaign = useSpellStore((s) => s.deleteSpellFromCampaign);

  // magic items
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MagicItem | undefined>(undefined);
  const [deleteItemTarget, setDeleteItemTarget] = useState<MagicItem | null>(null);
  const [rarityFilter, setRarityFilter] = useState<string[]>([]);
  const [attunementFilter, setAttunementFilter] = useState<string[]>([]);
  const magicItemBrowse = useMagicItemStore((s) => s.magicItemBrowse);
  const magicItemBrowseLoading = useMagicItemStore((s) => s.magicItemBrowseLoading);
  const fetchMagicItemBrowse = useMagicItemStore((s) => s.fetchMagicItemBrowse);
  const addMagicItemToCampaign = useMagicItemStore((s) => s.addMagicItemToCampaign);
  const updateMagicItemInCampaign = useMagicItemStore((s) => s.updateMagicItemInCampaign);
  const deleteMagicItemFromCampaign = useMagicItemStore((s) => s.deleteMagicItemFromCampaign);

  const scope = allCampaigns ? 'all' : 'own_or_global';

  // Reset to page 1 whenever the active view or any search/filter/scope input changes -
  // otherwise e.g. typing a search on page 5 would silently request an out-of-range page.
  const filterSignature = JSON.stringify({
    view,
    scope,
    debouncedSearch,
    alignmentFilter,
    typeFilterMonster,
    acMin,
    acMax,
    crMinFilter,
    crMaxFilter,
    schoolFilter,
    levelFilter,
    classFilter,
    rarityFilter,
    attunementFilter,
  });
  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature]);

  useEffect(() => {
    if (view !== 'monsters') return;
    fetchCreatureBrowse({
      campaignId,
      category: 'monster',
      scope,
      page: page + 1,
      pageSize,
      search: debouncedSearch,
      alignment: alignmentFilter,
      creatureType: typeFilterMonster,
      acMin: acMin === '' ? undefined : acMin,
      acMax: acMax === '' ? undefined : acMax,
      crMin: crMinFilter === '' ? undefined : crMinFilter,
      crMax: crMaxFilter === '' ? undefined : crMaxFilter,
    });
  }, [
    view,
    campaignId,
    scope,
    page,
    pageSize,
    debouncedSearch,
    alignmentFilter,
    typeFilterMonster,
    acMin,
    acMax,
    crMinFilter,
    crMaxFilter,
    fetchCreatureBrowse,
  ]);

  useEffect(() => {
    if (view !== 'spells') return;
    fetchSpellBrowse({
      campaignId,
      scope,
      page: page + 1,
      pageSize,
      search: debouncedSearch,
      school: schoolFilter,
      level: levelFilter.map(Number),
      classes: classFilter,
    });
  }, [view, campaignId, scope, page, pageSize, debouncedSearch, schoolFilter, levelFilter, classFilter, fetchSpellBrowse]);

  useEffect(() => {
    if (view !== 'items') return;
    const requiresAttunement = attunementFilter.length === 1 ? attunementFilter[0] === 'yes' : undefined;
    fetchMagicItemBrowse({
      campaignId,
      scope,
      page: page + 1,
      pageSize,
      search: debouncedSearch,
      rarity: rarityFilter,
      requiresAttunement,
    });
  }, [view, campaignId, scope, page, pageSize, debouncedSearch, rarityFilter, attunementFilter, fetchMagicItemBrowse]);

  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);
  const spellsByCampaignId = useSpellStore((s) => s.spellsByCampaignId);
  const fetchSpellsForCampaign = useSpellStore((s) => s.fetchSpellsForCampaign);
  const magicItemsByCampaignId = useMagicItemStore((s) => s.magicItemsByCampaignId);
  const fetchMagicItemsForCampaign = useMagicItemStore((s) => s.fetchMagicItemsForCampaign);
  const creaturesById = useCreatureStore((s) => s.creaturesById);
  const fetchCreatureById = useCreatureStore((s) => s.fetchCreatureById);
  const spellsById = useSpellStore((s) => s.spellsById);
  const fetchSpellById = useSpellStore((s) => s.fetchSpellById);
  const magicItemsById = useMagicItemStore((s) => s.magicItemsById);
  const fetchMagicItemById = useMagicItemStore((s) => s.fetchMagicItemById);

  /** The campaign lists hold only the campaign's own rows, so a deep link to a global catalog
   * entry (an SRD monster found by the World manager's search, say) is also fetched by id. */
  useEffect(() => {
    if (openCreatureId) {
      fetchCreaturesForCampaign(campaignId);
      fetchCreatureById(openCreatureId);
    }
    if (openSpellId) {
      fetchSpellsForCampaign(campaignId);
      fetchSpellById(openSpellId);
    }
    if (openItemId) {
      fetchMagicItemsForCampaign(campaignId);
      fetchMagicItemById(openItemId);
    }
  }, [
    campaignId,
    openCreatureId,
    openSpellId,
    openItemId,
    fetchCreaturesForCampaign,
    fetchSpellsForCampaign,
    fetchMagicItemsForCampaign,
    fetchCreatureById,
    fetchSpellById,
    fetchMagicItemById,
  ]);

  const deepLinkedRef = useRef<string | null>(null);
  useEffect(() => {
    if (openCreatureId && deepLinkedRef.current !== `creature:${openCreatureId}`) {
      const target = getCreaturesForCampaign(creaturesByCampaignId, campaignId).find((c) => c.id === openCreatureId) ?? creaturesById[openCreatureId];
      if (target) {
        deepLinkedRef.current = `creature:${openCreatureId}`;
        setView('monsters');
        setViewingCreature(target);
      }
    }
    if (openSpellId && deepLinkedRef.current !== `spell:${openSpellId}`) {
      const target = getSpellsForCampaign(spellsByCampaignId, campaignId).find((s) => s.id === openSpellId) ?? spellsById[openSpellId];
      if (target) {
        deepLinkedRef.current = `spell:${openSpellId}`;
        setView('spells');
        setEditingSpell(target);
        setSpellDialogOpen(true);
      }
    }
    if (openItemId && deepLinkedRef.current !== `item:${openItemId}`) {
      const target = getMagicItemsForCampaign(magicItemsByCampaignId, campaignId).find((i) => i.id === openItemId) ?? magicItemsById[openItemId];
      if (target) {
        deepLinkedRef.current = `item:${openItemId}`;
        setView('items');
        setEditingItem(target);
        setItemDialogOpen(true);
      }
    }
  }, [openCreatureId, openSpellId, openItemId, campaignId, creaturesByCampaignId, spellsByCampaignId, magicItemsByCampaignId, creaturesById, spellsById, magicItemsById]);

  /** Follow `lockedView` when it changes rather than only seeding `view` from it. The World
   * manager renders the same <CompendiumSection> element for Monsters, Spells and Magic
   * Items, so React reuses one instance across those sidebar switches and the initial state
   * alone would leave the previous catalog on screen. Call sites also pass a `key` so the
   * search box, page and filters reset with it; this keeps the component correct without one. */
  useEffect(() => {
    if (lockedView) setView(lockedView);
  }, [lockedView]);

  const goToView = (next: CompendiumView) => {
    setView(next);
    setFilterOpen(false);
    setSearch('');
    setPage(0);
  };

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPageSize(Number(e.target.value));
    setPage(0);
  };

  if (view === 'menu') {
    return (
      <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
        {MENU_CARDS.map((card) => (
          <Paper key={card.view} elevation={2} sx={{ borderRadius: 4, width: 220 }}>
            <Card onClick={() => goToView(card.view)} sx={{ p: 3, borderRadius: 4 }}>
              <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
                {card.icon}
                <Typography variant="h6">{card.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {card.description}
                </Typography>
              </Stack>
            </Card>
          </Paper>
        ))}
      </Stack>
    );
  }

  if (view === 'monsters') {
    const items = creatureBrowse?.items ?? [];
    const total = creatureBrowse?.total ?? 0;
    const hasActiveFilters =
      alignmentFilter.length > 0 ||
      typeFilterMonster.length > 0 ||
      acMin !== '' ||
      acMax !== '' ||
      crMinFilter !== '' ||
      crMaxFilter !== '';
    const isFiltered = !!debouncedSearch || hasActiveFilters;
    return (
      <Box>
        <SectionHeader
          title="Monsters"
          onBack={lockedView ? undefined : () => goToView('menu')}
          addLabel="Add Monster"
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((v) => !v)}
          allCampaigns={allCampaigns}
          onToggleAllCampaigns={setAllCampaigns}
          onAdd={() => {
            setEditingCreature(undefined);
            setCreatureDialogOpen(true);
          }}
        />
        {filterOpen && (
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search monsters by name or traits…"
            hasActiveFilters={hasActiveFilters}
            onClearFilters={() => {
              setAlignmentFilter([]);
              setTypeFilterMonster([]);
              setAcMin('');
              setAcMax('');
              setCrMinFilter('');
              setCrMaxFilter('');
            }}
          >
            <FilterChipGroup
              label="Alignment"
              options={CREATURE_ALIGNMENT_OPTIONS}
              selected={alignmentFilter}
              onToggle={(v) => setAlignmentFilter((prev) => toggleInArray(prev, v))}
            />
            <FilterChipGroup
              label="Creature Type"
              options={CREATURE_TYPE_OPTIONS}
              selected={typeFilterMonster}
              onToggle={(v) => setTypeFilterMonster((prev) => toggleInArray(prev, v))}
            />
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                AC
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  type="number"
                  label="Min"
                  value={acMin}
                  onChange={(e) => setAcMin(e.target.value === '' ? '' : Number(e.target.value))}
                  sx={{ width: 90 }}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Max"
                  value={acMax}
                  onChange={(e) => setAcMax(e.target.value === '' ? '' : Number(e.target.value))}
                  sx={{ width: 90 }}
                />
              </Stack>
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                CR
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  type="number"
                  label="Min"
                  value={crMinFilter}
                  onChange={(e) => setCrMinFilter(e.target.value === '' ? '' : Number(e.target.value))}
                  sx={{ width: 90 }}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Max"
                  value={crMaxFilter}
                  onChange={(e) => setCrMaxFilter(e.target.value === '' ? '' : Number(e.target.value))}
                  sx={{ width: 90 }}
                />
              </Stack>
            </Stack>
          </FilterBar>
        )}
        {creatureBrowseLoading && items.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : total === 0 ? (
          <EmptyState icon={<PetsIcon sx={{ fontSize: 56, color: 'text.disabled' }} />} title="No monsters yet" isFiltered={isFiltered} />
        ) : (
          <>
            <Box sx={{ opacity: creatureBrowseLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <CreaturesTable
                creatures={items}
                category="monster"
                onView={(creature) => setViewingCreature(creature)}
                onEdit={(creature) => {
                  setEditingCreature(creature);
                  setCreatureDialogOpen(true);
                }}
                onDelete={(creature) => setDeleteCreatureTarget(creature)}
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

        <CreatureFormDialog
          open={creatureDialogOpen}
          onClose={() => setCreatureDialogOpen(false)}
          initialCreature={editingCreature}
          worldId={worldId}
          onSubmit={(creature, articleOutcome) => {
            if (editingCreature) updateCreatureInCampaign(campaignId, creature);
            else addCreatureToCampaign(campaignId, creature);
            setCreatureDialogOpen(false);
            setEditingCreature(undefined);
            if (worldId && articleOutcome) navigate(`/w/${worldId}/manager/entry/${articleOutcome.createdArticleId}`);
          }}
        />
        <CreatureStatBlockDialog open={!!viewingCreature} creature={viewingCreature} onClose={() => setViewingCreature(null)} />
        <ConfirmDeleteDialog
          open={!!deleteCreatureTarget}
          itemName={deleteCreatureTarget?.name ?? ''}
          itemType="monster"
          onCancel={() => setDeleteCreatureTarget(null)}
          onConfirm={() => {
            if (deleteCreatureTarget) deleteCreatureFromCampaign(campaignId, deleteCreatureTarget.id);
            setDeleteCreatureTarget(null);
          }}
        />
      </Box>
    );
  }

  if (view === 'spells') {
    const items = spellBrowse?.items ?? [];
    const total = spellBrowse?.total ?? 0;
    const isFiltered = !!debouncedSearch || schoolFilter.length > 0 || levelFilter.length > 0 || classFilter.length > 0;
    const hasActiveFilters = schoolFilter.length > 0 || levelFilter.length > 0 || classFilter.length > 0;
    const levelOptions = Array.from({ length: 10 }, (_, i) => String(i));
    return (
      <Box>
        <SectionHeader
          title="Spells"
          onBack={lockedView ? undefined : () => goToView('menu')}
          addLabel="Add Spell"
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((v) => !v)}
          allCampaigns={allCampaigns}
          onToggleAllCampaigns={setAllCampaigns}
          onAdd={() => {
            setEditingSpell(undefined);
            setSpellDialogOpen(true);
          }}
        />
        {filterOpen && (
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search spells by name…"
            hasActiveFilters={hasActiveFilters}
            onClearFilters={() => {
              setSchoolFilter([]);
              setLevelFilter([]);
              setClassFilter([]);
            }}
          >
            <FilterChipGroup
              label="School"
              options={SPELL_SCHOOL_OPTIONS.map((s) => ({ value: s, label: s }))}
              selected={schoolFilter}
              onToggle={(v) => setSchoolFilter((prev) => toggleInArray(prev, v))}
            />
            <FilterChipGroup
              label="Level"
              options={levelOptions.map((l) => ({ value: l, label: formatSpellLevel(Number(l)) }))}
              selected={levelFilter}
              onToggle={(v) => setLevelFilter((prev) => toggleInArray(prev, v))}
            />
            <FilterChipGroup
              label="Class"
              options={SPELL_CLASS_OPTIONS.map((c) => ({ value: c, label: c }))}
              selected={classFilter}
              onToggle={(v) => setClassFilter((prev) => toggleInArray(prev, v))}
            />
          </FilterBar>
        )}
        {spellBrowseLoading && items.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : total === 0 ? (
          <EmptyState icon={<AutoStoriesIcon sx={{ fontSize: 56, color: 'text.disabled' }} />} title="No spells yet" isFiltered={isFiltered} />
        ) : (
          <>
            <Box sx={{ opacity: spellBrowseLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <SpellsTable
                spells={items}
                onEdit={(spell) => {
                  setEditingSpell(spell);
                  setSpellDialogOpen(true);
                }}
                onDelete={(spell) => setDeleteSpellTarget(spell)}
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

        <SpellFormDialog
          open={spellDialogOpen}
          onClose={() => setSpellDialogOpen(false)}
          initialSpell={editingSpell}
          worldId={worldId}
          onSubmit={(spell, articleOutcome) => {
            if (editingSpell) updateSpellInCampaign(campaignId, spell);
            else addSpellToCampaign(campaignId, spell);
            setSpellDialogOpen(false);
            setEditingSpell(undefined);
            if (worldId && articleOutcome) navigate(`/w/${worldId}/manager/entry/${articleOutcome.createdArticleId}`);
          }}
        />
        <ConfirmDeleteDialog
          open={!!deleteSpellTarget}
          itemName={deleteSpellTarget?.name ?? ''}
          itemType="spell"
          onCancel={() => setDeleteSpellTarget(null)}
          onConfirm={() => {
            if (deleteSpellTarget) deleteSpellFromCampaign(campaignId, deleteSpellTarget.id);
            setDeleteSpellTarget(null);
          }}
        />
      </Box>
    );
  }

  const items = magicItemBrowse?.items ?? [];
  const total = magicItemBrowse?.total ?? 0;
  const isFilteredItems = !!debouncedSearch || rarityFilter.length > 0 || attunementFilter.length > 0;
  const hasActiveItemFilters = rarityFilter.length > 0 || attunementFilter.length > 0;

  return (
    <Box>
      <SectionHeader
        title="Magic Items"
        onBack={lockedView ? undefined : () => goToView('menu')}
        addLabel="Add Item"
        filterOpen={filterOpen}
        onToggleFilter={() => setFilterOpen((v) => !v)}
        allCampaigns={allCampaigns}
        onToggleAllCampaigns={setAllCampaigns}
        onAdd={() => {
          setEditingItem(undefined);
          setItemDialogOpen(true);
        }}
      />
      {filterOpen && (
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search magic items by name…"
          hasActiveFilters={hasActiveItemFilters}
          onClearFilters={() => {
            setRarityFilter([]);
            setAttunementFilter([]);
          }}
        >
          <FilterChipGroup
            label="Rarity"
            options={MAGIC_ITEM_RARITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selected={rarityFilter}
            onToggle={(v) => setRarityFilter((prev) => toggleInArray(prev, v))}
          />
          <FilterChipGroup
            label="Attunement"
            options={[{ value: 'yes', label: 'Requires attunement' }, { value: 'no', label: 'No attunement' }]}
            selected={attunementFilter}
            onToggle={(v) => setAttunementFilter((prev) => toggleInArray(prev, v))}
          />
        </FilterBar>
      )}
      {magicItemBrowseLoading && items.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : total === 0 ? (
        <EmptyState icon={<DiamondIcon sx={{ fontSize: 56, color: 'text.disabled' }} />} title="No magic items yet" isFiltered={isFilteredItems} />
      ) : (
        <>
          <Box sx={{ opacity: magicItemBrowseLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            <MagicItemsTable
              items={items}
              onEdit={(item) => {
                setEditingItem(item);
                setItemDialogOpen(true);
              }}
              onDelete={(item) => setDeleteItemTarget(item)}
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

      <MagicItemFormDialog
        open={itemDialogOpen}
        onClose={() => setItemDialogOpen(false)}
        initialItem={editingItem}
        worldId={worldId}
        onSubmit={(item, articleOutcome) => {
          if (editingItem) updateMagicItemInCampaign(campaignId, item);
          else addMagicItemToCampaign(campaignId, item);
          setItemDialogOpen(false);
          setEditingItem(undefined);
          if (worldId && articleOutcome) navigate(`/w/${worldId}/manager/entry/${articleOutcome.createdArticleId}`);
        }}
      />
      <ConfirmDeleteDialog
        open={!!deleteItemTarget}
        itemName={deleteItemTarget?.name ?? ''}
        itemType="magic item"
        onCancel={() => setDeleteItemTarget(null)}
        onConfirm={() => {
          if (deleteItemTarget) deleteMagicItemFromCampaign(campaignId, deleteItemTarget.id);
          setDeleteItemTarget(null);
        }}
      />
    </Box>
  );
}
