import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CasinoIcon from '@mui/icons-material/Casino';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import { useGeneratorStore } from '../../../store/useGeneratorStore';
import { EMPTY_RANDOM_TABLE_RESULTS, useRandomTableStore } from '../../../store/useRandomTableStore';
import { useCreatureStore } from '../../../store/useCreatureStore';
import { useTagStore } from '../../../store/useTagStore';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import type { GeneratorComponent } from '../../../types/generator';
import type { RandomTable } from '../../../types/randomTable';
import type { Creature } from '../../../types/creature';
import type { NpcRollPrefill } from '../NpcFormDialog';
import { RandomTableFullView } from '../randomTables/RandomTableFullView';

const GENERATOR_SLUGS = ['npc-builder', 'npc-quick-roll', 'quick-npc'];
const STEPS = ['Choose tables', 'Roll attributes', 'Review & add'];
const NPC_FACETS = [
  { namespace: 'npc-name-style', label: 'Name style', description: 'The feeling and culture behind generated names.' },
  { namespace: 'npc-occupation', label: 'Occupation', description: 'The kind of work or social role they fill.' },
  { namespace: 'npc-background', label: 'Background', description: 'The history that shapes their generated details.' },
  { namespace: 'npc-theme', label: 'Theme', description: 'A motif shared across the character.' },
] as const;

interface NpcBuilderPreset {
  id: string;
  name: string;
  tableIds: string[];
  constraintTagIds: string[];
}

function presetsStorageKey(campaignId: string) {
  return `worldwatcher:npc-builder-presets:${campaignId}`;
}

function readPresets(campaignId: string): NpcBuilderPreset[] {
  try { return JSON.parse(localStorage.getItem(presetsStorageKey(campaignId)) ?? '[]') as NpcBuilderPreset[]; }
  catch { return []; }
}

function writePresets(campaignId: string, presets: NpcBuilderPreset[]) {
  try { localStorage.setItem(presetsStorageKey(campaignId), JSON.stringify(presets)); }
  catch { /* Private browsing can make localStorage unavailable; the in-memory copy still works. */ }
}

const SLOT_META: Record<string, { label: string; description: string; prefillKey: keyof NpcRollPrefill }> = {
  name: { label: 'Name', description: 'A ready-to-use character name.', prefillKey: 'name' },
  appearance: { label: 'Appearance', description: 'A memorable physical detail or first impression.', prefillKey: 'appearance' },
  occupation: { label: 'Occupation', description: 'Their trade, station, or everyday role.', prefillKey: 'occupation' },
  motivation: { label: 'Motivation', description: 'What they want badly enough to act on.', prefillKey: 'motivation' },
  secret: { label: 'Secret', description: 'Hidden leverage, danger, or a story hook.', prefillKey: 'secret' },
  alignment: { label: 'Alignment', description: 'Their broad moral outlook.', prefillKey: 'alignment' },
  personality: { label: 'Personality trait', description: 'A strong behavior players can notice.', prefillKey: 'personality' },
  trait: { label: 'Personality trait', description: 'A strong behavior players can notice.', prefillKey: 'personality' },
  pitfall: { label: 'Flaw or pitfall', description: 'A weakness that complicates their choices.', prefillKey: 'pitfall' },
  relationship: { label: 'Relationship', description: 'A useful connection to another character.', prefillKey: 'relationship' },
  history: { label: 'History hook', description: 'A past event that can pull them into play.', prefillKey: 'history' },
  voice: { label: 'Voice & mannerism', description: 'A quick roleplaying cue for the table.', prefillKey: 'description' },
  ancestry: { label: 'Ancestry', description: 'Their lineage, heritage, or people.', prefillKey: 'description' },
  age: { label: 'Age', description: 'Their age or stage of life.', prefillKey: 'description' },
  attitude: { label: 'Attitude', description: 'How they initially respond to the party.', prefillKey: 'personality' },
  ideal: { label: 'Ideal', description: 'The principle that guides their choices.', prefillKey: 'motivation' },
  bond: { label: 'Bond', description: 'A person, place, or cause they cannot abandon.', prefillKey: 'relationship' },
};

interface QuickNpcRollDialogProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  onAddToNew: (prefill: NpcRollPrefill) => void;
  onAddToExisting: (creature: Creature, prefill: NpcRollPrefill) => void;
}

function titleCase(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slotMeta(slot: string) {
  return SLOT_META[slot] ?? {
    label: titleCase(slot),
    description: 'An additional detail appended to the NPC notes.',
    prefillKey: 'description' as const,
  };
}

function componentMeta(component: GeneratorComponent, table?: RandomTable) {
  if (!component.outputSlot.startsWith('additional:')) return slotMeta(component.outputSlot);
  return {
    label: table?.name ?? 'Additional table',
    description: table?.description ?? 'An extra detail from your NPC table library.',
    prefillKey: 'description' as const,
  };
}

/** NPC-specific composite generator. Components remain ordinary random tables, but the
 * three-phase runner lets the DM opt each one in/out, reroll it independently, and merge
 * the chosen results into a new or existing NPC without overwriting existing material. */
export function QuickNpcRollDialog({ open, onClose, campaignId, onAddToNew, onAddToExisting }: QuickNpcRollDialogProps) {
  const tableResultKey = `npc-builder:${campaignId}`;
  const searchGenerators = useGeneratorStore((s) => s.search);
  const generatorResults = useGeneratorStore((s) => s.results);
  const generatorSearching = useGeneratorStore((s) => s.searching);
  const fetchGeneratorDetail = useGeneratorStore((s) => s.fetchDetail);
  const fetchTableDetail = useRandomTableStore((s) => s.fetchDetail);
  const rollTable = useRandomTableStore((s) => s.roll);
  const searchTables = useRandomTableStore((s) => s.search);
  const tableSearchResults = useRandomTableStore((s) => s.resultSets[tableResultKey]?.results ?? EMPTY_RANDOM_TABLE_RESULTS);
  const tableSearching = useRandomTableStore((s) => s.resultSets[tableResultKey]?.searching ?? false);
  const tableDetails = useRandomTableStore((s) => s.detailById);
  const tags = useTagStore((s) => s.tags);
  const tagsLoading = useTagStore((s) => s.loading);
  const fetchTags = useTagStore((s) => s.fetchTags);

  const [step, setStep] = useState(0);
  const [components, setComponents] = useState<GeneratorComponent[] | null>(null);
  const [additionalComponents, setAdditionalComponents] = useState<GeneratorComponent[]>([]);
  const [tables, setTables] = useState<Record<string, RandomTable>>({});
  const [tableCategoryId, setTableCategoryId] = useState<string | undefined>();
  const [tableSearch, setTableSearch] = useState('');
  const [expandedTableIds, setExpandedTableIds] = useState<Set<string>>(new Set());
  const [previewLoadingIds, setPreviewLoadingIds] = useState<Set<string>>(new Set());
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, string>>({});
  const [resultTagIds, setResultTagIds] = useState<Record<string, string[]>>({});
  const [rollingSlots, setRollingSlots] = useState<Set<string>>(new Set());
  const [rollErrorSlots, setRollErrorSlots] = useState<Set<string>>(new Set());
  const [constraintTagIds, setConstraintTagIds] = useState<Set<string>>(new Set());
  const [presets, setPresets] = useState<NpcBuilderPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [target, setTarget] = useState<'new' | 'existing'>('new');
  const [selectedNpc, setSelectedNpc] = useState<Creature | null>(null);
  const [npcSearch, setNpcSearch] = useState('');
  const debouncedNpcSearch = useDebouncedValue(npcSearch, 300);
  const debouncedTableSearch = useDebouncedValue(tableSearch, 250);

  const creaturePickerBrowse = useCreatureStore((s) => s.creaturePickerBrowse);
  const fetchCreaturePickerBrowse = useCreatureStore((s) => s.fetchCreaturePickerBrowse);
  const npcOptions = useMemo(() => creaturePickerBrowse?.items ?? [], [creaturePickerBrowse]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setComponents(null);
    setAdditionalComponents([]);
    setTables({});
    setTableCategoryId(undefined);
    setTableSearch('');
    setExpandedTableIds(new Set());
    setPreviewLoadingIds(new Set());
    setSelectedSlots(new Set());
    setResults({});
    setResultTagIds({});
    setRollingSlots(new Set());
    setRollErrorSlots(new Set());
    setConstraintTagIds(new Set());
    setPresets(readPresets(campaignId));
    setPresetName('');
    setLoadFailed(false);
    setTarget('new');
    setSelectedNpc(null);
    setNpcSearch('');
    void searchGenerators({ q: 'NPC', campaignId, scope: 'own_or_global' });
    void fetchTags();
  }, [open, campaignId, searchGenerators, fetchTags]);

  useEffect(() => {
    if (!open || components) return;
    const match = GENERATOR_SLUGS.map((slug) => generatorResults.find((generator) => generator.slug === slug)).find(Boolean);
    if (!match) {
      if (!generatorSearching) setLoadFailed(true);
      return;
    }
    setLoadFailed(false);
    void fetchGeneratorDetail(match.id).then(async (detail) => {
      if (!detail) { setLoadFailed(true); return; }
      const ordered = [...detail.components].sort((a, b) => a.sortOrder - b.sortOrder);
      setComponents(ordered);
      setTableCategoryId(detail.categoryId ?? undefined);
      setSelectedSlots(new Set(ordered.map((component) => component.outputSlot)));
      const loaded = await Promise.all(ordered.map((component) => fetchTableDetail(component.tableId)));
      setTables(Object.fromEntries(loaded.filter((table) => table !== null).map((table) => [table.id, table])));
    });
  }, [open, components, generatorResults, generatorSearching, fetchGeneratorDetail, fetchTableDetail]);

  useEffect(() => {
    if (!open || !components) return;
    void searchTables({
      q: debouncedTableSearch.trim() || undefined,
      categoryId: tableCategoryId,
      campaignId,
      scope: 'own_or_global',
      sort: 'name',
      limit: 50,
    }, tableResultKey);
  }, [open, components, debouncedTableSearch, tableCategoryId, campaignId, searchTables, tableResultKey]);

  useEffect(() => {
    if (!open || target !== 'existing') return;
    void fetchCreaturePickerBrowse({ campaignId, category: 'npc', scope: 'own_or_global', page: 1, pageSize: 20, search: debouncedNpcSearch });
  }, [open, target, campaignId, debouncedNpcSearch, fetchCreaturePickerBrowse]);

  const allComponents = useMemo(() => [...(components ?? []), ...additionalComponents], [components, additionalComponents]);
  const selectedComponents = useMemo(
    () => allComponents.filter((component) => selectedSlots.has(component.outputSlot)),
    [allComponents, selectedSlots],
  );
  const availableTables = useMemo(() => {
    const usedTableIds = new Set(allComponents.map((component) => component.tableId));
    return tableSearchResults.filter((table) => !usedTableIds.has(table.id));
  }, [allComponents, tableSearchResults]);
  const rolling = rollingSlots.size > 0;
  const rolledCount = selectedComponents.filter((component) => !!results[component.outputSlot]).length;
  const selectedConstraintTags = useMemo(() => tags.filter((tag) => constraintTagIds.has(tag.id)), [tags, constraintTagIds]);

  const toggleSlot = (slot: string) => {
    setSelectedSlots((current) => {
      const next = new Set(current);
      if (next.has(slot)) next.delete(slot); else next.add(slot);
      return next;
    });
  };

  const addTable = (table: RandomTable | null) => {
    if (!table || allComponents.some((component) => component.tableId === table.id)) return;
    const outputSlot = `additional:${table.id}`;
    setAdditionalComponents((current) => [...current, {
      id: outputSlot,
      generatorId: '',
      tableId: table.id,
      outputSlot,
      filterParamKey: null,
      rollCount: 1,
      optional: true,
      sortOrder: (components?.length ?? 0) + current.length,
    }]);
    setTables((current) => ({ ...current, [table.id]: table }));
    setSelectedSlots((current) => new Set(current).add(outputSlot));
    setTableSearch('');
  };

  const removeAdditionalTable = (component: GeneratorComponent) => {
    setAdditionalComponents((current) => current.filter((item) => item.id !== component.id));
    setSelectedSlots((current) => {
      const next = new Set(current);
      next.delete(component.outputSlot);
      return next;
    });
    setResults((current) => {
      const next = { ...current };
      delete next[component.outputSlot];
      return next;
    });
    setExpandedTableIds((current) => {
      const next = new Set(current);
      next.delete(component.tableId);
      return next;
    });
  };

  const toggleTablePreview = async (tableId: string) => {
    const opening = !expandedTableIds.has(tableId);
    setExpandedTableIds((current) => {
      const next = new Set(current);
      if (opening) next.add(tableId); else next.delete(tableId);
      return next;
    });
    if (!opening) return;
    if (tableDetails[tableId]) return;
    setPreviewLoadingIds((current) => new Set(current).add(tableId));
    await fetchTableDetail(tableId);
    setPreviewLoadingIds((current) => {
      const next = new Set(current);
      next.delete(tableId);
      return next;
    });
  };

  const rollComponent = async (component: GeneratorComponent) => {
    setRollingSlots((current) => new Set(current).add(component.outputSlot));
    setRollErrorSlots((current) => { const next = new Set(current); next.delete(component.outputSlot); return next; });
    const result = await rollTable(component.tableId, { filter_tag_ids: Array.from(constraintTagIds) });
    setRollingSlots((current) => { const next = new Set(current); next.delete(component.outputSlot); return next; });
    const value = result?.combinedText
      ?? result?.items.map((item) => item.resolvedText ?? item.text).filter(Boolean).join(' · ')
      ?? '';
    if (value) {
      setResults((current) => ({ ...current, [component.outputSlot]: value }));
      setResultTagIds((current) => ({
        ...current,
        [component.outputSlot]: Array.from(new Set(result?.items.flatMap((item) => item.tagIds) ?? [])),
      }));
    }
    else {
      setResults((current) => { const next = { ...current }; delete next[component.outputSlot]; return next; });
      setResultTagIds((current) => { const next = { ...current }; delete next[component.outputSlot]; return next; });
      setRollErrorSlots((current) => new Set(current).add(component.outputSlot));
    }
  };

  const rollSelected = async () => Promise.all(selectedComponents.map(rollComponent));

  const buildPrefill = (): NpcRollPrefill => {
    const prefill: NpcRollPrefill = {};
    selectedComponents.forEach((component) => {
      const value = results[component.outputSlot];
      if (!value) return;
      const meta = componentMeta(component, tables[component.tableId]);
      if (meta.prefillKey === 'description') {
        prefill.description = [prefill.description, `${meta.label}: ${value}`].filter(Boolean).join('\n');
      } else {
        prefill[meta.prefillKey] = [prefill[meta.prefillKey], value].filter(Boolean).join('\n');
      }
    });
    return prefill;
  };

  const handleAdd = () => {
    const prefill = buildPrefill();
    if (target === 'existing') {
      if (selectedNpc) onAddToExisting(selectedNpc, prefill);
    } else onAddToNew(prefill);
  };

  const toggleConstraint = (tagId: string) => {
    setConstraintTagIds((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId); else next.add(tagId);
      return next;
    });
    setResults({});
    setResultTagIds({});
    setRollErrorSlots(new Set());
  };

  const savePreset = () => {
    const name = presetName.trim() || `NPC setup ${presets.length + 1}`;
    const preset: NpcBuilderPreset = {
      id: crypto.randomUUID(),
      name,
      tableIds: selectedComponents.map((component) => component.tableId),
      constraintTagIds: Array.from(constraintTagIds),
    };
    const next = [preset, ...presets];
    setPresets(next);
    writePresets(campaignId, next);
    setPresetName('');
  };

  const deletePreset = (presetId: string) => {
    const next = presets.filter((preset) => preset.id !== presetId);
    setPresets(next);
    writePresets(campaignId, next);
  };

  const loadPreset = async (preset: NpcBuilderPreset) => {
    if (!components) return;
    const baseByTableId = new Map(components.map((component) => [component.tableId, component]));
    const extraIds = preset.tableIds.filter((id) => !baseByTableId.has(id));
    const loadedExtras = await Promise.all(extraIds.map((id) => fetchTableDetail(id)));
    const extras = loadedExtras.filter((table): table is NonNullable<typeof table> => table !== null).map((table, index) => ({
      id: `additional:${table.id}`,
      generatorId: '',
      tableId: table.id,
      outputSlot: `additional:${table.id}`,
      filterParamKey: null,
      rollCount: 1,
      optional: true,
      sortOrder: components.length + index,
    }));
    setAdditionalComponents(extras);
    setTables((current) => ({ ...current, ...Object.fromEntries(loadedExtras.filter((table): table is NonNullable<typeof table> => table !== null).map((table) => [table.id, table])) }));
    setSelectedSlots(new Set([
      ...components.filter((component) => preset.tableIds.includes(component.tableId)).map((component) => component.outputSlot),
      ...extras.map((component) => component.outputSlot),
    ]));
    setConstraintTagIds(new Set(preset.constraintTagIds));
    setResults({});
    setResultTagIds({});
    setRollErrorSlots(new Set());
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { borderRadius: 4, minHeight: 650, maxHeight: '92vh' } } }}>
      <DialogTitle sx={{ px: { xs: 2, md: 3 }, pt: 2.5, pb: 1.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box sx={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 2.5, bgcolor: 'primary.main', color: 'primary.contrastText' }}><AutoAwesomeIcon /></Box>
          <Box><Typography variant="h6" sx={{ fontWeight: 850 }}>Build a random NPC</Typography><Typography variant="body2" color="text.secondary">Compose one character from independent NPC tables.</Typography></Box>
        </Stack>
      </DialogTitle>
      <Box sx={{ px: { xs: 2, md: 5 }, pb: 2 }}>
        <Stepper activeStep={step} alternativeLabel>{STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
      </Box>
      <DialogContent dividers sx={{ p: { xs: 2, md: 3 }, bgcolor: 'action.hover' }}>
        {!components && !loadFailed && <Stack spacing={2} sx={{ alignItems: 'center', py: 8 }}><CircularProgress /><Typography color="text.secondary">Loading NPC tables…</Typography></Stack>}
        {loadFailed && <Alert severity="warning">The NPC Builder generator is not available yet. Run the NPC generator seed, then reopen this dialog.</Alert>}

        {components && step === 0 && (
          <Stack spacing={2.5}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper', background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}14, ${theme.palette.background.paper} 62%)` }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><BookmarkIcon color="primary" fontSize="small" /><Typography variant="subtitle1" sx={{ fontWeight: 850 }}>Saved NPC setups</Typography></Stack>
                  <Typography variant="body2" color="text.secondary">Load your favorite constraints and table selections in one click.</Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ minWidth: { sm: 330 } }}>
                  <TextField size="small" fullWidth value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Setup name" slotProps={{ htmlInput: { 'aria-label': 'Saved setup name' } }} />
                  <Button variant="outlined" startIcon={<BookmarkBorderIcon />} disabled={selectedComponents.length === 0} onClick={savePreset}>Save</Button>
                </Stack>
              </Stack>
              {presets.length > 0 ? (
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.5 }}>
                  {presets.map((preset) => <Chip key={preset.id} color="primary" variant="outlined" icon={<BookmarkBorderIcon />} label={preset.name} onClick={() => void loadPreset(preset)} onDelete={() => deletePreset(preset.id)} deleteIcon={<DeleteOutlineIcon />} />)}
                </Stack>
              ) : <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>No saved setups yet. Choose your tables and constraints, then save one here.</Typography>}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', mb: 1.75 }}>
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><TuneIcon color="primary" fontSize="small" /><Typography variant="subtitle1" sx={{ fontWeight: 850 }}>Guide the random choices</Typography></Stack>
                  <Typography variant="body2" color="text.secondary">Optional. Pick more than one option in a group to widen the pool.</Typography>
                </Box>
                {constraintTagIds.size > 0 && <Button size="small" color="inherit" onClick={() => { setConstraintTagIds(new Set()); setResults({}); setResultTagIds({}); setRollErrorSlots(new Set()); }}>Clear constraints</Button>}
              </Stack>
              {tagsLoading && <LinearProgress sx={{ mb: 1.5 }} />}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}>
                {NPC_FACETS.map((facet) => {
                  const options = tags.filter((tag) => tag.namespace === facet.namespace);
                  return (
                    <Box key={facet.namespace} sx={{ p: 1.25, borderRadius: 2, bgcolor: 'action.hover', minHeight: 92 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{facet.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{facet.description}</Typography>
                      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
                        {options.map((tag) => <Chip key={tag.id} size="small" clickable color={constraintTagIds.has(tag.id) ? 'primary' : 'default'} variant={constraintTagIds.has(tag.id) ? 'filled' : 'outlined'} label={tag.label} onClick={() => toggleConstraint(tag.id)} />)}
                        {!tagsLoading && options.length === 0 && <Typography variant="caption" color="text.disabled">Run the NPC taxonomy seed to enable these options.</Typography>}
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
              {constraintTagIds.size > 0 && <Alert severity="info" icon={false} sx={{ mt: 1.5, py: 0.25 }}>Each roll only uses tagged options related to your choices. Choices within a group are alternatives; choices across groups work together.</Alert>}
            </Paper>

            <Divider />
            <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>What should the dice decide?</Typography><Typography variant="body2" color="text.secondary">Each attribute comes from its own table. Select any combination; you can reroll every result independently in the next phase.</Typography></Box>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Button size="small" onClick={() => setSelectedSlots(new Set(allComponents.map((component) => component.outputSlot)))}>Select all</Button>
              <Button size="small" color="inherit" onClick={() => setSelectedSlots(new Set())}>Clear</Button>
              <Chip size="small" color="primary" label={`${selectedSlots.size} of ${allComponents.length} selected`} />
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
              {allComponents.map((component) => {
                const table = tables[component.tableId];
                const meta = componentMeta(component, table);
                const selected = selectedSlots.has(component.outputSlot);
                const isAdditional = component.outputSlot.startsWith('additional:');
                return (
                  <Paper key={component.id} variant="outlined" sx={{ position: 'relative', alignSelf: 'start', borderRadius: 3, borderColor: selected ? 'primary.main' : 'divider', overflow: 'hidden', bgcolor: 'background.paper', transition: '150ms', '&:hover': { boxShadow: 2 } }}>
                    <Box component="button" type="button" onClick={() => toggleSlot(component.outputSlot)} sx={{ display: 'block', width: '100%', border: 0, p: 1.5, pr: isAdditional ? 5 : 1.5, textAlign: 'left', cursor: 'pointer', bgcolor: selected ? 'primary.main' : 'background.paper', color: selected ? 'primary.contrastText' : 'text.primary', font: 'inherit' }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                      <Checkbox checked={selected} tabIndex={-1} sx={{ p: 0, color: selected ? 'inherit' : undefined, '&.Mui-checked': { color: selected ? 'inherit' : undefined } }} />
                      <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 800 }}>{meta.label}</Typography><Typography variant="body2" sx={{ opacity: 0.82 }}>{meta.description}</Typography><Typography variant="caption" sx={{ display: 'block', mt: 0.75, opacity: 0.7 }}>{table?.name ?? 'Loading table…'}{table?.sourceBook ? ` · ${table.sourceBook}` : ''}</Typography></Box>
                    </Stack>
                    </Box>
                    {isAdditional && <Tooltip title="Remove added table"><IconButton size="small" onClick={() => removeAdditionalTable(component)} sx={{ position: 'absolute', top: 8, right: 8, color: selected ? 'primary.contrastText' : 'text.secondary' }}><CloseIcon fontSize="small" /></IconButton></Tooltip>}
                    <Button fullWidth size="small" color="inherit" startIcon={<VisibilityOutlinedIcon />} endIcon={<ExpandMoreIcon sx={{ transform: expandedTableIds.has(component.tableId) ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />} onClick={() => void toggleTablePreview(component.tableId)} sx={{ borderRadius: 0, justifyContent: 'space-between', px: 2 }}>
                      {expandedTableIds.has(component.tableId) ? 'Hide table' : 'View table'}
                    </Button>
                    <Collapse in={expandedTableIds.has(component.tableId)} unmountOnExit>
                      <Divider />
                      <Box sx={{ p: 1.25, maxHeight: 320, overflow: 'auto' }}>
                        {previewLoadingIds.has(component.tableId) && !tableDetails[component.tableId]
                          ? <LinearProgress />
                          : tableDetails[component.tableId]
                            ? <RandomTableFullView table={tableDetails[component.tableId]} compact />
                            : <Alert severity="warning">This table could not be loaded.</Alert>}
                      </Box>
                    </Collapse>
                  </Paper>
                );
              })}
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Add another NPC table</Typography>
              <Typography variant="body2" color="text.secondary">Search the rest of your NPC table library. Tables already shown above are hidden from these results.</Typography>
            </Box>
            <Autocomplete
              options={availableTables}
              inputValue={tableSearch}
              value={null}
              loading={tableSearching}
              filterOptions={(options) => options}
              getOptionLabel={(table) => table.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onInputChange={(_event, value, reason) => { if (reason !== 'reset') setTableSearch(value); }}
              onChange={(_event, value) => addTable(value)}
              noOptionsText={tableSearching ? 'Searching tables...' : 'No other matching NPC tables'}
              slotProps={{ popper: { sx: { zIndex: (theme) => theme.zIndex.modal + 1 } } }}
              renderInput={(params) => <TextField {...params} label="Search available tables" placeholder="Try names, quirks, bonds..." />}
              renderOption={(props, option) => <li {...props} key={option.id}><Stack direction="row" spacing={1.25} sx={{ width: '100%', alignItems: 'center' }}><AddIcon color="primary" fontSize="small" /><Box sx={{ minWidth: 0, flexGrow: 1 }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{option.name}</Typography><Typography variant="caption" color="text.secondary" noWrap>{option.description || option.sourceBook || 'NPC generation table'}</Typography></Box></Stack></li>}
            />
          </Stack>
        )}

        {components && step === 1 && (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
              <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>Roll the selected tables</Typography><Typography variant="body2" color="text.secondary">Keep what works and reroll only what does not.</Typography></Box>
              <Button variant="contained" startIcon={<CasinoIcon />} disabled={rolling || selectedComponents.length === 0} onClick={() => void rollSelected()}>{rolledCount ? 'Reroll all selected' : 'Roll all selected'}</Button>
            </Stack>
            {rolling && <LinearProgress />}
            {selectedConstraintTags.length > 0 && <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}><TuneIcon fontSize="small" color="primary" /><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 750 }}>Guided by</Typography>{selectedConstraintTags.map((tag) => <Chip key={tag.id} size="small" label={tag.label} />)}</Stack>}
            <Stack spacing={1.25}>
              {selectedComponents.map((component) => {
                const meta = componentMeta(component, tables[component.tableId]);
                const value = results[component.outputSlot];
                const slotRolling = rollingSlots.has(component.outputSlot);
                const noMatch = rollErrorSlots.has(component.outputSlot);
                const resultTags = tags.filter((tag) => (resultTagIds[component.outputSlot] ?? []).includes(tag.id));
                return (
                  <Paper key={component.id} variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper' }}>
                    <Stack direction="row" spacing={1.5} sx={{ p: 1.5, alignItems: 'center' }}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>{meta.label} · {tables[component.tableId]?.name ?? 'Random table'}</Typography><Typography variant="body1" color={value ? 'text.primary' : 'text.disabled'} sx={{ mt: 0.25 }}>{slotRolling ? 'Rolling…' : value || 'Not rolled yet'}</Typography>{resultTags.length > 0 && <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 0.75 }}>{resultTags.map((tag) => <Chip key={tag.id} size="small" variant="outlined" color="secondary" label={`${tag.namespace.replace(/^npc-/, '').replace(/-/g, ' ')}: ${tag.label}`} />)}</Stack>}</Box>
                      {value && <CheckCircleIcon color="success" fontSize="small" />}
                      <Tooltip title={`Roll ${meta.label}`}><span><IconButton color="primary" disabled={rolling} onClick={() => void rollComponent(component)}>{value ? <RefreshIcon /> : <CasinoIcon />}</IconButton></span></Tooltip>
                    </Stack>
                    {noMatch && <Alert severity="warning" sx={{ borderRadius: 0, py: 0.25 }}>No options in this table match the current combination. Widen a constraint and try again.</Alert>}
                    <Button fullWidth size="small" color="inherit" startIcon={<VisibilityOutlinedIcon />} endIcon={<ExpandMoreIcon sx={{ transform: expandedTableIds.has(component.tableId) ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />} onClick={() => void toggleTablePreview(component.tableId)} sx={{ borderRadius: 0, justifyContent: 'space-between', px: 2 }}>
                      {expandedTableIds.has(component.tableId) ? 'Hide table' : 'View table'}
                    </Button>
                    <Collapse in={expandedTableIds.has(component.tableId)} unmountOnExit>
                      <Divider />
                      <Box sx={{ p: 1.25, maxHeight: 360, overflow: 'auto' }}>
                        {previewLoadingIds.has(component.tableId) && !tableDetails[component.tableId]
                          ? <LinearProgress />
                          : tableDetails[component.tableId]
                            ? <RandomTableFullView table={tableDetails[component.tableId]} compact />
                            : <Alert severity="warning">This table could not be loaded.</Alert>}
                      </Box>
                    </Collapse>
                  </Paper>
                );
              })}
            </Stack>
          </Stack>
        )}

        {components && step === 2 && (
          <Stack spacing={2.5}>
            <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>Review the character</Typography><Typography variant="body2" color="text.secondary">Only rolled attributes will be applied. Existing NPC text is preserved and these details are appended where appropriate.</Typography></Box>
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper' }}>
              {selectedComponents.filter((component) => results[component.outputSlot]).map((component, index) => (
                <Box key={component.id}><Stack direction="row" spacing={2} sx={{ px: 2, py: 1.25 }}><Typography variant="body2" color="text.secondary" sx={{ width: 145, flexShrink: 0, fontWeight: 750 }}>{componentMeta(component, tables[component.tableId]).label}</Typography><Box><Typography variant="body2">{results[component.outputSlot]}</Typography><Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 0.5 }}>{tags.filter((tag) => (resultTagIds[component.outputSlot] ?? []).includes(tag.id)).map((tag) => <Chip key={tag.id} size="small" variant="outlined" label={tag.label} />)}</Stack></Box></Stack>{index < rolledCount - 1 && <Divider />}</Box>
              ))}
            </Paper>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Add results to</Typography>
              <ToggleButtonGroup size="small" exclusive value={target} onChange={(_event, value) => value && setTarget(value)}>
                <ToggleButton value="new"><PersonAddIcon fontSize="small" sx={{ mr: 0.75 }} />New NPC</ToggleButton>
                <ToggleButton value="existing">Existing NPC</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            {target === 'existing' && (
              <Autocomplete options={npcOptions} value={selectedNpc} getOptionLabel={(creature) => creature.name} isOptionEqualToValue={(a, b) => a.id === b.id} onChange={(_event, value) => setSelectedNpc(value)} onInputChange={(_event, value) => setNpcSearch(value)} slotProps={{ popper: { sx: { zIndex: (theme) => theme.zIndex.modal + 1 } } }} renderInput={(params) => <TextField {...params} label="Search NPCs…" />} renderOption={(props, option) => <li {...props} key={option.id}><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}><Avatar src={option.tokenImage} sx={{ width: 28, height: 28 }}>{option.name.charAt(0)}</Avatar><Typography variant="body2">{option.name}</Typography></Stack></li>} />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button onClick={step === 0 ? onClose : () => setStep((value) => value - 1)} color="inherit" startIcon={step > 0 ? <NavigateBeforeIcon /> : undefined}>{step === 0 ? 'Cancel' : 'Back'}</Button>
        {step < 2 ? <Button variant="contained" endIcon={<NavigateNextIcon />} disabled={!components || (step === 0 ? selectedSlots.size === 0 : rolledCount === 0 || rolling)} onClick={() => setStep((value) => value + 1)}>{step === 0 ? 'Continue to rolls' : 'Review results'}</Button> : <Button variant="contained" startIcon={<PersonAddIcon />} disabled={rolledCount === 0 || (target === 'existing' && !selectedNpc)} onClick={handleAdd}>{target === 'new' ? 'Continue to new NPC' : 'Add to NPC'}</Button>}
      </DialogActions>
    </Dialog>
  );
}
