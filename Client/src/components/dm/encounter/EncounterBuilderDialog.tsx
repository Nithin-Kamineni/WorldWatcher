import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
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
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import RefreshIcon from '@mui/icons-material/Refresh';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { CreatureStatBlockDialog, StatBox } from '../CreatureStatBlockDialog';
import { useGeneratorStore } from '../../../store/useGeneratorStore';
import { useRandomTableStore } from '../../../store/useRandomTableStore';
import { useTagStore } from '../../../store/useTagStore';
import { useCreatureStore } from '../../../store/useCreatureStore';
import { computeEncounterDifficulty, nearestCRForXP } from '../../../utils/encounterCalculator';
import type { GeneratorComponent, GeneratorDetail } from '../../../types/generator';
import type { RollResultItem } from '../../../types/randomTable';
import type { Creature } from '../../../types/creature';
import type {
  Encounter, EncounterCombatBlock, EncounterCreatureEntry, EncounterExplorationBlock,
  EncounterPrimaryType, EncounterSocialBlock,
} from '../../../types/encounter';

const STEPS = ['Shape the encounter', 'Roll the scene', 'Preview & add'];
const PILLARS: Array<{ value: EncounterPrimaryType; label: string; description: string; icon: typeof ShieldOutlinedIcon }> = [
  { value: 'social', label: 'Social / Roleplay', description: 'Negotiation, intrigue, debate, and character-driven tension.', icon: ChatBubbleOutlineIcon },
  { value: 'combat', label: 'Combat', description: 'A tactical conflict with a linked creature roster and live XP.', icon: ShieldOutlinedIcon },
  { value: 'exploration', label: 'Exploration', description: 'Discovery, hazards, traversal, puzzles, and survival.', icon: ExploreOutlinedIcon },
];
const PLACES = ['tavern', 'court', 'market', 'wilderness', 'road', 'dungeon', 'ruins', 'temple', 'coast', 'planar'];
const THEMES = ['intrigue', 'horror', 'heroic', 'mystery', 'survival', 'war', 'arcane', 'divine'];
const DIFFICULTIES = ['easy', 'medium', 'hard', 'deadly'] as const;
const TYPE_OPTIONS: Record<EncounterPrimaryType, Array<{ key: string; label: string; values: Array<[string, string]> }>> = {
  social: [
    { key: 'shape', label: 'Scene', values: [['negotiation', 'Negotiation'], ['interrogation', 'Interrogation'], ['request_persuasion', 'Request / Persuasion'], ['deception_infiltration', 'Deception / Infiltration'], ['court_audience', 'Court / Audience'], ['info_gathering', 'Information gathering'], ['debate', 'Debate'], ['verbal_puzzle', 'Verbal puzzle']] },
    { key: 'tone', label: 'Tone', values: [['tense', 'Tense'], ['cordial', 'Cordial'], ['formal', 'Formal'], ['comedic', 'Comedic'], ['threatening', 'Threatening'], ['somber', 'Somber'], ['mysterious', 'Mysterious']] },
    { key: 'stakes', label: 'Stakes', values: [['information', 'Information'], ['ally_introduction', 'An ally / introduction'], ['item_reward', 'An item / reward'], ['safe_passage', 'Safe passage'], ['job_quest', 'A job / quest'], ['a_life', 'A life'], ['contract_deal', 'A contract / deal'], ['access', 'Access']] },
  ],
  combat: [
    { key: 'shape', label: 'Fight shape', values: [['ambush', 'Ambush'], ['skirmish', 'Skirmish'], ['set_piece_boss', 'Set-piece / boss'], ['horde_swarm', 'Horde / swarm'], ['waves_gauntlet', 'Waves / gauntlet'], ['siege', 'Siege'], ['chase', 'Chase'], ['escort_defense', 'Escort / defense']] },
    { key: 'terrain', label: 'Terrain', values: [['open', 'Open ground'], ['dense_forest', 'Dense / forest'], ['corridor_cramped', 'Corridor / cramped'], ['cavern', 'Cavern'], ['rooftops_urban', 'Rooftops / urban'], ['bridge_chokepoint', 'Bridge / chokepoint'], ['water_swamp', 'Water / swamp'], ['ruins_rubble', 'Ruins / rubble']] },
    { key: 'awareness', label: 'Opening', values: [['party_surprised', 'Party surprised'], ['enemies_surprised', 'Enemies surprised'], ['mutual', 'Mutual awareness'], ['stealth_approach', 'Stealth approach possible']] },
  ],
  exploration: [
    { key: 'shape', label: 'Challenge', values: [['navigation_travel', 'Navigation / travel'], ['dungeon_delve', 'Dungeon delve'], ['trap', 'Trap'], ['hazard', 'Hazard'], ['puzzle', 'Puzzle'], ['investigation_discovery', 'Investigation / discovery'], ['traversal', 'Traversal'], ['timed_escape', 'Timed escape'], ['stealth_infiltration', 'Stealth / infiltration']] },
    { key: 'environment', label: 'Environment', values: [['forest', 'Forest'], ['mountain', 'Mountain'], ['desert', 'Desert'], ['swamp', 'Swamp'], ['arctic', 'Arctic'], ['coast', 'Coast'], ['underdark', 'Underdark'], ['urban', 'Urban'], ['dungeon', 'Dungeon'], ['ruins', 'Ruins'], ['feywild', 'Feywild'], ['planar', 'Planar']] },
    { key: 'obstacle', label: 'Obstacle', values: [['physical_barrier', 'Physical barrier'], ['trap', 'Trap'], ['environmental_hazard', 'Environmental hazard'], ['locked_sealed', 'Locked / sealed'], ['puzzle_mechanism', 'Puzzle / mechanism'], ['guardian', 'Guardian'], ['natural_feature', 'Natural feature'], ['maze_navigation', 'Maze / navigation']] },
  ],
};

const SLOT_LABELS: Record<string, string> = {
  name: 'Title', hook: 'Hook', read_aloud: 'Read aloud', objective: 'Objective', complication: 'Complication',
  reward: 'Reward', creature: 'Creature roster', actor: 'NPC cast',
};

function title(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function resultText(item?: RollResultItem) { return item?.resolvedText ?? item?.text ?? (item?.refHydrated?.name as string | undefined) ?? ''; }

function emptyCombatBlock(): EncounterCombatBlock {
  return { shape: null, victoryCondition: null, awareness: null, startRange: 'medium', lighting: null, terrainType: null, terrainFeatures: [], morale: 'flees_leader_falls', reinforcements: null, dynamicEvents: [], difficultyBand: null, computedXp: null, hasLairOrLegendary: false, aftermath: [], scalingNotes: null, mapId: null, transitionEncounterId: null };
}
function emptySocialBlock(): EncounterSocialBlock {
  return { shape: null, venue: null, tone: null, stakes: null, playerLevers: ['persuade', 'present_proof'], keyChecks: [], outcomeTiers: null, socialClock: null, gatedInfo: [], complications: [], escalation: 'can_turn_combat', transitionEncounterId: null };
}
function emptyExplorationBlock(): EncounterExplorationBlock {
  return { shape: null, environment: null, terrainDifficulty: null, obstacleType: null, trap: null, hazard: null, skillChallenge: null, puzzle: null, sensoryClues: [], pointsOfInterest: [], navigation: null, resourceCost: [], verticality: false, complications: [], transitionEncounterId: null, wanderingTableId: null };
}

interface Props {
  open: boolean;
  campaignId: string;
  initialType?: EncounterPrimaryType;
  partySize: number;
  partyLevel: number;
  onClose: () => void;
  onAdd: (encounter: Encounter) => void;
}

export function EncounterBuilderDialog({ open, campaignId, initialType, partySize, partyLevel, onClose, onAdd }: Props) {
  const searchGenerators = useGeneratorStore((s) => s.search);
  const generators = useGeneratorStore((s) => s.results);
  const generatorSearching = useGeneratorStore((s) => s.searching);
  const fetchGenerator = useGeneratorStore((s) => s.fetchDetail);
  const fetchTable = useRandomTableStore((s) => s.fetchDetail);
  const rollTable = useRandomTableStore((s) => s.roll);
  const tags = useTagStore((s) => s.tags);
  const fetchTags = useTagStore((s) => s.fetchTags);
  const fetchCreatureById = useCreatureStore((s) => s.fetchCreatureById);

  const [step, setStep] = useState(0);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [pillar, setPillar] = useState<EncounterPrimaryType>(initialType ?? 'combat');
  const [generator, setGenerator] = useState<GeneratorDetail | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, RollResultItem>>({});
  const [rollingSlots, setRollingSlots] = useState<Set<string>>(new Set());
  const [actor, setActor] = useState<Creature | null>(null);
  const [viewingActor, setViewingActor] = useState<Creature | null>(null);
  const [place, setPlace] = useState('dungeon');
  const [theme, setTheme] = useState('mystery');
  const [targetDifficulty, setTargetDifficulty] = useState<(typeof DIFFICULTIES)[number]>('medium');
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const nextPillar = initialType ?? 'combat';
    setStep(0); setDraftId(crypto.randomUUID()); setPillar(nextPillar); setGenerator(null); setResults({}); setActor(null); setViewingActor(null); setLoadFailed(false);
    setPlace(nextPillar === 'social' ? 'tavern' : nextPillar === 'exploration' ? 'wilderness' : 'dungeon');
    setTheme('mystery'); setTargetDifficulty('medium');
    void searchGenerators({ q: 'Encounter Builder', campaignId, scope: 'own_or_global' });
    void fetchTags();
  }, [open, initialType, campaignId, searchGenerators, fetchTags]);

  useEffect(() => {
    if (!open) return;
    const defaults = Object.fromEntries(TYPE_OPTIONS[pillar].map((option) => [option.key, option.values[0][0]]));
    setChoices(defaults); setResults({}); setActor(null); setGenerator(null); setLoadFailed(false);
    const match = generators.find((candidate) => candidate.slug === `${pillar}-encounter-builder`);
    if (!match) { if (!generatorSearching) setLoadFailed(true); return; }
    void fetchGenerator(match.id).then(async (detail) => {
      if (!detail) { setLoadFailed(true); return; }
      setGenerator(detail);
      setSelectedSlots(new Set(detail.components.map((component) => component.outputSlot)));
      await Promise.all(detail.components.map((component) => fetchTable(component.tableId)));
    });
  }, [open, pillar, generators, generatorSearching, fetchGenerator, fetchTable]);

  const components = useMemo(() => [...(generator?.components ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [generator]);
  const selectedComponents = components.filter((component) => selectedSlots.has(component.outputSlot));
  const rolledCount = selectedComponents.filter((component) => results[component.outputSlot]).length;
  const constraintTagIds = useMemo(() => tags.filter((tag) =>
    (tag.namespace === 'encounter-place' && tag.value === place) ||
    (tag.namespace === 'encounter-theme' && tag.value === theme) ||
    (tag.namespace === 'encounter-difficulty' && tag.value === targetDifficulty),
  ).map((tag) => tag.id), [tags, place, theme, targetDifficulty]);

  const roster = useMemo<EncounterCreatureEntry[]>(() => {
    if (!actor || pillar === 'social') return [];
    const base = { id: crypto.randomUUID(), creatureId: actor.id, name: actor.name, imageSrc: actor.tokenImage, quantity: 1, cr: actor.cr, role: pillar === 'combat' ? 'skirmisher' as const : null };
    let best = base;
    let bestDistance = Number.POSITIVE_INFINITY;
    const order = ['trivial', 'easy', 'medium', 'hard', 'deadly'];
    const targetIndex = order.indexOf(targetDifficulty);
    for (let quantity = 1; quantity <= 12; quantity++) {
      const candidate = { ...base, quantity };
      const calculated = computeEncounterDifficulty([candidate], partySize, partyLevel);
      const distance = Math.abs(order.indexOf(calculated.bracket) - targetIndex);
      if (distance < bestDistance) { best = candidate; bestDistance = distance; }
      if (distance === 0) break;
    }
    return [best];
  }, [actor, pillar, targetDifficulty, partySize, partyLevel]);
  const difficulty = useMemo(() => computeEncounterDifficulty(roster, partySize, partyLevel), [roster, partySize, partyLevel]);
  const challengeRating = roster.length ? nearestCRForXP(difficulty.adjustedXP) : '';

  const toggleSlot = (slot: string) => setSelectedSlots((current) => {
    const next = new Set(current); if (next.has(slot)) next.delete(slot); else next.add(slot); return next;
  });

  const rollComponent = async (component: GeneratorComponent) => {
    setRollingSlots((current) => new Set(current).add(component.outputSlot));
    const rolled = await rollTable(component.tableId, { filter_tag_ids: constraintTagIds });
    const item = rolled?.items[0];
    if (item) {
      setResults((current) => ({ ...current, [component.outputSlot]: item }));
      if ((item.kind === 'creature_ref' || item.kind === 'npc_ref') && item.refId) {
        const creature = await fetchCreatureById(item.refId);
        setActor(creature ?? null);
      }
    }
    setRollingSlots((current) => { const next = new Set(current); next.delete(component.outputSlot); return next; });
  };
  const rollAll = async () => Promise.all(selectedComponents.map(rollComponent));

  const buildEncounter = (): Encounter => {
    const now = Date.now();
    const objective = resultText(results.objective);
    const complication = resultText(results.complication);
    const hook = resultText(results.hook);
    const reward = resultText(results.reward);
    const primaryActor = results.actor ?? results.creature;
    const encounter: Encounter = {
      id: draftId, name: resultText(results.name) || `${title(theme)} ${title(pillar)} Encounter`,
      description: [hook, complication && `Complication: ${complication}`].filter(Boolean).join('\n\n'),
      challengeRating, computedXp: difficulty.totalXP, difficulty: roster.length ? difficulty.label : targetDifficulty,
      theme: title(theme), encounterType: title(choices.shape ?? pillar), possibleLocations: [title(place)],
      tags: [title(theme), title(place), title(targetDifficulty)], resolutionType: 'fixed', creatures: roster,
      createdAt: now, updatedAt: now, primaryType: pillar, categoryId: generator?.categoryId ?? null, status: 'ready',
      readAloud: resultText(results.read_aloud) || null, objective: objective || null,
      partyLevelMin: partyLevel, partyLevelMax: partyLevel, partySize, scalingNotes: 'Adjust the linked creature quantity to match party size and current resources.',
      locationId: null, generatorId: null, rewards: reward ? [{ kind: 'generated', itemId: null, description: reward, quantity: 1, sortOrder: 0 }] : [], tagIds: constraintTagIds,
      npcs: pillar === 'social' && actor && primaryActor ? [{ id: crypto.randomUUID(), npcId: actor.id, name: actor.name, imageSrc: actor.tokenImage, attitude: 'indifferent', agenda: 'wants_information', secret: null, leverage: null, rpCues: null, sortOrder: 0 }] : [],
      combatBlock: null, socialBlock: null, explorationBlock: null,
    };
    const objectiveValues: Record<string, string> = { 'Defeat the leader': 'defeat_leader', 'Survive until help arrives': 'survive_rounds', 'Protect a vulnerable target': 'protect_escort', 'Reach the far exit': 'reach_escape', 'Retrieve the marked object': 'retrieve_destroy', 'Break enemy morale': 'break_morale', 'Hold the chokepoint': 'hold_position', 'Capture the commander alive': 'capture_alive' };
    const socialVenues: Record<string, string> = { tavern: 'tavern', court: 'court_throne_room', market: 'street_market', temple: 'temple', wilderness: 'camp', road: 'camp', dungeon: 'private_residence', ruins: 'camp', coast: 'shop', planar: 'guild_hall' };
    if (pillar === 'combat') encounter.combatBlock = { ...emptyCombatBlock(), shape: choices.shape, terrainType: choices.terrain, awareness: choices.awareness, victoryCondition: objectiveValues[objective] ?? 'defeat_all', difficultyBand: targetDifficulty, computedXp: difficulty.totalXP, dynamicEvents: complication ? [{ trigger: 'Mid-encounter', event: complication }] : [] };
    if (pillar === 'social') encounter.socialBlock = { ...emptySocialBlock(), shape: choices.shape, venue: socialVenues[place] ?? 'tavern', tone: choices.tone, stakes: choices.stakes, complications: complication ? [complication] : [] };
    if (pillar === 'exploration') encounter.explorationBlock = { ...emptyExplorationBlock(), shape: choices.shape, environment: choices.environment, obstacleType: choices.obstacle, terrainDifficulty: targetDifficulty === 'easy' ? 'normal' : targetDifficulty === 'medium' ? 'difficult' : 'hazardous', complications: complication ? [complication] : [] };
    return encounter;
  };

  const preview = buildEncounter();

  return <>
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { borderRadius: 4, minHeight: 'min(88vh, 820px)' } } }}>
      <DialogTitle sx={{ pb: 1 }}><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}><Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center' }}><AutoAwesomeIcon /></Box><Box><Typography variant="h6" sx={{ fontWeight: 850 }}>Encounter Builder</Typography><Typography variant="body2" color="text.secondary">Shape, roll, preview, then add a ready-to-run scene.</Typography></Box></Stack></DialogTitle>
      <DialogContent dividers><Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>{STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
        {loadFailed && <Alert severity="warning">The Encounter Builder tables are not available yet. Run the encounter builder seed, then reopen this dialog.</Alert>}
        {!generator && !loadFailed && <LinearProgress />}
        {step === 0 && <Stack spacing={3}>
          <Box><Typography variant="subtitle2" sx={{ fontWeight: 850, mb: 1 }}>Encounter pillar</Typography><ToggleButtonGroup exclusive value={pillar} onChange={(_event, value) => value && setPillar(value)} fullWidth>{PILLARS.map((item) => { const Icon = item.icon; return <ToggleButton key={item.value} value={item.value} sx={{ py: 1.5 }}><Stack spacing={0.5} sx={{ alignItems: 'center' }}><Icon /><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{item.label}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' }, textTransform: 'none' }}>{item.description}</Typography></Stack></ToggleButton>; })}</ToggleButtonGroup></Box>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}><TextField select slotProps={{ select: { native: true } }} label="Place" value={place} onChange={(event) => setPlace(event.target.value)} fullWidth>{PLACES.map((value) => <option key={value} value={value}>{title(value)}</option>)}</TextField><TextField select slotProps={{ select: { native: true } }} label="Theme" value={theme} onChange={(event) => setTheme(event.target.value)} fullWidth>{THEMES.map((value) => <option key={value} value={value}>{title(value)}</option>)}</TextField><TextField select slotProps={{ select: { native: true } }} label="Target difficulty" value={targetDifficulty} onChange={(event) => setTargetDifficulty(event.target.value as typeof targetDifficulty)} fullWidth>{DIFFICULTIES.map((value) => <option key={value} value={value}>{title(value)}</option>)}</TextField></Stack>
          {TYPE_OPTIONS[pillar].map((option) => <Box key={option.key}><Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>{option.label}</Typography><Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>{option.values.map(([value, label]) => <Chip key={value} clickable color={choices[option.key] === value ? 'primary' : 'default'} variant={choices[option.key] === value ? 'filled' : 'outlined'} label={label} onClick={() => { setChoices((current) => ({ ...current, [option.key]: value })); setResults({}); setActor(null); }} />)}</Stack></Box>)}
          {generator && <Box><Typography variant="subtitle2" sx={{ fontWeight: 850, mb: 1 }}>Tables to roll</Typography><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>{components.map((component) => <Chip key={component.id} icon={<Checkbox size="small" checked={selectedSlots.has(component.outputSlot)} />} clickable variant={selectedSlots.has(component.outputSlot) ? 'filled' : 'outlined'} color={selectedSlots.has(component.outputSlot) ? 'primary' : 'default'} label={SLOT_LABELS[component.outputSlot] ?? title(component.outputSlot)} onClick={() => toggleSlot(component.outputSlot)} />)}</Stack></Box>}
        </Stack>}
        {step === 1 && <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover' }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap sx={{ justifyContent: 'space-around' }}><StatBox label="Target" value={title(targetDifficulty)} /><StatBox label={`Difficulty (${partySize} @ level ${partyLevel})`} value={roster.length ? difficulty.label : 'No combat XP'} /><StatBox label="XP" value={difficulty.totalXP.toLocaleString()} /><StatBox label="Challenge rating" value={challengeRating || '—'} /></Stack></Paper>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Typography variant="body2" color="text.secondary">{rolledCount} of {selectedComponents.length} tables rolled</Typography><Button variant="contained" startIcon={rollingSlots.size ? <CircularProgress size={18} color="inherit" /> : <CasinoIcon />} disabled={!generator || rollingSlots.size > 0 || selectedComponents.length === 0} onClick={() => void rollAll()}>{rolledCount ? 'Roll all again' : 'Roll encounter'}</Button></Stack>
          <Stack spacing={1}>{selectedComponents.map((component) => { const item = results[component.outputSlot]; const isActor = item?.kind === 'creature_ref' || item?.kind === 'npc_ref'; return <Paper key={component.id} variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}><Box sx={{ flexGrow: 1, minWidth: 0 }}><Typography variant="caption" color="text.secondary">{SLOT_LABELS[component.outputSlot] ?? title(component.outputSlot)}</Typography>{item ? (isActor && actor ? <Chip clickable onClick={() => setViewingActor(actor)} avatar={<Avatar src={actor.tokenImage || undefined} />} color="primary" variant="outlined" label={`${actor.name}${actor.cr ? ` · CR ${actor.cr}` : ''}`} /> : <Typography variant="body1">{resultText(item)}</Typography>) : <Typography variant="body2" color="text.disabled">Not rolled yet</Typography>}</Box><Tooltip title="Reroll this table"><span><IconButton color="primary" disabled={rollingSlots.has(component.outputSlot)} onClick={() => void rollComponent(component)}>{rollingSlots.has(component.outputSlot) ? <CircularProgress size={20} /> : <RefreshIcon />}</IconButton></span></Tooltip></Stack></Paper>; })}</Stack>
        </Stack>}
        {step === 2 && <Stack spacing={2.25}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderLeft: 5, borderLeftColor: 'primary.main' }}><Stack spacing={1.5}><Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><CheckCircleIcon color="success" /><Box sx={{ flexGrow: 1 }}><Typography variant="h6" sx={{ fontWeight: 850 }}>{preview.name}</Typography><Typography variant="body2" color="text.secondary">{title(pillar)} · {title(place)} · {title(theme)}</Typography></Box><Chip color="success" label="Ready" /></Stack><Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}><StatBox label="Difficulty" value={roster.length ? difficulty.label : title(targetDifficulty)} /><StatBox label="XP" value={difficulty.totalXP.toLocaleString()} /><StatBox label="Challenge rating" value={challengeRating || '—'} /></Stack></Stack></Paper>
          {preview.readAloud && <Paper variant="outlined" sx={{ p: 2, fontStyle: 'italic', bgcolor: 'action.hover' }}>{preview.readAloud}</Paper>}
          <Box><Typography variant="subtitle2" color="primary" sx={{ fontWeight: 850 }}>Objective</Typography><Typography>{preview.objective}</Typography></Box>
          <Box><Typography variant="subtitle2" color="primary" sx={{ fontWeight: 850 }}>Scene</Typography><Typography sx={{ whiteSpace: 'pre-line' }}>{preview.description}</Typography></Box>
          {actor && <Box><Typography variant="subtitle2" color="primary" sx={{ fontWeight: 850, mb: 0.75 }}>{pillar === 'social' ? 'NPC cast' : 'Creature roster'}</Typography><Chip clickable onClick={() => setViewingActor(actor)} avatar={<Avatar src={actor.tokenImage || undefined} />} label={`${roster[0]?.quantity ?? 1}× ${actor.name}${actor.cr ? ` · CR ${actor.cr}` : ''}`} /></Box>}
          {preview.rewards.length > 0 && <Box><Typography variant="subtitle2" color="primary" sx={{ fontWeight: 850 }}>Reward</Typography><Typography>{preview.rewards[0].description}</Typography></Box>}
        </Stack>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}><Button onClick={onClose}>Cancel</Button><Box sx={{ flexGrow: 1 }} />{step > 0 && <Button startIcon={<NavigateBeforeIcon />} onClick={() => setStep((value) => value - 1)}>Back</Button>}{step < 2 ? <Button variant="contained" endIcon={<NavigateNextIcon />} disabled={!generator || (step === 1 && rolledCount < selectedComponents.length)} onClick={() => setStep((value) => value + 1)}>{step === 0 ? 'Choose tables' : 'Preview encounter'}</Button> : <Button variant="contained" startIcon={<CheckCircleIcon />} onClick={() => onAdd(preview)}>Add encounter</Button>}</DialogActions>
    </Dialog>
    <CreatureStatBlockDialog open={!!viewingActor} creature={viewingActor} onClose={() => setViewingActor(null)} />
  </>;
}
