import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CasinoIcon from '@mui/icons-material/Casino';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import PublicIcon from '@mui/icons-material/Public';
import CastleIcon from '@mui/icons-material/Castle';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import RefreshIcon from '@mui/icons-material/Refresh';
import TuneIcon from '@mui/icons-material/Tune';
import { useGeneratorStore } from '../../store/useGeneratorStore';
import { useRandomTableStore } from '../../store/useRandomTableStore';
import { useTagStore } from '../../store/useTagStore';
import { useArticleStore } from '../../store/useArticleStore';
import type { GeneratorComponent } from '../../types/generator';
import type { RandomTable } from '../../types/randomTable';
import type { Article, ArticleCategory } from '../../types/article';

export type PlaceType = 'country' | 'settlement' | 'building' | 'dungeon';

const STEPS = ['Shape the place', 'Roll details', 'Review & create'];
const TYPE_META: Record<PlaceType, { label: string; description: string; icon: typeof PublicIcon }> = {
  country: { label: 'Country', description: 'A realm, nation, or sovereign territory.', icon: PublicIcon },
  settlement: { label: 'Settlement', description: 'A hamlet, village, town, city, or metropolis.', icon: LocationCityIcon },
  building: { label: 'Building', description: 'A residence, business, civic site, or landmark.', icon: HomeWorkIcon },
  dungeon: { label: 'Dungeon', description: 'An explorable ruin, lair, vault, or dangerous complex.', icon: CastleIcon },
};

const FACETS: Record<PlaceType, Array<{ namespace: string; label: string; description: string }>> = {
  country: [
    { namespace: 'place-country-government', label: 'Government', description: 'Who holds authority.' },
    { namespace: 'place-country-character', label: 'Culture', description: 'The realm’s public character.' },
    { namespace: 'place-country-climate', label: 'Climate', description: 'The dominant landscape and weather.' },
    { namespace: 'place-country-power', label: 'Power', description: 'Its position among neighboring realms.' },
  ],
  settlement: [
    { namespace: 'place-settlement-size', label: 'Size', description: 'From a hamlet to a metropolis.' },
    { namespace: 'place-settlement-character', label: 'Character', description: 'What visitors notice first.' },
    { namespace: 'place-settlement-economy', label: 'Economy', description: 'What keeps the settlement alive.' },
    { namespace: 'place-settlement-tone', label: 'Tone', description: 'The mood awaiting the party.' },
  ],
  building: [
    { namespace: 'place-building-type', label: 'Building family', description: 'Commerce, residence, civic, faith, military, leisure, or landmark.' },
    { namespace: 'place-building-scale', label: 'Scale', description: 'Its physical size and importance.' },
    { namespace: 'place-building-condition', label: 'Condition', description: 'How well the structure has survived.' },
    { namespace: 'place-building-tone', label: 'Atmosphere', description: 'How it feels to enter.' },
  ],
  dungeon: [
    { namespace: 'place-dungeon-origin', label: 'Origin', description: 'Why the site first existed.' },
    { namespace: 'place-dungeon-environment', label: 'Environment', description: 'Where its chambers are found.' },
    { namespace: 'place-dungeon-danger', label: 'Danger', description: 'How punishing exploration should be.' },
    { namespace: 'place-dungeon-theme', label: 'Theme', description: 'The adventure’s dominant flavor.' },
  ],
};

const MANUAL_FIELDS: Record<PlaceType, Array<{ key: string; label: string; placeholder: string }>> = {
  country: [],
  settlement: [{ key: 'country', label: 'Country (optional)', placeholder: 'Type the country this settlement belongs to' }],
  building: [
    { key: 'city', label: 'City or settlement (optional)', placeholder: 'Type the city or settlement; this is never auto-generated' },
    { key: 'country', label: 'Country (optional)', placeholder: 'Type the country containing that city' },
  ],
  dungeon: [
    { key: 'nearSettlement', label: 'Nearest settlement (optional)', placeholder: 'Type a nearby city, town, or village' },
    { key: 'country', label: 'Country (optional)', placeholder: 'Type the country or realm' },
  ],
};

const SLOT_LABELS: Record<string, string> = {
  name: 'Name', government: 'Government', culture: 'Culture', territories: 'Territory & climate', militaryStrength: 'Military strength',
  ruler: 'Ruler', capital: 'Capital', population: 'Population', currency: 'Currency', currentConflict: 'Current conflict', settlementType: 'Settlement size',
  definingTrait: 'Defining trait', economicSources: 'Economic source', overallTone: 'Overall tone', rulerOwner: 'Ruler / owner', claimToFame: 'Claim to fame',
  currentCalamity: 'Current calamity', rumorsAndHooks: 'Rumor or hook', buildingType: 'Building type', condition: 'Condition', atmosphere: 'Atmosphere', scale: 'Scale',
  floors: 'Number of floors', owner: 'Owner', purpose: 'Purpose', notableFeatures: 'Notable feature', secret: 'Secret', origin: 'Origin', dungeonEnvironment: 'Environment',
  danger: 'Danger', dungeonTheme: 'Theme', statesOfRuin: 'State of ruin', inhabitants: 'Inhabitants', treasure: 'Treasure', hook: 'Adventure hook',
};

function slotLabel(slot: string) {
  return SLOT_LABELS[slot] ?? slot.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

interface PlaceBuilderDialogProps {
  open: boolean;
  worldId: string;
  campaignId?: string;
  initialType?: PlaceType;
  onClose: () => void;
  onCreated: (article: Article) => void;
}

export function PlaceBuilderDialog({ open, worldId, campaignId, initialType, onClose, onCreated }: PlaceBuilderDialogProps) {
  const searchGenerators = useGeneratorStore((s) => s.search);
  const generators = useGeneratorStore((s) => s.results);
  const searching = useGeneratorStore((s) => s.searching);
  const fetchGenerator = useGeneratorStore((s) => s.fetchDetail);
  const fetchTable = useRandomTableStore((s) => s.fetchDetail);
  const rollTable = useRandomTableStore((s) => s.roll);
  const tags = useTagStore((s) => s.tags);
  const fetchTags = useTagStore((s) => s.fetchTags);
  const addArticle = useArticleStore((s) => s.addArticle);

  const [step, setStep] = useState(0);
  const [placeType, setPlaceType] = useState<PlaceType>(initialType ?? 'settlement');
  const [components, setComponents] = useState<GeneratorComponent[] | null>(null);
  const [tables, setTables] = useState<Record<string, RandomTable>>({});
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [constraints, setConstraints] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const [resultTagIds, setResultTagIds] = useState<Record<string, string[]>>({});
  const [rollingSlots, setRollingSlots] = useState<Set<string>>(new Set());
  const [errorSlots, setErrorSlots] = useState<Set<string>>(new Set());
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setPlaceType(initialType ?? 'settlement');
    setComponents(null);
    setTables({});
    setSelectedSlots(new Set());
    setConstraints(new Set());
    setManual({});
    setResults({});
    setResultTagIds({});
    setErrorSlots(new Set());
    setLoadFailed(false);
    void searchGenerators({ q: 'Builder', campaignId, scope: 'own_or_global', sort: 'name' });
    void fetchTags();
  }, [open, initialType, campaignId, searchGenerators, fetchTags]);

  useEffect(() => {
    if (!open) return;
    const generator = generators.find((item) => item.slug === `${placeType}-builder`);
    if (!generator) {
      if (!searching) setLoadFailed(true);
      return;
    }
    let active = true;
    setLoadFailed(false);
    setComponents(null);
    void fetchGenerator(generator.id).then(async (detail) => {
      if (!detail || !active) { if (active) setLoadFailed(true); return; }
      const ordered = [...detail.components].sort((a, b) => a.sortOrder - b.sortOrder);
      const loaded = await Promise.all(ordered.map((component) => fetchTable(component.tableId)));
      if (!active) return;
      setComponents(ordered);
      setTables(Object.fromEntries(loaded.filter((table): table is NonNullable<typeof table> => table !== null).map((table) => [table.id, table])));
      setSelectedSlots(new Set(ordered.map((component) => component.outputSlot)));
      setResults({});
      setResultTagIds({});
      setErrorSlots(new Set());
    });
    return () => { active = false; };
  }, [open, placeType, generators, searching, fetchGenerator, fetchTable]);

  const selectedComponents = useMemo(() => (components ?? []).filter((component) => selectedSlots.has(component.outputSlot)), [components, selectedSlots]);
  const rolledCount = selectedComponents.filter((component) => results[component.outputSlot]).length;
  const rolling = rollingSlots.size > 0;

  const chooseType = (next: PlaceType) => {
    if (next === placeType) return;
    setPlaceType(next);
    setConstraints(new Set());
    setManual({});
  };

  const toggleConstraint = (id: string) => {
    setConstraints((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setResults({});
    setResultTagIds({});
  };

  const toggleSlot = (slot: string) => setSelectedSlots((current) => {
    const next = new Set(current); if (next.has(slot)) next.delete(slot); else next.add(slot); return next;
  });

  const rollComponent = async (component: GeneratorComponent) => {
    setRollingSlots((current) => new Set(current).add(component.outputSlot));
    setErrorSlots((current) => { const next = new Set(current); next.delete(component.outputSlot); return next; });
    const rolled = await rollTable(component.tableId, { filter_tag_ids: Array.from(constraints) });
    setRollingSlots((current) => { const next = new Set(current); next.delete(component.outputSlot); return next; });
    const value = rolled?.combinedText ?? rolled?.items.map((item) => item.resolvedText ?? item.text).filter(Boolean).join(' · ') ?? '';
    if (!value) {
      setResults((current) => { const next = { ...current }; delete next[component.outputSlot]; return next; });
      setResultTagIds((current) => { const next = { ...current }; delete next[component.outputSlot]; return next; });
      setErrorSlots((current) => new Set(current).add(component.outputSlot));
      return;
    }
    setResults((current) => ({ ...current, [component.outputSlot]: value }));
    setResultTagIds((current) => ({ ...current, [component.outputSlot]: Array.from(new Set(rolled?.items.flatMap((item) => item.tagIds) ?? [])) }));
  };

  const rollSelected = async () => Promise.all(selectedComponents.map(rollComponent));

  const createPlace = () => {
    const now = Date.now();
    const rolledFields = Object.fromEntries(Object.entries(results).filter(([key]) => key !== 'name'));
    if (placeType === 'building') rolledFields.locationUnder = manual.city ?? '';
    if (placeType === 'settlement') rolledFields.locationUnder = manual.country ?? '';
    if (placeType === 'dungeon') rolledFields.locationUnder = manual.nearSettlement || manual.country || '';
    Object.entries(manual).forEach(([key, value]) => { if (value.trim()) rolledFields[key] = value.trim(); });
    const taxonomy = Array.from(new Set(Object.values(resultTagIds).flat())).map((id) => tags.find((tag) => tag.id === id)).filter((tag): tag is NonNullable<typeof tag> => !!tag);
    const summary = selectedComponents
      .filter((component) => component.outputSlot !== 'name' && results[component.outputSlot])
      .map((component) => `<p><strong>${slotLabel(component.outputSlot)}:</strong> ${results[component.outputSlot]}</p>`)
      .join('');
    const article: Article = {
      id: crypto.randomUUID(), worldId, folderId: null, category: placeType as ArticleCategory,
      name: results.name || `Unnamed ${TYPE_META[placeType].label}`,
      coverImageSrc: '', tags: Array.from(new Set([placeType, ...taxonomy.map((tag) => tag.value)])), visibility: 'gm',
      fieldValues: rolledFields, body: `<h2>Generated overview</h2>${summary}`, linkedEntityType: null, linkedEntityId: null,
      createdAt: now, updatedAt: now,
    };
    addArticle(article);
    onCreated(article);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { borderRadius: 4, minHeight: 700, maxHeight: '94vh' } } }}>
      <DialogTitle sx={{ px: { xs: 2, md: 3 }, pt: 2.5, pb: 1.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box sx={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 2.5, bgcolor: 'primary.main', color: 'primary.contrastText' }}><AutoAwesomeIcon /></Box>
          <Box><Typography variant="h6" sx={{ fontWeight: 850 }}>Build a random place</Typography><Typography variant="body2" color="text.secondary">Guide independent tables, reroll any detail, then create a complete article.</Typography></Box>
        </Stack>
      </DialogTitle>
      <Box sx={{ px: { xs: 2, md: 5 }, pb: 2 }}><Stepper activeStep={step} alternativeLabel>{STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper></Box>
      <DialogContent dividers sx={{ p: { xs: 2, md: 3 }, bgcolor: 'action.hover' }}>
        {step === 0 && (
          <Stack spacing={2.5}>
            <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>What kind of place?</Typography><Typography variant="body2" color="text.secondary">Choose one. Every option loads its own questions and random tables.</Typography></Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
              {(Object.keys(TYPE_META) as PlaceType[]).map((type) => {
                const meta = TYPE_META[type]; const Icon = meta.icon; const selected = placeType === type;
                return <Paper component="button" type="button" key={type} onClick={() => chooseType(type)} variant="outlined" sx={{ p: 2, minHeight: 142, textAlign: 'left', cursor: 'pointer', borderRadius: 3, borderColor: selected ? 'primary.main' : 'divider', bgcolor: selected ? 'primary.main' : 'background.paper', color: selected ? 'primary.contrastText' : 'text.primary', font: 'inherit', transition: '150ms', '&:hover': { boxShadow: 3 } }}><Icon /><Typography sx={{ fontWeight: 850, mt: 1 }}>{meta.label}</Typography><Typography variant="body2" sx={{ opacity: 0.8 }}>{meta.description}</Typography></Paper>;
              })}
            </Box>
            {!components && !loadFailed && <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /><Typography color="text.secondary">Loading {placeType} tables…</Typography></Stack>}
            {loadFailed && <Alert severity="warning">The {TYPE_META[placeType].label} Builder is not installed. Run the place-builder seed script, then reopen this dialog.</Alert>}
            {components && <>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><TuneIcon color="primary" fontSize="small" /><Typography variant="subtitle1" sx={{ fontWeight: 850 }}>Guide the random choices</Typography></Stack>
                <Typography variant="body2" color="text.secondary">Optional. Choose several values in a group to widen that part of the pool.</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5, mt: 1.5 }}>
                  {FACETS[placeType].map((facet) => <Box key={facet.namespace} sx={{ p: 1.25, borderRadius: 2, bgcolor: 'action.hover', minHeight: 96 }}><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{facet.label}</Typography><Typography variant="caption" color="text.secondary">{facet.description}</Typography><Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>{tags.filter((tag) => tag.namespace === facet.namespace).map((tag) => <Chip key={tag.id} size="small" clickable label={tag.label} color={constraints.has(tag.id) ? 'primary' : 'default'} variant={constraints.has(tag.id) ? 'filled' : 'outlined'} onClick={() => toggleConstraint(tag.id)} />)}</Stack></Box>)}
                </Box>
              </Paper>
              {MANUAL_FIELDS[placeType].length > 0 && <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }}><Typography variant="subtitle1" sx={{ fontWeight: 850 }}>Place it in your world</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>These optional values are typed by you and are never generated.</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>{MANUAL_FIELDS[placeType].map((field) => <TextField key={field.key} size="small" label={field.label} placeholder={field.placeholder} value={manual[field.key] ?? ''} onChange={(event) => setManual((current) => ({ ...current, [field.key]: event.target.value }))} />)}</Box></Paper>}
              <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>What should the dice decide?</Typography><Typography variant="body2" color="text.secondary">All tables start selected. Turn off anything you want to write yourself later.</Typography></Box>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}><Button size="small" onClick={() => setSelectedSlots(new Set(components.map((component) => component.outputSlot)))}>Select all</Button><Button size="small" color="inherit" onClick={() => setSelectedSlots(new Set())}>Clear</Button><Chip size="small" color="primary" label={`${selectedSlots.size} of ${components.length} selected`} /></Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1.25 }}>{components.map((component) => { const selected = selectedSlots.has(component.outputSlot); return <Paper component="button" type="button" key={component.id} variant="outlined" onClick={() => toggleSlot(component.outputSlot)} sx={{ p: 1.35, textAlign: 'left', cursor: 'pointer', borderRadius: 2.5, borderColor: selected ? 'primary.main' : 'divider', bgcolor: selected ? 'primary.main' : 'background.paper', color: selected ? 'primary.contrastText' : 'text.primary', font: 'inherit' }}><Stack direction="row" spacing={1}><Checkbox checked={selected} tabIndex={-1} sx={{ p: 0, color: selected ? 'inherit' : undefined, '&.Mui-checked': { color: selected ? 'inherit' : undefined } }} /><Box><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{slotLabel(component.outputSlot)}</Typography><Typography variant="caption" sx={{ opacity: 0.75 }}>{tables[component.tableId]?.name ?? 'Random table'}</Typography></Box></Stack></Paper>; })}</Box>
            </>}
          </Stack>
        )}
        {components && step === 1 && <Stack spacing={2}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}><Box><Typography variant="h6" sx={{ fontWeight: 800 }}>Roll the selected tables</Typography><Typography variant="body2" color="text.secondary">Each result includes the taxonomy that produced it.</Typography></Box><Button variant="contained" startIcon={<CasinoIcon />} disabled={rolling} onClick={() => void rollSelected()}>{rolledCount ? 'Reroll all selected' : 'Roll all selected'}</Button></Stack>{rolling && <LinearProgress />}<Stack spacing={1.25}>{selectedComponents.map((component) => { const value = results[component.outputSlot]; const itemTags = tags.filter((tag) => (resultTagIds[component.outputSlot] ?? []).includes(tag.id)); return <Paper key={component.id} variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: 'background.paper' }}><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}><Box sx={{ flexGrow: 1 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>{slotLabel(component.outputSlot)} · {tables[component.tableId]?.name}</Typography><Typography color={value ? 'text.primary' : 'text.disabled'}>{rollingSlots.has(component.outputSlot) ? 'Rolling…' : value || 'Not rolled yet'}</Typography>{itemTags.length > 0 && <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 0.75 }}>{itemTags.map((tag) => <Chip key={tag.id} size="small" color="secondary" variant="outlined" label={`${tag.namespace.split('-').slice(-1)[0]}: ${tag.label}`} />)}</Stack>}</Box>{value && <CheckCircleIcon color="success" fontSize="small" />}<Tooltip title={`Roll ${slotLabel(component.outputSlot)}`}><span><IconButton color="primary" disabled={rolling} onClick={() => void rollComponent(component)}>{value ? <RefreshIcon /> : <CasinoIcon />}</IconButton></span></Tooltip></Stack>{errorSlots.has(component.outputSlot) && <Alert severity="warning" sx={{ mt: 1 }}>No row matched this guidance. Widen the related choice and try again.</Alert>}</Paper>; })}</Stack></Stack>}
        {components && step === 2 && <Stack spacing={2.5}><Box><Typography variant="h6" sx={{ fontWeight: 800 }}>Review the {TYPE_META[placeType].label.toLowerCase()}</Typography><Typography variant="body2" color="text.secondary">Creating it saves a full article to Places, ready for editing and expansion.</Typography></Box><Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper' }}>{selectedComponents.filter((component) => results[component.outputSlot]).map((component, index) => <Box key={component.id}><Stack direction="row" spacing={2} sx={{ px: 2, py: 1.25 }}><Typography variant="body2" color="text.secondary" sx={{ width: 150, flexShrink: 0, fontWeight: 750 }}>{slotLabel(component.outputSlot)}</Typography><Box><Typography variant="body2">{results[component.outputSlot]}</Typography><Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 0.5 }}>{tags.filter((tag) => (resultTagIds[component.outputSlot] ?? []).includes(tag.id)).map((tag) => <Chip key={tag.id} size="small" variant="outlined" label={tag.label} />)}</Stack></Box></Stack>{index < rolledCount - 1 && <Divider />}</Box>)}</Paper>{MANUAL_FIELDS[placeType].filter((field) => manual[field.key]?.trim()).length > 0 && <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>{MANUAL_FIELDS[placeType].filter((field) => manual[field.key]?.trim()).map((field) => <Typography key={field.key} variant="body2"><strong>{field.label.replace(' (optional)', '')}:</strong> {manual[field.key]}</Typography>)}</Paper>}</Stack>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}><Button color="inherit" startIcon={step > 0 ? <NavigateBeforeIcon /> : undefined} onClick={step === 0 ? onClose : () => setStep((value) => value - 1)}>{step === 0 ? 'Cancel' : 'Back'}</Button>{step < 2 ? <Button variant="contained" endIcon={<NavigateNextIcon />} disabled={!components || (step === 0 ? selectedSlots.size === 0 : rolledCount === 0 || rolling)} onClick={() => setStep((value) => value + 1)}>{step === 0 ? 'Continue to rolls' : 'Review place'}</Button> : <Button variant="contained" startIcon={<AutoAwesomeIcon />} disabled={!results.name} onClick={createPlace}>Create {TYPE_META[placeType].label} article</Button>}</DialogActions>
    </Dialog>
  );
}
