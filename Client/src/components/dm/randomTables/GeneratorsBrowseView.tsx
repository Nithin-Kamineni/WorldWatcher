import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import InputOutlinedIcon from '@mui/icons-material/InputOutlined';
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { CategoryGraphBrowser } from './CategoryGraphBrowser';
import { GeneratorEditor } from './GeneratorEditor';
import { GeneratorRunner } from './GeneratorRunner';
import { FilterBar } from '../FilterBar';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { useGeneratorStore } from '../../../store/useGeneratorStore';
import { useCategoryStore, categoryPath } from '../../../store/useCategoryStore';
import { EMPTY_RANDOM_TABLE_RESULTS, useRandomTableStore } from '../../../store/useRandomTableStore';
import type { Category } from '../../../types/category';
import type { Generator, GeneratorDetail } from '../../../types/generator';

interface GeneratorsBrowseViewProps { campaignId: string; }

function subtreeIds(flat: Category[], selectedId: string | null): Set<string> | null {
  if (!selectedId) return null;
  const ids = new Set([selectedId]);
  let changed = true;
  while (changed) {
    changed = false;
    flat.forEach((category) => { if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) { ids.add(category.id); changed = true; } });
  }
  return ids;
}

function GeneratorFullView({ generator, tableResultKey }: { generator: GeneratorDetail; tableResultKey: string }) {
  const tables = useRandomTableStore((s) => s.resultSets[tableResultKey]?.results ?? EMPTY_RANDOM_TABLE_RESULTS);
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}16, transparent 65%)` }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center' }}><AutoAwesomeIcon /></Box>
          <Box><Typography variant="subtitle1" sx={{ fontWeight: 850 }}>{generator.name}</Typography><Typography variant="body2" color="text.secondary">{generator.description || 'Composite random generator'}</Typography></Box>
        </Stack>
      </Paper>
      <Box><Typography variant="caption" color="text.secondary">Output template</Typography><Typography variant="body2" sx={{ mt: 0.5, p: 1.25, borderRadius: 2, bgcolor: 'action.hover', fontFamily: 'monospace' }}>{generator.combineTemplate}</Typography></Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, flex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}><InputOutlinedIcon fontSize="small" color="primary" /><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Inputs · {generator.parameters.length}</Typography></Stack>
          {generator.parameters.length === 0 ? <Typography variant="body2" color="text.secondary">No inputs; every slot is fixed.</Typography> : generator.parameters.map((parameter) => <Stack key={parameter.key} direction="row" sx={{ py: 0.75, borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between' }}><Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{parameter.label || parameter.key}</Typography><Typography variant="caption" color="text.secondary">{parameter.key} · {parameter.type}</Typography></Box>{parameter.required && <Chip size="small" label="Required" />}</Stack>)}
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, flex: 1.25 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}><SchemaOutlinedIcon fontSize="small" color="primary" /><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Table components · {generator.components.length}</Typography></Stack>
          {generator.components.map((component) => <Stack key={component.id} direction="row" spacing={1} sx={{ py: 0.75, borderTop: '1px solid', borderColor: 'divider', alignItems: 'center' }}><Chip size="small" color="primary" label={`{${component.outputSlot}}`} /><Box sx={{ minWidth: 0, flexGrow: 1 }}><Typography variant="body2" noWrap>{tables.find((table) => table.id === component.tableId)?.name ?? component.tableId}</Typography><Typography variant="caption" color="text.secondary">{component.filterParamKey ? `Filtered by ${component.filterParamKey}` : 'Fixed'} · roll {component.rollCount}</Typography></Box>{component.optional && <Chip size="small" variant="outlined" label="Optional" />}</Stack>)}
        </Paper>
      </Stack>
    </Stack>
  );
}

export function GeneratorsBrowseView({ campaignId }: GeneratorsBrowseViewProps) {
  const tableResultKey = `generators:${campaignId}`;
  const results = useGeneratorStore((s) => s.results);
  const searching = useGeneratorStore((s) => s.searching);
  const details = useGeneratorStore((s) => s.detailById);
  const search = useGeneratorStore((s) => s.search);
  const deleteGenerator = useGeneratorStore((s) => s.deleteGenerator);
  const cloneGenerator = useGeneratorStore((s) => s.cloneGenerator);
  const fetchDetail = useGeneratorStore((s) => s.fetchDetail);
  const categories = useCategoryStore((s) => s.flat);
  const fetchTree = useCategoryStore((s) => s.fetchTree);
  const searchTables = useRandomTableStore((s) => s.search);
  const [searchText, setSearchText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGenerator, setEditingGenerator] = useState<GeneratorDetail | undefined>();
  const [createCategoryId, setCreateCategoryId] = useState<string | null>(null);
  const [runTarget, setRunTarget] = useState<Generator | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Generator | null>(null);

  useEffect(() => { fetchTree(); void searchTables({ campaignId, scope: 'own_or_global', limit: 500 }, tableResultKey); }, [fetchTree, searchTables, campaignId, tableResultKey]);
  useEffect(() => { const handle = setTimeout(() => void search({ q: searchText || undefined, campaignId, scope: 'own_or_global' }), 250); return () => clearTimeout(handle); }, [search, searchText, campaignId]);
  const ids = useMemo(() => subtreeIds(categories, selectedCategoryId), [categories, selectedCategoryId]);
  const selectedGenerators = useMemo(() => ids ? results.filter((generator) => generator.categoryId && ids.has(generator.categoryId)) : results, [results, ids]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    const byId = new Map(categories.map((category) => [category.id, category]));
    results.forEach((generator) => { let category = generator.categoryId ? byId.get(generator.categoryId) : undefined; const seen = new Set<string>(); while (category && !seen.has(category.id)) { seen.add(category.id); map.set(category.id, (map.get(category.id) ?? 0) + 1); category = category.parentId ? byId.get(category.parentId) : undefined; } });
    return map;
  }, [results, categories]);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const refresh = () => void search({ q: searchText || undefined, campaignId, scope: 'own_or_global' });
  const openCreate = (categoryId: string | null) => { setCreateCategoryId(categoryId); setEditingGenerator(undefined); setEditorOpen(true); };
  const openEdit = async (generator: Generator) => { const detail = await fetchDetail(generator.id); if (detail) { setEditingGenerator(detail); setEditorOpen(true); } };
  const toggle = async (generator: Generator) => { const opening = !expanded.has(generator.id); setExpanded((current) => { const next = new Set(current); if (opening) next.add(generator.id); else next.delete(generator.id); return next; }); if (opening) await fetchDetail(generator.id); };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2, alignItems: { md: 'center' } }}>
        <Box sx={{ flexGrow: 1 }}><FilterBar search={searchText} onSearchChange={setSearchText} searchPlaceholder="Search generator names and descriptions…" hasActiveFilters={false} onClearFilters={() => {}}><Box /></FilterBar></Box>
        <Stack direction="row" spacing={1}><Chip icon={<HubOutlinedIcon />} variant="outlined" label={`${results.length} generators`} /><Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate(null)}>New generator</Button></Stack>
      </Stack>
      {searching && <LinearProgress sx={{ mb: 1 }} />}
      <CategoryGraphBrowser selectedId={selectedCategoryId} counts={counts} itemLabel="generator" onSelect={(id) => { setSelectedCategoryId(id); setDrawerOpen(true); }} onCreateAt={openCreate} />

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} slotProps={{ paper: { sx: { width: { xs: '100%', md: 'min(880px, 88vw)' }, bgcolor: 'background.default' } } }}>
        <Box sx={{ p: 3, position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}><Box sx={{ width: 48, height: 48, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'primary.contrastText' }}><AutoAwesomeIcon /></Box><Box sx={{ flexGrow: 1 }}><Typography variant="h5" sx={{ fontWeight: 850 }}>{selectedCategory?.name ?? 'All generators'}</Typography><Typography variant="body2" color="text.secondary">{selectedCategory ? categoryPath(categories, selectedCategory.id) : 'Composite tools across the category constellation'}</Typography><Chip size="small" label={`${selectedGenerators.length} generators`} sx={{ mt: 1 }} /></Box><IconButton onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton></Stack>
          <Button sx={{ mt: 2 }} variant="contained" startIcon={<AddIcon />} onClick={() => openCreate(selectedCategoryId)}>Create generator here</Button>
        </Box>
        <Stack spacing={1.5} sx={{ p: 3 }}>
          {selectedGenerators.length === 0 ? <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed' }}><SearchIcon sx={{ fontSize: 46, color: 'text.disabled' }} /><Typography variant="h6">No generators in this branch</Typography></Paper> : selectedGenerators.map((generator) => {
            const isExpanded = expanded.has(generator.id);
            const detail = details[generator.id];
            return <Paper key={generator.id} variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper' }}><Stack direction="row" spacing={1.25} sx={{ p: 1.5, alignItems: 'center' }}><IconButton onClick={() => void toggle(generator)}>{isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}</IconButton><Box onClick={() => void toggle(generator)} sx={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }}><Stack direction="row" spacing={1}><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{generator.name}</Typography>{generator.isSystem && <Chip size="small" label="Curated" />}</Stack><Typography variant="body2" color="text.secondary" noWrap>{generator.description || generator.combineTemplate}</Typography></Box><Tooltip title="Run"><IconButton color="primary" onClick={() => setRunTarget(generator)}><AutoAwesomeIcon /></IconButton></Tooltip><Tooltip title={generator.isSystem ? 'Copy to edit - curated generators are read-only' : 'Copy generator'}><IconButton onClick={() => void cloneGenerator(generator.id, campaignId).then(refresh)}><ContentCopyIcon /></IconButton></Tooltip>{!generator.isSystem && <><Tooltip title="Edit"><IconButton onClick={() => void openEdit(generator)}><EditIcon /></IconButton></Tooltip><Tooltip title="Delete"><IconButton onClick={() => setDeleteTarget(generator)}><DeleteOutlineIcon /></IconButton></Tooltip></>}</Stack>{isExpanded && <><Divider />{detail ? <Box sx={{ p: 2 }}><GeneratorFullView generator={detail} tableResultKey={tableResultKey} /></Box> : <LinearProgress />}</>}</Paper>;
          })}
        </Stack>
      </Drawer>

      <GeneratorEditor open={editorOpen} onClose={() => setEditorOpen(false)} campaignId={campaignId} initialGenerator={editingGenerator} initialCategoryId={createCategoryId} onSaved={refresh} />
      <ConfirmDeleteDialog open={!!deleteTarget} itemName={deleteTarget?.name ?? ''} itemType="generator" onCancel={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) void deleteGenerator(deleteTarget.id); setDeleteTarget(null); }} />
      {runTarget && <Dialog open onClose={() => setRunTarget(null)} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}><DialogTitle sx={{ fontWeight: 850 }}>{runTarget.name}</DialogTitle><DialogContent dividers><GeneratorRunner generator={runTarget} /></DialogContent><DialogActions><Button onClick={() => setRunTarget(null)}>Close</Button></DialogActions></Dialog>}
    </Box>
  );
}
