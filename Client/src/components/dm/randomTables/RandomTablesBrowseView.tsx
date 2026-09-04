import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import CasinoIcon from '@mui/icons-material/Casino';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ListAltIcon from '@mui/icons-material/ListAlt';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ForestOutlinedIcon from '@mui/icons-material/ForestOutlined';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PublicIcon from '@mui/icons-material/Public';
import PetsOutlinedIcon from '@mui/icons-material/PetsOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { CategoryGraphBrowser } from './CategoryGraphBrowser';
import { categoryIconFor } from './CategoryIcon';
import { TagPicker } from './TagPicker';
import { RollResultView } from './RollResultView';
import { RandomTableEditor } from './RandomTableEditor';
import { RandomTableFullView } from './RandomTableFullView';
import { RandomTableSearchField } from './RandomTableSearchField';
import {
  buildTableSearchIndex,
  computeCategoryCounts,
  computeFormatCounts,
  computeTagCounts,
  filterTablesByQuery,
  rankTablesByUsefulness,
  subtreeCategoryIds,
  type TableUsefulnessSignals,
} from './tableSearch';
import { FilterChipGroup } from '../FilterChipGroup';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { EMPTY_RANDOM_TABLE_RESULTS, useRandomTableStore } from '../../../store/useRandomTableStore';
import { useCategoryStore, categoryPath } from '../../../store/useCategoryStore';
import { useTagStore } from '../../../store/useTagStore';
import { useTableFormatStore } from '../../../store/useTableFormatStore';
import { useTableUsageStore, getTableUsage } from '../../../store/useTableUsageStore';
import type { RandomTable, RandomTableDetail, RollResult } from '../../../types/randomTable';
import type { Tag } from '../../../types/tag';
import type { PlaceType } from '../../world/PlaceBuilderDialog';
import type { EncounterPrimaryType } from '../../../types/encounter';

interface RandomTablesBrowseViewProps {
  campaignId: string;
  /** Deep link from the Play page's Items window ("open in new tab" on a table row) - opens
   * this table's roll view once, as soon as its detail has loaded. */
  openTableId?: string;
  onBack?: () => void;
  onGoToEncounters?: () => void;
  onOpenEncounter?: (encounterId: string) => void;
  onOpenNpcBuilder?: () => void;
  onOpenPlaceBuilder?: (type?: PlaceType) => void;
  onOpenEncounterBuilder?: (type?: EncounterPrimaryType) => void;
}

function TableRollDialog({ table, onClose, onOpenEncounter, onRolled }: { table: RandomTableDetail; onClose: () => void; onOpenEncounter?: (encounterId: string) => void; onRolled?: (tableId: string) => void }) {
  const formats = useTableFormatStore((s) => s.formats);
  const roll = useRandomTableStore((s) => s.roll);
  const format = formats.find((item) => item.id === table.formatId);
  const slug = format?.slug ?? '';
  const [result, setResult] = useState<RollResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const [modifier, setModifier] = useState(0);
  const [counter, setCounter] = useState(0);
  const [likelihood, setLikelihood] = useState(0.5);
  const [chancePercent, setChancePercent] = useState('');
  const [drawnEntryIds, setDrawnEntryIds] = useState<string[]>([]);
  const [branchState, setBranchState] = useState('{}');

  const handleRoll = async () => {
    setRolling(true);
    const body: Record<string, unknown> = {};
    if (slug === 'check_table') body.modifier = modifier;
    if (slug === 'clock') body.counter = counter;
    if (slug === 'oracle') body.likelihood = likelihood;
    if (slug === 'chance_gate' && chancePercent.trim()) body.chance_percent = Number(chancePercent);
    if (slug === 'deck' || slug === 'countdown_deck') body.drawn_entry_ids = drawnEntryIds;
    if (slug === 'branching') {
      try { body.state = JSON.parse(branchState); } catch { body.state = {}; }
    }
    const rolled = await roll(table.id, body);
    setRolling(false);
    if (!rolled) return;
    setResult(rolled);
    onRolled?.(table.id);
    if (slug === 'deck' || slug === 'countdown_deck') {
      setDrawnEntryIds((current) => [...current, ...rolled.items.map((item) => item.entryId).filter((id): id is string => !!id)]);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { borderRadius: 4, height: 'min(90vh, 900px)' } } }}>
      <DialogTitle sx={{ px: 3, py: 2 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>Roll table</Typography><Typography variant="caption" color="text.secondary">Review every result before the dice decide.</Typography></Box>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ minHeight: '100%' }}>
          <Box sx={{ flexGrow: 1, minWidth: 0, p: 3, overflow: 'auto' }}><RandomTableFullView table={table} onOpenEncounter={onOpenEncounter} /></Box>
          <Box sx={{ width: { xs: '100%', md: 330 }, flexShrink: 0, p: 2.5, borderLeft: { md: '1px solid' }, borderTop: { xs: '1px solid', md: 0 }, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Stack spacing={2} sx={{ position: { md: 'sticky' }, top: 0 }}>
              <Box><Typography variant="overline" color="text.secondary">Dice console</Typography><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{format?.name ?? 'Random table'}</Typography></Box>
              {slug === 'check_table' && <TextField size="small" type="number" label="Modifier" value={modifier} onChange={(event) => setModifier(Number(event.target.value) || 0)} />}
              {slug === 'clock' && <TextField size="small" type="number" label="Current counter" value={counter} onChange={(event) => setCounter(Number(event.target.value) || 0)} />}
              {slug === 'oracle' && <Box><Typography variant="caption">Likelihood · {Math.round(likelihood * 100)}%</Typography><Slider size="small" min={0} max={1} step={0.05} value={likelihood} onChange={(_event, value) => setLikelihood(value as number)} /></Box>}
              {slug === 'chance_gate' && <TextField size="small" type="number" label="Chance % override" placeholder="Table default" value={chancePercent} onChange={(event) => setChancePercent(event.target.value)} />}
              {(slug === 'deck' || slug === 'countdown_deck') && <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="caption">{drawnEntryIds.length} cards drawn</Typography><Button size="small" onClick={() => setDrawnEntryIds([])}>Reshuffle</Button></Stack>}
              {slug === 'branching' && <TextField size="small" label="Branch state (JSON)" value={branchState} onChange={(event) => setBranchState(event.target.value)} multiline minRows={2} helperText='Example: {"alarm": true}' />}
              <Button size="large" variant="contained" startIcon={<CasinoIcon />} onClick={() => void handleRoll()} disabled={rolling}>{rolling ? 'Rolling…' : 'Roll now'}</Button>
              {rolling && <LinearProgress />}
              {result && <><Divider /><RollResultView result={result} onOpenRef={(kind, id) => { if (kind === 'encounter_ref') onOpenEncounter?.(id); }} /></>}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3 }}><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

const TAG_COLORS = ['primary', 'secondary', 'success', 'warning', 'info', 'error'] as const;

function tagIcon(tag: Tag) {
  const value = tag.value.toLowerCase();
  if (value.includes('forest') || value.includes('jungle')) return <ForestOutlinedIcon fontSize="small" />;
  if (value.includes('arctic') || value.includes('snow') || value.includes('ice')) return <AcUnitIcon fontSize="small" />;
  if (tag.namespace === 'env') return <PublicIcon fontSize="small" />;
  if (tag.namespace === 'creature-type') return <PetsOutlinedIcon fontSize="small" />;
  if (tag.namespace === 'pillar' || tag.namespace === 'topic') return <ShieldOutlinedIcon fontSize="small" />;
  return <LocalOfferOutlinedIcon fontSize="small" />;
}

export function RandomTablesBrowseView({ campaignId, openTableId, onBack, onGoToEncounters, onOpenEncounter, onOpenNpcBuilder, onOpenPlaceBuilder, onOpenEncounterBuilder }: RandomTablesBrowseViewProps) {
  const resultKey = `browse:${campaignId}`;
  const results = useRandomTableStore((s) => s.resultSets[resultKey]?.results ?? EMPTY_RANDOM_TABLE_RESULTS);
  const searching = useRandomTableStore((s) => s.resultSets[resultKey]?.searching ?? false);
  const details = useRandomTableStore((s) => s.detailById);
  const searchTables = useRandomTableStore((s) => s.search);
  const cloneTable = useRandomTableStore((s) => s.cloneTable);
  const deleteTable = useRandomTableStore((s) => s.deleteTable);
  const fetchDetail = useRandomTableStore((s) => s.fetchDetail);
  const flatCategories = useCategoryStore((s) => s.flat);
  const fetchTree = useCategoryStore((s) => s.fetchTree);
  const tags = useTagStore((s) => s.tags);
  const fetchTags = useTagStore((s) => s.fetchTags);
  const formats = useTableFormatStore((s) => s.formats);
  const fetchFormats = useTableFormatStore((s) => s.fetchFormats);

  const [searchText, setSearchText] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [formatIds, setFormatIds] = useState<string[]>([]);
  const [showAdvancedFormats, setShowAdvancedFormats] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerHeaderExpanded, setDrawerHeaderExpanded] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RandomTableDetail | undefined>(undefined);
  const [createCategoryId, setCreateCategoryId] = useState<string | null>(null);
  const [rollTarget, setRollTarget] = useState<RandomTableDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RandomTable | null>(null);
  const favoritesStorageKey = `worldwatcher:favorite-random-tables:${campaignId}`;
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(favoritesStorageKey) ?? '[]') as string[]); }
    catch { return new Set(); }
  });

  const usageByCampaignId = useTableUsageStore((s) => s.byCampaignId);
  const recordRoll = useTableUsageStore((s) => s.recordRoll);
  const recordOpen = useTableUsageStore((s) => s.recordOpen);
  const usage = getTableUsage(usageByCampaignId, campaignId);

  useEffect(() => { fetchTree(); fetchTags(); fetchFormats(); }, [fetchTree, fetchTags, fetchFormats]);
  // The category graph already needs the whole library to draw its per-branch counts, so the
  // library is fetched once, unfiltered, and text/tag/format narrowing all happens on the
  // client (see tableSearch.ts). That is what lets every facet carry a live count - a
  // server-side `q` would already have discarded the tables the counts are about - and it
  // drops the per-keystroke round trip the search used to make.
  useEffect(() => {
    void searchTables({ campaignId, scope: 'own_or_global', limit: 20000 }, resultKey);
  }, [searchTables, campaignId, resultKey]);

  const searchIndex = useMemo(() => buildTableSearchIndex(results, flatCategories, tags), [results, flatCategories, tags]);
  const queryScoped = useMemo(() => filterTablesByQuery(results, searchText, searchIndex), [results, searchText, searchIndex]);
  const tagScoped = useMemo(() => (tagIds.length === 0 ? queryScoped : queryScoped.filter((table) => table.tagIds.some((id) => tagIds.includes(id)))), [queryScoped, tagIds]);
  const filteredResults = useMemo(() => (formatIds.length === 0 ? tagScoped : tagScoped.filter((table) => formatIds.includes(table.formatId))), [tagScoped, formatIds]);
  // Facet counts leave out their own facet, so a count reads as "pick this and you get N"
  // rather than "N survive what you already picked".
  const tagCounts = useMemo(() => computeTagCounts(formatIds.length === 0 ? queryScoped : queryScoped.filter((table) => formatIds.includes(table.formatId))), [queryScoped, formatIds]);
  const formatCounts = useMemo(() => computeFormatCounts(tagScoped), [tagScoped]);
  const selectedIds = useMemo(() => subtreeCategoryIds(flatCategories, selectedCategoryId), [flatCategories, selectedCategoryId]);
  const categoryScopedTables = useMemo(() => selectedIds ? filteredResults.filter((table) => table.categoryId && selectedIds.has(table.categoryId)) : filteredResults, [filteredResults, selectedIds]);
  // Rolls, favorites and campaign ownership decide the order, not the alphabet - the same
  // ranking the Play page's Random Tables window uses, so a DM sees one consistent notion of
  // "most useful first" whether they are browsing here or mid-session (see tableSearch.ts).
  const usefulness: TableUsefulnessSignals = useMemo(
    () => ({ usage, pinnedIds: favoriteIds, campaignId }),
    [usage, favoriteIds, campaignId],
  );
  const selectedTables = useMemo(
    () => rankTablesByUsefulness(categoryScopedTables, searchText, usefulness),
    [categoryScopedTables, searchText, usefulness],
  );
  const counts = useMemo(() => computeCategoryCounts(filteredResults, flatCategories), [filteredResults, flatCategories]);
  const drawerTagIds = useMemo(() => Array.from(new Set(selectedTables.flatMap((table) => table.tagIds))), [selectedTables]);
  const drawerTagGroups = useMemo(() => {
    const groups = new Map<string, Tag[]>();
    drawerTagIds.forEach((id) => {
      const tag = tags.find((item) => item.id === id);
      if (!tag) return;
      groups.set(tag.namespace, [...(groups.get(tag.namespace) ?? []), tag]);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [drawerTagIds, tags]);
  const selectedCategory = flatCategories.find((category) => category.id === selectedCategoryId);
  const showNpcBuilder = !!onOpenNpcBuilder && (selectedCategory?.slug === 'npcs-creatures' || selectedCategory?.slug === 'npc-generation');
  const selectedPlaceType = ({ countries: 'country', settlements: 'settlement', buildings: 'building', dungeons: 'dungeon' } as const)[selectedCategory?.slug as 'countries' | 'settlements' | 'buildings' | 'dungeons'];
  const showPlaceBuilder = !!onOpenPlaceBuilder && (selectedCategory?.slug === 'locations-settlements' || !!selectedPlaceType);
  const selectedEncounterType = ({ 'encounters-combat': 'combat', 'encounters-social': 'social', 'encounters-exploration': 'exploration' } as const)[selectedCategory?.slug as 'encounters-combat' | 'encounters-social' | 'encounters-exploration'];
  const showEncounterBuilder = !!onOpenEncounterBuilder && (selectedCategory?.slug === 'encounters' || !!selectedEncounterType);
  const coreFormats = formats.filter((format) => format.tier === 'core');
  const advancedFormats = formats.filter((format) => format.tier === 'advanced');
  const hasActiveFilters = tagIds.length > 0 || formatIds.length > 0;
  const refresh = () => void searchTables({ campaignId, scope: 'own_or_global', limit: 20000 }, resultKey);

  const openCreate = (categoryId: string | null) => { setCreateCategoryId(categoryId); setEditingTable(undefined); setEditorOpen(true); };
  const openEdit = async (table: RandomTable) => { const detail = await fetchDetail(table.id); if (detail) { setEditingTable(detail); setEditorOpen(true); } };
  const openRoll = async (table: RandomTable) => { recordOpen(campaignId, table.id); const detail = await fetchDetail(table.id); if (detail) setRollTarget(detail); };

  // Deep link (?table=<id>) - the Play page's Items window links straight at one table, so it
  // opens its roll view instead of dropping the DM on the category graph. Fires once per id.
  const deepLinkedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openTableId || deepLinkedRef.current === openTableId) return;
    deepLinkedRef.current = openTableId;
    void fetchDetail(openTableId).then((detail) => { if (detail) setRollTarget(detail); });
  }, [openTableId, fetchDetail]);
  const toggleTable = async (table: RandomTable) => {
    const opening = !expandedTables.has(table.id);
    setExpandedTables((current) => { const next = new Set(current); if (opening) next.add(table.id); else next.delete(table.id); return next; });
    if (opening) { recordOpen(campaignId, table.id); await fetchDetail(table.id); }
  };
  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(favoritesStorageKey, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const filterOverlay = (
    <Paper elevation={4} sx={{ p: 1, borderRadius: 3, bgcolor: 'background.paper', maxWidth: 1040 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'center' } }}>
        {onBack && <Tooltip title="Back to encounters"><IconButton size="small" onClick={onBack}><ArrowBackIcon /></IconButton></Tooltip>}
        <Box sx={{ flex: 1.4, minWidth: 260 }}>
          <RandomTableSearchField
            value={searchText}
            onChange={setSearchText}
            tables={filteredResults}
            index={searchIndex}
            flatCategories={flatCategories}
            tags={tags}
            onPickTable={(table) => void openRoll(table)}
            onPickCategory={(id) => { setSelectedCategoryId(id); setDrawerOpen(true); setDrawerHeaderExpanded(false); }}
            onPickTag={(id) => setTagIds((current) => (current.includes(id) ? current : [...current, id]))}
            usefulness={usefulness}
          />
        </Box>
        <Box sx={{ flex: 1.2, minWidth: 260 }}><TagPicker selectedTagIds={tagIds} onChange={setTagIds} label="Tags" counts={tagCounts} /></Box>
        <Button
          size="small"
          variant={showAdvancedFormats ? 'contained' : 'outlined'}
          onClick={() => setShowAdvancedFormats((value) => !value)}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {showAdvancedFormats ? 'Hide advanced' : 'Show advanced'}
        </Button>
        {hasActiveFilters && <Button size="small" color="inherit" onClick={() => { setTagIds([]); setFormatIds([]); }}>Clear</Button>}
      </Stack>
      <Collapse in={showAdvancedFormats}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ pt: 1, px: 0.5, alignItems: { md: 'flex-start' } }}>
          <FilterChipGroup label="Core formats" options={coreFormats.map((format) => ({ value: format.id, label: `${format.name} (${formatCounts.get(format.id) ?? 0})` }))} selected={formatIds} onToggle={(id) => setFormatIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])} />
          <FilterChipGroup label="Advanced formats" options={advancedFormats.map((format) => ({ value: format.id, label: `${format.name} (${formatCounts.get(format.id) ?? 0})` }))} selected={formatIds} onToggle={(id) => setFormatIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])} />
        </Stack>
      </Collapse>
    </Paper>
  );

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      {searching && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 12, borderRadius: 2 }} />}
      <CategoryGraphBrowser
        selectedId={selectedCategoryId}
        counts={counts}
        itemLabel="table"
        overlay={filterOverlay}
        onSelect={(id) => { setSelectedCategoryId(id); setDrawerOpen(true); setDrawerHeaderExpanded(false); }}
        onCreateAt={openCreate}
        secondaryAction={onGoToEncounters ? <Button variant="outlined" startIcon={<ListAltIcon />} onClick={onGoToEncounters} sx={{ bgcolor: 'background.paper', boxShadow: 2 }}>Go to encounters</Button> : undefined}
      />

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} slotProps={{ paper: { sx: { width: { xs: '100%', md: '68vw' }, bgcolor: 'background.default' } } }}>
        <Box sx={{ p: { xs: 2, md: 3 }, position: 'sticky', top: 0, zIndex: 3, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Box sx={{ width: 56, height: 56, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'primary.contrastText', flexShrink: 0, '& .MuiSvgIcon-root': { fontSize: 34 } }}>{selectedCategory ? categoryIconFor(selectedCategory.name, selectedCategory.icon) : <HubOutlinedIcon />}</Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 850 }}>{selectedCategory?.name ?? 'All categories'}</Typography>
              <Typography variant="body2" color="text.secondary">{selectedCategory ? categoryPath(flatCategories, selectedCategory.id) : 'The complete random table library'}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}><Chip size="small" label={`${selectedTables.length} tables`} /><Chip size="small" variant="outlined" label={`${drawerTagIds.length} tags`} /></Stack>
            </Box>
            <Tooltip title="Close"><IconButton onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton></Tooltip>
            <Tooltip title={drawerHeaderExpanded ? 'Collapse category details' : 'Expand category details'}><IconButton onClick={() => setDrawerHeaderExpanded((value) => !value)}>{drawerHeaderExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}</IconButton></Tooltip>
          </Stack>
          <Collapse in={drawerHeaderExpanded}>
          {drawerTagGroups.length > 0 && (
            <Stack spacing={0.75} sx={{ mt: 2, maxHeight: 190, overflow: 'auto', pr: 0.5 }}>
              {drawerTagGroups.map(([namespace, group], namespaceIndex) => (
                <Stack key={namespace} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                  <Typography variant="caption" sx={{ width: 100, pt: 0.5, flexShrink: 0, fontWeight: 850, textTransform: 'uppercase', color: 'text.secondary' }}>{namespace}</Typography>
                  <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {group.map((tag) => <Chip key={tag.id} size="small" color={TAG_COLORS[namespaceIndex % TAG_COLORS.length]} variant="outlined" icon={tagIcon(tag)} label={tag.label || tag.value} />)}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}><Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate(selectedCategoryId)}>Create table here</Button></Stack>
          </Collapse>
        </Box>

        <Stack spacing={1.5} sx={{ p: { xs: 2, md: 3 } }}>
          {showNpcBuilder && (
            <Paper
              variant="outlined"
              onClick={onOpenNpcBuilder}
              sx={{ p: 2, borderRadius: 3, cursor: 'pointer', borderColor: 'primary.main', background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}20, ${theme.palette.background.paper} 68%)`, '&:hover': { boxShadow: 4, transform: 'translateY(-1px)' }, transition: '150ms' }}
            >
              <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
                <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', flexShrink: 0 }}><AutoAwesomeIcon /></Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}><Typography variant="subtitle1" sx={{ fontWeight: 850 }}>NPC Builder</Typography><Chip size="small" color="primary" label="Multi-table" /><Chip size="small" variant="outlined" label="Recommended" /></Stack>
                  <Typography variant="body2" color="text.secondary">Choose Name, Appearance, Occupation, Motivation, Secret, Alignment, Personality and more, then roll each table as one structured character.</Typography>
                </Box>
                <Button variant="contained" startIcon={<CasinoIcon />} onClick={(event) => { event.stopPropagation(); onOpenNpcBuilder(); }}>Build NPC</Button>
              </Stack>
            </Paper>
          )}
          {showPlaceBuilder && (
            <Paper
              variant="outlined"
              onClick={() => onOpenPlaceBuilder(selectedPlaceType)}
              sx={{ p: 2, borderRadius: 3, cursor: 'pointer', borderColor: 'primary.main', background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}20, ${theme.palette.background.paper} 68%)`, '&:hover': { boxShadow: 4, transform: 'translateY(-1px)' }, transition: '150ms' }}
            >
              <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
                <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', flexShrink: 0 }}><AutoAwesomeIcon /></Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}><Typography variant="subtitle1" sx={{ fontWeight: 850 }}>Place Builder</Typography><Chip size="small" color="primary" label="Multi-table" /><Chip size="small" variant="outlined" label="Recommended" />{selectedPlaceType && <Chip size="small" variant="outlined" label={`${selectedPlaceType.charAt(0).toUpperCase()}${selectedPlaceType.slice(1)} selected`} />}</Stack>
                  <Typography variant="body2" color="text.secondary">Choose Country, Settlement, Building, or Dungeon, guide its taxonomy, then roll each table into one structured place article.</Typography>
                </Box>
                <Button variant="contained" startIcon={<CasinoIcon />} onClick={(event) => { event.stopPropagation(); onOpenPlaceBuilder(selectedPlaceType); }}>Build place</Button>
              </Stack>
            </Paper>
          )}
          {showEncounterBuilder && (
            <Paper
              variant="outlined"
              onClick={() => onOpenEncounterBuilder(selectedEncounterType)}
              sx={{ p: 2, borderRadius: 3, cursor: 'pointer', borderColor: 'primary.main', background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}20, ${theme.palette.background.paper} 68%)`, '&:hover': { boxShadow: 4, transform: 'translateY(-1px)' }, transition: '150ms' }}
            >
              <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
                <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', flexShrink: 0 }}><AutoAwesomeIcon /></Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}><Typography variant="subtitle1" sx={{ fontWeight: 850 }}>Encounter Builder</Typography><Chip size="small" color="primary" label="Multi-table" /><Chip size="small" variant="outlined" label="Recommended" />{selectedEncounterType && <Chip size="small" variant="outlined" label={`${selectedEncounterType.charAt(0).toUpperCase()}${selectedEncounterType.slice(1)} selected`} />}</Stack>
                  <Typography variant="body2" color="text.secondary">Choose Social / Roleplay, Combat, or Exploration, set the place, theme, scene options, and difficulty, then roll a linked encounter.</Typography>
                </Box>
                <Button variant="contained" startIcon={<CasinoIcon />} onClick={(event) => { event.stopPropagation(); onOpenEncounterBuilder(selectedEncounterType); }}>Build encounter</Button>
              </Stack>
            </Paper>
          )}
          {selectedTables.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed' }}><SearchIcon sx={{ fontSize: 46, color: 'text.disabled', mb: 1 }} /><Typography variant="h6">No tables in this branch</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Create one here or change the search and filters.</Typography><Button variant="outlined" startIcon={<AddIcon />} onClick={() => openCreate(selectedCategoryId)}>Create table</Button></Paper>
          ) : selectedTables.map((table) => {
            const format = formats.find((item) => item.id === table.formatId);
            const expanded = expandedTables.has(table.id);
            const detail = details[table.id];
            return (
              <Paper key={table.id} variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper' }}>
                <Stack direction="row" spacing={1.25} sx={{ p: 1.5, alignItems: 'center' }}>
                  <IconButton onClick={() => void toggleTable(table)}>{expanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}</IconButton>
                  <Box onClick={() => void toggleTable(table)} sx={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{table.name}</Typography>{format && <Chip size="small" color="primary" variant="outlined" label={format.name} />}{table.isSystem && <Chip size="small" label="Curated" />}</Stack>
                    <Typography variant="body2" color="text.secondary" noWrap>{table.description || categoryPath(flatCategories, table.categoryId) || 'No description'}</Typography>
                  </Box>
                  <Tooltip title="Roll"><IconButton color="primary" onClick={() => void openRoll(table)}><CasinoIcon /></IconButton></Tooltip>
                  <Tooltip title="Copy table"><IconButton onClick={() => void cloneTable(table.id, campaignId).then(refresh)}><ContentCopyIcon /></IconButton></Tooltip>
                  <Tooltip title={favoriteIds.has(table.id) ? 'Remove from favorites' : 'Add to favorites'}><IconButton color={favoriteIds.has(table.id) ? 'warning' : 'default'} onClick={() => toggleFavorite(table.id)}>{favoriteIds.has(table.id) ? <StarIcon /> : <StarBorderIcon />}</IconButton></Tooltip>
                  <Tooltip title="Edit"><IconButton onClick={() => void openEdit(table)}><EditIcon /></IconButton></Tooltip>
                  <Tooltip title="Delete"><IconButton color="error" onClick={() => setDeleteTarget(table)}><DeleteOutlineIcon /></IconButton></Tooltip>
                </Stack>
                {expanded && <><Divider />{detail ? <Box sx={{ p: 2 }}><RandomTableFullView table={detail} compact onOpenEncounter={onOpenEncounter} /></Box> : <LinearProgress />}</>}
              </Paper>
            );
          })}
        </Stack>
      </Drawer>

      <RandomTableEditor open={editorOpen} onClose={() => setEditorOpen(false)} campaignId={campaignId} initialTable={editingTable} initialCategoryId={createCategoryId} onSaved={() => refresh()} />
      <ConfirmDeleteDialog open={!!deleteTarget} itemName={deleteTarget?.name ?? ''} itemType="random table" onCancel={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) void deleteTable(deleteTarget.id); setDeleteTarget(null); }} />
      {rollTarget && (
        <TableRollDialog
          table={rollTarget}
          onClose={() => setRollTarget(null)}
          onOpenEncounter={onOpenEncounter}
          onRolled={(tableId) => recordRoll(campaignId, tableId)}
        />
      )}
    </Box>
  );
}
