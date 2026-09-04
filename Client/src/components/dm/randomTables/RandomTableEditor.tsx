import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Autocomplete from '@mui/material/Autocomplete';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Chip from '@mui/material/Chip';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import { TagPicker } from './TagPicker';
import { RandomTableFullView } from './RandomTableFullView';
import { rangeProbability, weightProbability, formatProbability } from './diceProbability';
import { useRandomTableStore } from '../../../store/useRandomTableStore';
import { useCategoryStore, categoryPath } from '../../../store/useCategoryStore';
import { useTableFormatStore } from '../../../store/useTableFormatStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../../store/useCreatureStore';
import { useMagicItemStore, getMagicItemsForCampaign } from '../../../store/useMagicItemStore';
import { useEncounterStore, getEncountersForCampaign } from '../../../store/useEncounterStore';
import { randomTableToApiPayload, tableColumnToApiPayload, apiRandomTableToTable } from '../../../api/adapters';
import * as randomTablesApi from '../../../api/resources/randomTables';
import { ApiError } from '../../../api/client';
import type { RandomTable, RandomTableDetail, TableColumn, TableEntry, TableEntryKind } from '../../../types/randomTable';
import type { Category } from '../../../types/category';

interface RandomTableEditorProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  initialTable?: RandomTableDetail;
  initialCategoryId?: string | null;
  onSaved: (detail: RandomTableDetail) => void;
}

// Mirrors Server/app/api/routers/random_tables.py RANGE_STRICT_FORMATS - these formats need
// their column's die range fully (and only) covered by min/max entries, no gaps or overlap.
const RANGE_STRICT_SLUGS = new Set(['lookup', 'reference', 'scene_generator', 'generator', 'cascading', 'branching', 'check_table']);
const WEIGHT_SLUGS = new Set(['weighted_pool', 'deck', 'countdown_deck']);

const KIND_OPTIONS: { value: TableEntryKind; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'encounter_ref', label: 'Encounter' },
  { value: 'table_ref', label: 'Table' },
  { value: 'creature_ref', label: 'Creature' },
  { value: 'npc_ref', label: 'NPC' },
  { value: 'item_ref', label: 'Item' },
];

function newEntry(columnId: string): TableEntry {
  return {
    id: crypto.randomUUID(), columnId, min: null, max: null, secondaryMin: null, secondaryMax: null,
    weight: null, kind: 'text', text: '', encounterId: null, targetTableId: null, creatureId: null,
    npcId: null, itemId: null, bundle: null, notes: null, sortOrder: 0, tagIds: [], refHydrated: null,
  };
}

function newColumn(): TableColumn {
  const id = crypto.randomUUID();
  return { id, tableId: '', name: 'Column', dieCount: 1, dieSides: 20, dieModifier: 0, sortOrder: 0, entries: [newEntry(id)] };
}

function emptyState() {
  return {
    name: '', description: '', categoryId: null as string | null, tagIds: [] as string[],
    formatId: '', combineTemplate: '', sourceBook: '', triggerSituation: '', formatConfigText: '',
    imageUrl: '',
    columns: [] as TableColumn[],
  };
}

function stateFromDetail(detail: RandomTableDetail) {
  return {
    name: detail.name, description: detail.description ?? '', categoryId: detail.categoryId, tagIds: detail.tagIds,
    formatId: detail.formatId, combineTemplate: detail.combineTemplate ?? '', sourceBook: detail.sourceBook ?? '',
    triggerSituation: detail.triggerSituation ?? '', formatConfigText: detail.formatConfig ? JSON.stringify(detail.formatConfig, null, 2) : '',
    imageUrl: detail.imageUrl ?? '',
    columns: detail.columns.map((c) => ({ ...c, entries: c.entries.map((e) => ({ ...e, tagIds: [...e.tagIds] })) })),
  };
}

function starterColumns(formatSlug: string): TableColumn[] {
  const names = formatSlug === 'scene_generator' || formatSlug === 'generator' ? ['Encounter', 'Detail', 'Twist'] : ['Result'];
  return names.map((name, columnIndex) => {
    const id = crypto.randomUUID();
    const rangeBased = RANGE_STRICT_SLUGS.has(formatSlug);
    const weighted = WEIGHT_SLUGS.has(formatSlug);
    return {
      id,
      tableId: '',
      name,
      dieCount: 1,
      dieSides: 6,
      dieModifier: 0,
      sortOrder: columnIndex,
      entries: [1, 2, 3, 4, 5, 6].map((value) => ({
        ...newEntry(id),
        kind: formatSlug === 'generator' ? 'encounter_ref' : 'text',
        min: rangeBased ? value : null,
        max: rangeBased ? value : null,
        weight: weighted ? 1 : null,
        sortOrder: value - 1,
      })),
    };
  });
}

function FormatMiniPreview({ slug }: { slug: string }) {
  const labels = slug === 'scene_generator' || slug === 'generator'
    ? ['Encounter', 'Detail', 'Twist']
    : slug === 'grid'
      ? ['X × Y', 'Result']
      : slug === 'weighted_pool' || slug === 'deck' || slug === 'countdown_deck'
        ? ['Weight', 'Result']
        : ['Roll', 'Result'];
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'action.hover', minHeight: 260 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>Live format preview</Typography>
        <Chip size="small" color="primary" label={slug || 'Pick a format'} />
      </Stack>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}>
        <Stack direction="row" sx={{ bgcolor: 'action.hover' }}>
          {labels.map((label) => <Typography key={label} variant="caption" sx={{ flex: 1, p: 0.75, fontWeight: 800 }}>{label}</Typography>)}
        </Stack>
        {[0, 1, 2, 3, 4].map((row) => (
          <Stack key={row} direction="row" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            {labels.map((label, column) => <Box key={label} sx={{ flex: 1, p: 1.25 }}><Box sx={{ height: 10, borderRadius: 2, bgcolor: column === 0 ? 'primary.main' : 'text.disabled', opacity: column === 0 ? 0.55 : 0.25, width: column === 0 ? `${35 + row * 8}%` : `${76 - row * 6}%` }} /></Box>)}
          </Stack>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {slug === 'scene_generator' ? 'Each column rolls independently, then the template combines them.' : slug === 'weighted_pool' ? 'Higher weights are more likely to be selected.' : slug === 'grid' ? 'Two dice locate a coordinate in the grid.' : 'A die result maps cleanly to a visible table row.'}
      </Typography>
    </Paper>
  );
}

function coverageGaps(column: TableColumn): { lo: number; hi: number; missing: number[]; overlap: boolean } {
  const lo = column.dieCount * 1 + column.dieModifier;
  const hi = column.dieCount * column.dieSides + column.dieModifier;
  const covered = new Set<number>();
  let overlap = false;
  for (const e of column.entries) {
    if (e.min === null || e.max === null) continue;
    for (let v = e.min; v <= e.max; v++) {
      if (covered.has(v)) overlap = true;
      covered.add(v);
    }
  }
  const missing: number[] = [];
  for (let v = lo; v <= hi; v++) if (!covered.has(v)) missing.push(v);
  return { lo, hi, missing, overlap };
}

/** Create/edit dialog for a RandomTableDetail: metadata fields up top, then a column/entry
 * structure editor below. Saves metadata via createTable/updateTable and structure via
 * replaceStructure - the latter throws on the backend's gap/overlap validation, which we
 * catch and surface inline instead of losing it in a toast. */
export function RandomTableEditor({ open, onClose, campaignId, initialTable, initialCategoryId = null, onSaved }: RandomTableEditorProps) {
  const [state, setState] = useState(emptyState());
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const createTable = useRandomTableStore((s) => s.createTable);
  const updateTable = useRandomTableStore((s) => s.updateTable);
  const replaceStructure = useRandomTableStore((s) => s.replaceStructure);

  const flatCategories = useCategoryStore((s) => s.flat);
  const fetchTree = useCategoryStore((s) => s.fetchTree);
  const formats = useTableFormatStore((s) => s.formats);
  const fetchFormats = useTableFormatStore((s) => s.fetchFormats);
  const createFormat = useTableFormatStore((s) => s.createFormat);

  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);
  const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);
  const npcs = creatures.filter((creature) => creature.category === 'npc');

  const magicItemsByCampaignId = useMagicItemStore((s) => s.magicItemsByCampaignId);
  const fetchMagicItemsForCampaign = useMagicItemStore((s) => s.fetchMagicItemsForCampaign);
  const magicItems = getMagicItemsForCampaign(magicItemsByCampaignId, campaignId);

  const encountersByCampaignId = useEncounterStore((s) => s.encountersByCampaignId);
  const fetchEncountersForCampaign = useEncounterStore((s) => s.fetchEncountersForCampaign);
  const encounters = getEncountersForCampaign(encountersByCampaignId, campaignId);

  const [tableRefOptions, setTableRefOptions] = useState<RandomTable[]>([]);

  useEffect(() => {
    if (!open) return;
    setState(initialTable ? stateFromDetail(initialTable) : { ...emptyState(), categoryId: initialCategoryId });
    setActiveStep(0);
    setError(null);
    fetchTree();
    fetchFormats();
    fetchCreaturesForCampaign(campaignId);
    fetchMagicItemsForCampaign(campaignId);
    fetchEncountersForCampaign(campaignId);
    randomTablesApi
      .listRandomTables({ campaign_id: campaignId, scope: 'own_or_global', limit: 200 })
      .then((page) => setTableRefOptions(page.items.map(apiRandomTableToTable).filter((t) => t.id !== initialTable?.id)))
      .catch((err) => console.error('Failed to load tables for table_ref picker', err));
  }, [open, initialTable, initialCategoryId, campaignId, fetchTree, fetchFormats, fetchCreaturesForCampaign, fetchMagicItemsForCampaign, fetchEncountersForCampaign]);

  const set = <K extends keyof ReturnType<typeof emptyState>>(key: K, value: ReturnType<typeof emptyState>[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const selectedFormat = formats.find((f) => f.id === state.formatId);
  const formatSlug = selectedFormat?.slug ?? '';
  const isRangeStrict = RANGE_STRICT_SLUGS.has(formatSlug);
  const isWeighted = WEIGHT_SLUGS.has(formatSlug);
  const isGrid = formatSlug === 'grid';
  const showWeightField = isWeighted || (!isRangeStrict && formatSlug !== '');

  const coreFormats = formats.filter((f) => f.tier === 'core');
  const advancedFormats = formats.filter((f) => f.tier === 'advanced');

  const setColumns = (columns: TableColumn[]) => set('columns', columns);
  const addColumn = () => {
    const column = newColumn();
    if (formatSlug === 'generator') column.entries = column.entries.map((entry) => ({ ...entry, kind: 'encounter_ref' as const }));
    setColumns([...state.columns, column]);
  };
  const removeColumn = (id: string) => setColumns(state.columns.filter((c) => c.id !== id));
  const updateColumn = (id: string, changes: Partial<TableColumn>) =>
    setColumns(state.columns.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  const addEntry = (columnId: string) => {
    const entry = newEntry(columnId);
    if (formatSlug === 'generator') entry.kind = 'encounter_ref';
    updateColumn(columnId, { entries: [...state.columns.find((c) => c.id === columnId)!.entries, entry] });
  };
  const removeEntry = (columnId: string, entryId: string) => {
    const col = state.columns.find((c) => c.id === columnId);
    if (!col) return;
    updateColumn(columnId, { entries: col.entries.filter((e) => e.id !== entryId) });
  };
  const updateEntry = (columnId: string, entryId: string, changes: Partial<TableEntry>) => {
    const col = state.columns.find((c) => c.id === columnId);
    if (!col) return;
    updateColumn(columnId, { entries: col.entries.map((e) => (e.id === entryId ? { ...e, ...changes } : e)) });
  };

  const isValid = state.name.trim().length > 0 && !!state.formatId;

  const handleSave = async () => {
    setError(null);
    if (!state.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!state.formatId) {
      setError('Pick a format.');
      return;
    }
    let formatConfig: Record<string, unknown> | null = null;
    if (state.formatConfigText.trim()) {
      try {
        formatConfig = JSON.parse(state.formatConfigText);
      } catch {
        setError('Format config must be valid JSON (or left blank).');
        return;
      }
    }

    const meta = {
      name: state.name.trim(),
      description: state.description.trim() || null,
      categoryId: state.categoryId,
      formatId: state.formatId,
      triggerSituation: state.triggerSituation.trim() || null,
      imageUrl: state.imageUrl.trim() || null,
      combineTemplate: state.combineTemplate.trim() || null,
      sourceBook: state.sourceBook.trim() || null,
      formatConfig,
      tagIds: state.tagIds,
    };

    setSaving(true);
    try {
      if (initialTable) {
        const updated = await updateTable(initialTable.id, randomTableToApiPayload({ ...meta, campaignId: initialTable.campaignId }));
        if (!updated) {
          setError('Failed to save table details.');
          setSaving(false);
          return;
        }
        const detail = await replaceStructure(initialTable.id, state.columns);
        if (detail) onSaved(detail);
      } else {
        const payload = { ...randomTableToApiPayload({ ...meta, campaignId }), columns: state.columns.map(tableColumnToApiPayload) };
        const detail = await createTable(payload);
        if (detail) onSaved(detail);
        else {
          setError('Failed to create table.');
          setSaving(false);
          return;
        }
      }
      setSaving(false);
      onClose();
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to save table.');
    }
  };

  const categoryOption = flatCategories.find((c) => c.id === state.categoryId) ?? null;
  const draftPreview: RandomTableDetail = {
    id: initialTable?.id ?? 'draft-preview',
    campaignId: initialTable?.campaignId ?? campaignId,
    name: state.name || 'Untitled random table',
    description: state.description || null,
    categoryId: state.categoryId,
    formatId: state.formatId,
    triggerSituation: state.triggerSituation || null,
    imageUrl: state.imageUrl || null,
    combineTemplate: state.combineTemplate || null,
    sourceBook: state.sourceBook || null,
    formatConfig: null,
    isSystem: false,
    createdAt: initialTable?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    tagIds: state.tagIds,
    columns: state.columns,
  };

  const configValue = (key: string, fallback: number) => {
    try {
      const parsed = state.formatConfigText.trim() ? JSON.parse(state.formatConfigText) as Record<string, unknown> : {};
      return typeof parsed[key] === 'number' ? parsed[key] as number : fallback;
    } catch {
      return fallback;
    }
  };
  const setConfigValue = (key: string, value: number) => {
    let parsed: Record<string, unknown> = {};
    try { parsed = state.formatConfigText.trim() ? JSON.parse(state.formatConfigText) as Record<string, unknown> : {}; } catch { /* replaced by valid config below */ }
    parsed[key] = value;
    set('formatConfigText', JSON.stringify(parsed, null, 2));
  };
  const goToStructure = () => {
    if (!state.name.trim() || !state.formatId) {
      setError('Add a name and choose a format before building the table.');
      return;
    }
    setError(null);
    setEditingEntryId(null);
    if (state.columns.length === 0) {
      setColumns(starterColumns(formatSlug));
    } else if (formatSlug === 'generator') {
      setColumns(state.columns.map((column) => ({
        ...column,
        entries: column.entries.map((entry) => ({
          ...entry,
          kind: 'encounter_ref' as const,
          text: null,
          targetTableId: null,
          creatureId: null,
          npcId: null,
          itemId: null,
        })),
      })));
    }
    setActiveStep(1);
  };
  const createCustomFormat = async () => {
    const name = window.prompt('Custom format name');
    if (!name?.trim()) return;
    const suggestedSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const slug = window.prompt('Format slug', suggestedSlug);
    if (!slug?.trim()) return;
    const created = await createFormat({ name: name.trim(), slug: slug.trim(), tier: 'advanced', description: 'Custom lookup-compatible format' });
    if (created) set('formatId', created.id);
  };

  const renderEntryResultEditor = (column: TableColumn, entry: TableEntry) => {
    if (entry.kind === 'text') return <TextField size="small" value={entry.text ?? ''} onChange={(e) => updateEntry(column.id, entry.id, { text: e.target.value })} placeholder="Result text" fullWidth multiline maxRows={4} />;
    if (entry.kind === 'creature_ref') return <Autocomplete size="small" options={creatures} getOptionLabel={(value) => value.name} value={creatures.find((value) => value.id === entry.creatureId) ?? null} onChange={(_e, value) => updateEntry(column.id, entry.id, { creatureId: value?.id ?? null })} renderInput={(params) => <TextField {...params} label="Creature" />} />;
    if (entry.kind === 'encounter_ref') return <Autocomplete size="small" options={encounters} getOptionLabel={(value) => value.name} value={encounters.find((value) => value.id === entry.encounterId) ?? null} onChange={(_e, value) => updateEntry(column.id, entry.id, { encounterId: value?.id ?? null })} renderInput={(params) => <TextField {...params} label="Encounter" />} />;
    if (entry.kind === 'table_ref') return <Autocomplete size="small" options={tableRefOptions} getOptionLabel={(value) => value.name} value={tableRefOptions.find((value) => value.id === entry.targetTableId) ?? null} onChange={(_e, value) => updateEntry(column.id, entry.id, { targetTableId: value?.id ?? null })} renderInput={(params) => <TextField {...params} label="Target table" />} />;
    if (entry.kind === 'npc_ref') return <Autocomplete size="small" options={npcs} getOptionLabel={(value) => value.name} value={npcs.find((value) => value.id === entry.npcId) ?? null} onChange={(_e, value) => updateEntry(column.id, entry.id, { npcId: value?.id ?? null })} renderInput={(params) => <TextField {...params} label="NPC" />} />;
    return <Autocomplete size="small" options={magicItems} getOptionLabel={(value) => value.name} value={magicItems.find((value) => value.id === entry.itemId) ?? null} onChange={(_e, value) => updateEntry(column.id, entry.id, { itemId: value?.id ?? null })} renderInput={(params) => <TextField {...params} label="Magic item" />} />;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth slotProps={{ paper: { sx: { borderRadius: 4, height: 'min(92vh, 980px)' } } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{initialTable ? 'Edit Random Table' : 'Create Random Table'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stepper activeStep={activeStep} alternativeLabel sx={{ maxWidth: 760, mx: 'auto', width: '100%' }}>
            <Step><StepLabel>Details & format</StepLabel></Step>
            <Step><StepLabel>Build the table</StepLabel></Step>
            <Step><StepLabel>Preview & save</StepLabel></Step>
          </Stepper>

          {activeStep === 0 && <>

          <TextField label="Name" value={state.name} onChange={(e) => set('name', e.target.value)} required fullWidth autoFocus />
          <TextField
            label="Description"
            value={state.description}
            onChange={(e) => set('description', e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
          />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Autocomplete<Category>
              options={flatCategories}
              value={categoryOption}
              getOptionLabel={(c) => categoryPath(flatCategories, c.id)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_e, value) => set('categoryId', value?.id ?? null)}
              renderInput={(params) => <TextField {...params} label="Category" />}
              sx={{ flex: 1 }}
            />
            <Autocomplete
              options={[...coreFormats, ...advancedFormats]}
              groupBy={(format) => format.tier === 'core' ? 'Core formats' : 'Advanced formats'}
              getOptionLabel={(format) => format.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              value={selectedFormat ?? null}
              onChange={(_event, value) => set('formatId', value?.id ?? '')}
              renderInput={(params) => <TextField {...params} label="Format" required />}
              sx={{ flex: 1 }}
            />
            <Button variant="outlined" onClick={() => void createCustomFormat()} sx={{ alignSelf: 'stretch', whiteSpace: 'nowrap' }}>New format</Button>
          </Stack>

          <FormatMiniPreview slug={formatSlug} />

          <TagPicker selectedTagIds={state.tagIds} onChange={(ids) => set('tagIds', ids)} />

          <Accordion variant="outlined" disableGutters sx={{ borderRadius: 3, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Optional details</Typography><Typography variant="caption" color="text.secondary">Source, artwork, trigger text, templates, and advanced format configuration</Typography></Box>
            </AccordionSummary>
            <AccordionDetails>
          <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Combine template"
              value={state.combineTemplate}
              onChange={(e) => set('combineTemplate', e.target.value)}
              placeholder="{Encounter}, {Behavior}"
              helperText="Column names in {curly braces}, filled from each rolled column."
              fullWidth
            />
            <TextField label="Source book" value={state.sourceBook} onChange={(e) => set('sourceBook', e.target.value)} fullWidth />
          </Stack>
          <TextField
            label="Image URL"
            value={state.imageUrl}
            onChange={(e) => set('imageUrl', e.target.value)}
            placeholder="Optional artwork or reference image"
            fullWidth
          />
          <TextField
            label="Trigger situation"
            value={state.triggerSituation}
            onChange={(e) => set('triggerSituation', e.target.value)}
            placeholder="When the party rests in the wilderness…"
            fullWidth
          />

          {formatSlug === 'chance_gate' && <TextField type="number" label="Default chance (%)" value={configValue('chance_percent', 15)} onChange={(e) => setConfigValue('chance_percent', Number(e.target.value) || 0)} sx={{ maxWidth: 260 }} />}
          {formatSlug === 'clock' && <TextField type="number" label="Maximum clock / doom" value={configValue('doom_max', 10)} onChange={(e) => setConfigValue('doom_max', Number(e.target.value) || 0)} sx={{ maxWidth: 260 }} />}
          {formatSlug === 'countdown_deck' && <Stack direction="row" spacing={2}><TextField type="number" label="Doom per draw" value={configValue('doom_per_draw', 1)} onChange={(e) => setConfigValue('doom_per_draw', Number(e.target.value) || 0)} /><TextField type="number" label="Maximum doom" value={configValue('doom_max', 10)} onChange={(e) => setConfigValue('doom_max', Number(e.target.value) || 0)} /></Stack>}
          {formatSlug === 'sequence' && <TextField type="number" label="Default sequence length" value={configValue('sequence_length', 5)} onChange={(e) => setConfigValue('sequence_length', Number(e.target.value) || 1)} sx={{ maxWidth: 260 }} />}
          {formatSlug === 'grid' && <Stack direction="row" spacing={2}><TextField type="number" label="Row die sides" value={configValue('row_die_sides', 6)} onChange={(e) => setConfigValue('row_die_sides', Number(e.target.value) || 1)} /><TextField type="number" label="Column die sides" value={configValue('col_die_sides', 6)} onChange={(e) => setConfigValue('col_die_sides', Number(e.target.value) || 1)} /></Stack>}
          <TextField
            label="Advanced format configuration (JSON)"
            value={state.formatConfigText}
            onChange={(e) => set('formatConfigText', e.target.value)}
            placeholder='e.g. { "chance_percent": 25 } for chance_gate'
            multiline
            minRows={1}
            maxRows={4}
            fullWidth
          />

          </Stack>
            </AccordionDetails>
          </Accordion>

          </>}

          {activeStep === 1 && <>

          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Box><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{formatSlug === 'generator' ? 'Generator components' : 'Live table preview'}</Typography><Typography variant="caption" color="text.secondary">The table stays visible while you build it. Click a row's pencil to edit it, then click the check mark to return it to preview mode.</Typography></Box>
            <Button size="small" startIcon={<AddIcon />} onClick={addColumn}>
              Add {formatSlug === 'generator' ? 'component' : 'column'}
            </Button>
          </Stack>

          {state.columns.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No columns yet. Most formats need at least one (its die defines what gets rolled).
            </Typography>
          )}

          {state.columns.map((column) => {
            const gaps = isRangeStrict ? coverageGaps(column) : null;
            const totalWeight = column.entries.reduce((sum, e) => sum + (e.weight ?? 0), 0);
            return (
              <Paper key={column.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    label="Column name"
                    value={column.name}
                    onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                    sx={{ flexGrow: 1, minWidth: 160 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="# dice"
                    value={column.dieCount}
                    onChange={(e) => updateColumn(column.id, { dieCount: Math.max(1, Number(e.target.value) || 1) })}
                    sx={{ width: 90 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Sides"
                    value={column.dieSides}
                    onChange={(e) => updateColumn(column.id, { dieSides: Math.max(1, Number(e.target.value) || 1) })}
                    sx={{ width: 90 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Modifier"
                    value={column.dieModifier}
                    onChange={(e) => updateColumn(column.id, { dieModifier: Number(e.target.value) || 0 })}
                    sx={{ width: 90 }}
                  />
                  <Tooltip title="Remove column">
                    <IconButton size="small" onClick={() => removeColumn(column.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: isGrid ? 290 : 190, fontWeight: 800 }}>{isWeighted ? 'Weight' : isGrid ? 'Coordinates' : 'Roll range'}</TableCell>
                        <TableCell sx={{ width: 150, fontWeight: 800 }}>Result type</TableCell>
                        <TableCell sx={{ minWidth: 280, fontWeight: 800 }}>Editable result</TableCell>
                        <TableCell align="right" sx={{ width: 80, fontWeight: 800 }}>Odds</TableCell>
                        <TableCell sx={{ width: 48 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                  {column.entries.map((entry, entryIndex) => {
                    const positional = column.entries.length > 0 && column.entries.every((item) => item.min === null && item.max === null);
                    const positionalCount = Math.min(column.dieSides > 0 ? column.dieSides : column.entries.length, column.entries.length);
                    const inferredSides = column.dieSides > 0 ? column.dieSides : Math.max(1, ...column.entries.map((item) => item.max ?? 0));
                    const probability = isRangeStrict
                      ? positional
                        ? (entryIndex < positionalCount ? 1 / positionalCount : 0)
                        : rangeProbability(column.dieCount, inferredSides, column.dieModifier, entry.min, entry.max)
                      : showWeightField
                        ? weightProbability(entry.weight, totalWeight)
                        : null;
                    return (
                      <TableRow key={entry.id} sx={{ '&:nth-of-type(4n+1), &:nth-of-type(4n+2)': { bgcolor: 'action.hover' } }}>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          {editingEntryId === entry.id ? (
                          <Stack direction="row" spacing={0.75}>
                          {isRangeStrict && (
                            <>
                              <TextField
                                size="small"
                                type="number"
                                label="Min"
                                value={entry.min ?? ''}
                                onChange={(e) => updateEntry(column.id, entry.id, { min: e.target.value ? Number(e.target.value) : null })}
                                sx={{ width: 76 }}
                              />
                              <TextField
                                size="small"
                                type="number"
                                label="Max"
                                value={entry.max ?? ''}
                                onChange={(e) => updateEntry(column.id, entry.id, { max: e.target.value ? Number(e.target.value) : null })}
                                sx={{ width: 76 }}
                              />
                            </>
                          )}
                          {showWeightField && (
                            <TextField
                              size="small"
                              type="number"
                              label="Weight"
                              value={entry.weight ?? ''}
                              onChange={(e) => updateEntry(column.id, entry.id, { weight: e.target.value ? Number(e.target.value) : null })}
                              sx={{ width: 90 }}
                            />
                          )}
                          {isGrid && (
                            <>
                              <TextField
                                size="small"
                                type="number"
                                label="2nd min"
                                value={entry.secondaryMin ?? ''}
                                onChange={(e) =>
                                  updateEntry(column.id, entry.id, { secondaryMin: e.target.value ? Number(e.target.value) : null })
                                }
                                sx={{ width: 76 }}
                              />
                              <TextField
                                size="small"
                                type="number"
                                label="2nd max"
                                value={entry.secondaryMax ?? ''}
                                onChange={(e) =>
                                  updateEntry(column.id, entry.id, { secondaryMax: e.target.value ? Number(e.target.value) : null })
                                }
                                sx={{ width: 76 }}
                              />
                            </>
                          )}
                          </Stack>
                          ) : <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, color: 'primary.main', pt: 0.75 }}>{isWeighted ? entry.weight ?? 1 : isGrid ? `${entry.min ?? 1}–${entry.max ?? entry.min ?? 1} × ${entry.secondaryMin ?? 1}–${entry.secondaryMax ?? entry.secondaryMin ?? 1}` : entry.min === entry.max ? entry.min ?? '—' : `${entry.min ?? '—'}–${entry.max ?? '—'}`}</Typography>}
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          {editingEntryId === entry.id ? (
                          <FormControl size="small" fullWidth>
                            <InputLabel id={`kind-${entry.id}`}>Kind</InputLabel>
                            <Select
                              labelId={`kind-${entry.id}`}
                              label="Kind"
                              value={formatSlug === 'generator' ? 'encounter_ref' : entry.kind}
                              disabled={formatSlug === 'generator'}
                              onChange={(e: SelectChangeEvent) => updateEntry(column.id, entry.id, { kind: e.target.value as TableEntryKind })}
                            >
                              {KIND_OPTIONS.map((k) => (
                                <MenuItem key={k.value} value={k.value}>
                                  {k.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          ) : <Chip size="small" variant="outlined" label={KIND_OPTIONS.find((option) => option.value === entry.kind)?.label ?? 'Result'} />}
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          {editingEntryId === entry.id ? <>
                          {renderEntryResultEditor(column, entry)}
                          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} sx={{ mt: 1 }}>
                            <TextField size="small" label="Notes" value={entry.notes ?? ''} onChange={(e) => updateEntry(column.id, entry.id, { notes: e.target.value || null })} sx={{ flex: 1 }} />
                            <Box sx={{ flex: 1.35 }}><TagPicker selectedTagIds={entry.tagIds} onChange={(ids) => updateEntry(column.id, entry.id, { tagIds: ids })} label="Entry tags" defaultNamespace="topic" /></Box>
                          </Stack>
                          {formatSlug === 'bundle' && (
                            <TextField
                              size="small"
                              label="Linked record fields (JSON)"
                              defaultValue={entry.bundle ? JSON.stringify(entry.bundle, null, 2) : ''}
                              placeholder='{ "creature": "…", "count": "2d4", "terrain": "…", "twist": "…" }'
                              multiline minRows={2} fullWidth sx={{ mt: 1 }}
                              onBlur={(event) => {
                                const raw = event.target.value.trim();
                                if (!raw) updateEntry(column.id, entry.id, { bundle: null });
                                else { try { updateEntry(column.id, entry.id, { bundle: JSON.parse(raw) }); } catch { setError('A bundle row contains invalid JSON.'); } }
                              }}
                            />
                          )}
                          </> : <Box sx={{ py: 0.5 }}><Typography variant="body2" color={entry.text || entry.refHydrated?.name ? 'text.primary' : 'text.secondary'} sx={{ fontStyle: entry.text || entry.refHydrated?.name ? 'normal' : 'italic' }}>{entry.text || entry.refHydrated?.name || 'Click the pencil to add this result…'}</Typography>{entry.notes && <Typography variant="caption" color="text.secondary">{entry.notes}</Typography>}</Box>}
                        </TableCell>
                        <TableCell align="right" sx={{ verticalAlign: 'top', pt: 2 }}>{probability === null ? '—' : <Typography variant="caption" color="text.secondary">{formatProbability(probability)}</Typography>}</TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          <Tooltip title={editingEntryId === entry.id ? 'Finish editing' : 'Edit this row'}>
                            <IconButton color={editingEntryId === entry.id ? 'success' : 'primary'} size="small" onClick={() => setEditingEntryId(editingEntryId === entry.id ? null : entry.id)}>
                              {editingEntryId === entry.id ? <CheckIcon fontSize="small" /> : <EditIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remove entry">
                            <IconButton size="small" onClick={() => removeEntry(column.id, entry.id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Button size="small" startIcon={<AddIcon />} onClick={() => addEntry(column.id)} sx={{ mt: 1 }}>Add table row</Button>

                {gaps && (
                  <Typography variant="caption" color={gaps.missing.length === 0 && !gaps.overlap ? 'text.secondary' : 'error'} sx={{ display: 'block', mt: 1 }}>
                    {gaps.overlap
                      ? `Entries overlap - each value ${gaps.lo}-${gaps.hi} must be covered exactly once.`
                      : gaps.missing.length > 0
                        ? `Missing coverage for: ${gaps.missing.slice(0, 10).join(', ')}${gaps.missing.length > 10 ? '…' : ''} (range ${gaps.lo}-${gaps.hi})`
                        : `Fully covers ${gaps.lo}-${gaps.hi}.`}
                  </Typography>
                )}
              </Paper>
            );
          })}
          </>}

          {activeStep === 2 && <Box>
            <Typography variant="overline" color="text.secondary">Final table preview</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Review the full-size table exactly as it will appear in the library. Go back to Build the table to make changes.</Typography>
            <RandomTableFullView table={draftPreview} />
          </Box>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        {activeStep > 0 && <Button onClick={() => setActiveStep((step) => step - 1)}>Back</Button>}
        {activeStep === 0 ? (
          <Button onClick={goToStructure} variant="contained" disabled={!isValid}>Next: build table</Button>
        ) : activeStep === 1 ? (
          <Button onClick={() => setActiveStep(2)} variant="contained" disabled={!isValid}>Next: preview</Button>
        ) : (
          <Button onClick={handleSave} variant="contained" disabled={!isValid || saving}>
            {initialTable ? 'Save Changes' : 'Create Table'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
