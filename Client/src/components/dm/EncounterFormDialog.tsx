import { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Switch from '@mui/material/Switch';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import TuneIcon from '@mui/icons-material/Tune';
import CalculateIcon from '@mui/icons-material/Calculate';
import CasinoIcon from '@mui/icons-material/Casino';
import {
  ENCOUNTER_LOCATION_PRESETS,
  ENCOUNTER_THEME_PRESETS,
  ENCOUNTER_TYPE_PRESETS,
  type CombatRole,
  type Encounter,
  type EncounterCombatBlock,
  type EncounterCreatureEntry,
  type EncounterExplorationBlock,
  type EncounterNpcEntry,
  type EncounterPrimaryType,
  type EncounterResolutionType,
  type EncounterRollTable,
  type EncounterSocialBlock,
  type EncounterStatus,
  type EncounterTableCreature,
  type EncounterTableRow,
  type NpcAgenda,
  type NpcAttitude,
  type RpCues,
  type EncounterReward,
} from '../../types/encounter';
import type { Creature } from '../../types/creature';
import type { ApiCondition, ApiMap } from '../../api/types';
import * as mapsApi from '../../api/resources/maps';
import * as conditionsApi from '../../api/resources/conditions';
import { CategoryTreeBrowser } from './randomTables/CategoryTreeBrowser';
import { TagPicker } from './randomTables/TagPicker';
import { suggestEncounterDifficulty } from '../../utils/encounterCalculator';
import { useEncounterStore, getEncountersForCampaign } from '../../store/useEncounterStore';
import { useMagicItemStore, getMagicItemsForCampaign } from '../../store/useMagicItemStore';
import * as randomTablesApi from '../../api/resources/randomTables';
import * as generatorsApi from '../../api/resources/generators';
import { apiRandomTableToTable, apiGeneratorToGenerator } from '../../api/adapters';
import type { RandomTable } from '../../types/randomTable';
import type { Generator } from '../../types/generator';

interface EncounterFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (encounter: Encounter) => void;
  initialEncounter?: Encounter;
  creatures: Creature[];
  /** Optional - scopes the combat block's map picker. EncountersSection doesn't currently pass
   * this, so the picker falls back to listing maps across all campaigns; still useful once wired. */
  campaignId?: string;
}

// ---- run-layer enum vocabularies (see Client/src/types/encounter.ts for the source of truth) ----
const PRIMARY_TYPES: EncounterPrimaryType[] = ['combat', 'social', 'exploration'];
const STATUSES: EncounterStatus[] = ['draft', 'ready', 'used'];
const COMBAT_ROLES: CombatRole[] = [
  'minion', 'skirmisher', 'brute', 'soldier', 'artillery', 'controller', 'lurker', 'leader', 'solo_boss', 'support_healer',
];
const NPC_ATTITUDES: NpcAttitude[] = ['hostile', 'unfriendly', 'indifferent', 'friendly', 'helpful'];
const NPC_AGENDAS: NpcAgenda[] = [
  'wants_money', 'wants_protection', 'wants_information', 'wants_revenge', 'wants_recruit',
  'wants_deceive', 'wants_escape', 'wants_status', 'hiding_secret', 'testing_party',
];

const COMBAT_SHAPES = ['ambush', 'skirmish', 'set_piece_boss', 'horde_swarm', 'waves_gauntlet', 'duel', 'siege', 'chase', 'escort_defense', 'puzzle_combat'];
const VICTORY_CONDITIONS = ['defeat_all', 'defeat_leader', 'survive_rounds', 'protect_escort', 'reach_escape', 'retrieve_destroy', 'capture_alive', 'hold_position', 'slip_past', 'break_morale'];
const AWARENESS_OPTIONS = ['party_surprised', 'enemies_surprised', 'mutual', 'stealth_approach'];
const START_RANGES = ['melee', 'close', 'medium', 'long', 'variable'];
const LIGHTING_OPTIONS = ['bright', 'dim', 'darkness', 'magical_darkness'];
const TERRAIN_TYPES = ['open', 'dense_forest', 'corridor_cramped', 'cavern', 'rooftops_urban', 'bridge_chokepoint', 'water_swamp', 'vertical_cliffs', 'ruins_rubble', 'interior_room'];
const TERRAIN_FEATURES = ['difficult_terrain', 'cover_half', 'cover_three_quarters', 'cover_full', 'elevation', 'hazard_zones', 'obscurement', 'destructible_cover', 'chokepoints', 'drowning_risk', 'traps_present'];
const MORALE_OPTIONS = ['fights_to_death', 'flees_50pct', 'flees_leader_falls', 'surrenders_losing', 'parleys', 'retreats_reinforce', 'fanatical'];
const DIFFICULTY_BANDS = ['low', 'moderate', 'high', 'easy', 'medium', 'hard', 'deadly'];
const AFTERMATH_OPTIONS = ['survivors_flee_warn', 'faction_turns_hostile', 'alarm_raised', 'salvage_loot', 'prisoners_taken', 'reputation_shift'];

const SOCIAL_SHAPES = ['negotiation', 'interrogation', 'request_persuasion', 'deception_infiltration', 'intimidation', 'haggle_bargain', 'court_audience', 'trial', 'info_gathering', 'recruitment', 'calming_hostility', 'debate', 'performance', 'verbal_puzzle'];
const VENUES = ['tavern', 'court_throne_room', 'street_market', 'prison', 'temple', 'guild_hall', 'camp', 'private_residence', 'battlefield_parley', 'shop'];
const TONES = ['tense', 'cordial', 'formal', 'comedic', 'threatening', 'somber', 'mysterious'];
const STAKES_OPTIONS = ['information', 'ally_introduction', 'item_reward', 'safe_passage', 'job_quest', 'a_life', 'contract_deal', 'access', 'nothing'];
const PLAYER_LEVERS = ['persuade', 'deceive', 'intimidate', 'bribe', 'flatter', 'invoke_authority', 'blackmail', 'appeal_emotion', 'offer_trade', 'present_proof'];
const SOCIAL_COMPLICATIONS = ['interruption', 'rival_third_party', 'time_pressure', 'hidden_agenda_surfaces', 'language_barrier', 'eavesdropper', 'bluff_called', 'emotional_trigger'];
const ESCALATION_OPTIONS = ['can_turn_combat', 'can_turn_chase', 'locks_out_if_failed', 'alerts_others'];
const OUTCOME_TIER_LABELS = ['Critical Success', 'Success', 'Partial Success', 'Failure', 'Critical Failure'];

const EXPLORATION_SHAPES = ['navigation_travel', 'dungeon_delve', 'trap', 'hazard', 'puzzle', 'investigation_discovery', 'survival', 'traversal', 'timed_escape', 'skill_challenge', 'environmental_set_piece', 'stealth_infiltration'];
const ENVIRONMENTS = ['forest', 'mountain', 'desert', 'swamp', 'arctic', 'coast', 'sea', 'underdark', 'urban', 'dungeon', 'ruins', 'jungle', 'grassland', 'feywild', 'shadowfell', 'planar'];
const TERRAIN_DIFFICULTIES = ['normal', 'difficult', 'hazardous', 'impassable'];
const OBSTACLE_TYPES = ['physical_barrier', 'trap', 'environmental_hazard', 'locked_sealed', 'puzzle_mechanism', 'guardian', 'natural_feature', 'maze_navigation'];
const RESOURCE_COSTS = ['rations', 'spell_slots', 'hp_exhaustion', 'time', 'light_torches'];
const EXPLORATION_COMPLICATIONS = ['weather_shift', 'wandering_monster', 'collapse', 'time_limit', 'split_party', 'resource_loss', 'dead_end_reroute'];
const SENSES = ['sight', 'sound', 'smell', 'touch'];
const SKILLS = ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'];
const DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];
const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Small labeled dropdown for one nullable string-enum field - shared shape for the many
 * combat/social/exploration block enum fields listed in Client/src/types/encounter.ts. */
function EnumSelect({
  label, value, options, onChange, sx,
}: { label: string; value: string | null; options: string[]; onChange: (v: string | null) => void; sx?: object }) {
  return (
    <FormControl size="small" sx={{ minWidth: 180, flex: 1, ...sx }}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value ? e.target.value : null)}>
        <MenuItem value=""><em>—</em></MenuItem>
        {options.map((opt) => (
          <MenuItem key={opt} value={opt}>{humanize(opt)}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/** Click-to-toggle chip group for the many `string[]` multi-select fields (terrainFeatures,
 * aftermath, playerLevers, complications, resourceCost, …). */
function MultiChipToggle({
  label, value, options, onChange,
}: { label: string; value: string[]; options: string[]; onChange: (v: string[]) => void }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {options.map((opt) => {
          const selected = value.includes(opt);
          return (
            <Chip
              key={opt}
              label={humanize(opt)}
              size="small"
              color={selected ? 'primary' : 'default'}
              variant={selected ? 'filled' : 'outlined'}
              onClick={() => onChange(selected ? value.filter((v) => v !== opt) : [...value, opt])}
            />
          );
        })}
      </Stack>
    </Box>
  );
}

function emptyState() {
  return {
    name: '',
    description: '',
    challengeRating: '',
    computedXp: null as number | null,
    difficulty: null as string | null,
    theme: '',
    encounterType: '',
    possibleLocations: [] as string[],
    tags: [] as string[],
    creatures: [] as EncounterCreatureEntry[],
    resolutionType: 'fixed' as EncounterResolutionType,
    page: '' as string,
    tables: [] as EncounterRollTable[],
    // --- shared "run layer" (Random Tables + Encounters overhaul) ---
    primaryType: null as EncounterPrimaryType | null,
    categoryId: null as string | null,
    status: 'draft' as EncounterStatus,
    readAloud: '',
    objective: '',
    partyLevelMin: '' as string,
    partyLevelMax: '' as string,
    partySize: '' as string,
    scalingNotes: '',
    locationId: null as string | null,
    generatorId: null as string | null,
    rewards: [] as Encounter['rewards'],
    tagIds: [] as string[],
    npcs: [] as EncounterNpcEntry[],
    combatBlock: null as EncounterCombatBlock | null,
    socialBlock: null as EncounterSocialBlock | null,
    explorationBlock: null as EncounterExplorationBlock | null,
  };
}

function emptyTableRow(): EncounterTableRow {
  return { min: 1, max: 1, result: '', resultText: '', creatures: [] };
}

function emptyRollTable(): EncounterRollTable {
  return { diceExpression: '1d10', minlvl: null, maxlvl: null, table: [emptyTableRow()] };
}

function emptyTableCreature(): EncounterTableCreature {
  return { name: '', source: null, countDice: null, countFixed: 1 };
}

function emptyCombatBlock(): EncounterCombatBlock {
  return {
    shape: null, victoryCondition: null, awareness: null, startRange: null, lighting: null,
    terrainType: null, terrainFeatures: [], morale: null, reinforcements: null, dynamicEvents: [],
    difficultyBand: null, computedXp: null, hasLairOrLegendary: false, aftermath: [], scalingNotes: null, mapId: null, transitionEncounterId: null,
  };
}

function emptySocialBlock(): EncounterSocialBlock {
  return {
    shape: null, venue: null, tone: null, stakes: null, playerLevers: [], keyChecks: [], outcomeTiers: null,
    socialClock: null, gatedInfo: [], complications: [], escalation: null, transitionEncounterId: null,
  };
}

function emptyExplorationBlock(): EncounterExplorationBlock {
  return {
    shape: null, environment: null, terrainDifficulty: null, obstacleType: null, trap: null, hazard: null,
    skillChallenge: null, puzzle: null, sensoryClues: [], pointsOfInterest: [], navigation: null,
    resourceCost: [], verticality: false, complications: [], transitionEncounterId: null, wanderingTableId: null,
  };
}

function stateFromEncounter(encounter: Encounter) {
  return {
    name: encounter.name,
    description: encounter.description,
    challengeRating: encounter.challengeRating,
    computedXp: encounter.computedXp ?? null,
    difficulty: encounter.difficulty ?? null,
    theme: encounter.theme,
    encounterType: encounter.encounterType ?? '',
    possibleLocations: encounter.possibleLocations ?? [],
    tags: encounter.tags,
    creatures: encounter.creatures,
    resolutionType: encounter.resolutionType ?? 'fixed',
    page: encounter.page != null ? String(encounter.page) : '',
    tables: encounter.tables ?? [],
    primaryType: encounter.primaryType,
    categoryId: encounter.categoryId,
    status: encounter.status ?? 'draft',
    readAloud: encounter.readAloud ?? '',
    objective: encounter.objective ?? '',
    partyLevelMin: encounter.partyLevelMin != null ? String(encounter.partyLevelMin) : '',
    partyLevelMax: encounter.partyLevelMax != null ? String(encounter.partyLevelMax) : '',
    partySize: encounter.partySize != null ? String(encounter.partySize) : '',
    scalingNotes: encounter.scalingNotes ?? '',
    locationId: encounter.locationId,
    generatorId: encounter.generatorId ?? null,
    rewards: encounter.rewards ?? [],
    tagIds: encounter.tagIds ?? [],
    npcs: encounter.npcs ?? [],
    combatBlock: encounter.combatBlock,
    socialBlock: encounter.socialBlock,
    explorationBlock: encounter.explorationBlock,
  };
}

function parseOptionalInt(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

type OutcomeTierRow = { tier: string; consequence: string };

function isOutcomeTierRows(value: unknown): value is OutcomeTierRow[] {
  return Array.isArray(value) && value.every((r) => r && typeof r === 'object' && 'tier' in r && 'consequence' in r);
}

export function EncounterFormDialog({ open, onClose, onSubmit, initialEncounter, creatures, campaignId }: EncounterFormDialogProps) {
  const isEditMode = !!initialEncounter;
  const [state, setState] = useState(emptyState());
  const [customName, setCustomName] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [maps, setMaps] = useState<ApiMap[]>([]);
  const [randomTableOptions, setRandomTableOptions] = useState<RandomTable[]>([]);
  const [conditionOptions, setConditionOptions] = useState<ApiCondition[]>([]);
  const [generatorOptions, setGeneratorOptions] = useState<Generator[]>([]);
  const [wanderingRollText, setWanderingRollText] = useState('');
  const encountersByCampaignId = useEncounterStore((s) => s.encountersByCampaignId);
  const fetchEncountersForCampaign = useEncounterStore((s) => s.fetchEncountersForCampaign);
  const magicItemsByCampaignId = useMagicItemStore((s) => s.magicItemsByCampaignId);
  const fetchMagicItemsForCampaign = useMagicItemStore((s) => s.fetchMagicItemsForCampaign);
  const magicItems = getMagicItemsForCampaign(magicItemsByCampaignId, campaignId);
  const encounterOptions = campaignId ? getEncountersForCampaign(encountersByCampaignId, campaignId).filter((encounter) => encounter.id !== initialEncounter?.id) : [];

  useEffect(() => {
    let cancelled = false;
    mapsApi
      .listMaps(campaignId ? { campaign_id: campaignId, limit: 200 } : { limit: 200 })
      .then((page) => {
        if (!cancelled) setMaps(page.items);
      })
      .catch((err) => console.error('Failed to load maps for encounter combat block', err));
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  useEffect(() => {
    if (!open || !campaignId) return;
    void fetchEncountersForCampaign(campaignId);
    // The server caps a single page at 500 rows (Server/app/api/utils.py's PaginationDep) and
    // the global random-table catalog now runs well past that (2,000+ sourced tables) - page
    // through so the wandering-table picker doesn't silently lose whichever tables sort past
    // the first 500, same fix as useRandomTableStore.search.
    (async () => {
      const items: RandomTable[] = [];
      let offset = 0;
      for (let i = 0; i < 40; i++) {
        const page = await randomTablesApi.listRandomTables({ campaign_id: campaignId, scope: 'own_or_global', limit: 500, offset });
        items.push(...page.items.map(apiRandomTableToTable));
        if (page.items.length < 500) break;
        offset += 500;
      }
      setRandomTableOptions(items);
    })().catch((err) => console.error('Failed to load wandering table options', err));
    conditionsApi.listConditions({ limit: 500 }).then((page) => setConditionOptions(page.items)).catch((err) => console.error('Failed to load conditions', err));
    // Task 11.1: an 'item' reward references a magic item by id, so the picker needs the
    // campaign's items loaded. Same store RandomTableEditor's item-column picker uses.
    void fetchMagicItemsForCampaign(campaignId);
    // Task 11.2: the reverse reference direction - an encounter can point at a composite
    // generator, not just at a single random table.
    generatorsApi
      .listGenerators({ campaign_id: campaignId, scope: 'own_or_global', limit: 500 })
      .then((page) => setGeneratorOptions(page.items.map(apiGeneratorToGenerator)))
      .catch((err) => console.error('Failed to load generator options', err));
  }, [open, campaignId, fetchEncountersForCampaign, fetchMagicItemsForCampaign]);

  useEffect(() => {
    if (!open) return;
    setState(initialEncounter ? stateFromEncounter(initialEncounter) : emptyState());
    setCustomName('');
    setMoreOpen(false);
  }, [open, initialEncounter]);

  const set = <K extends keyof ReturnType<typeof emptyState>>(key: K, value: ReturnType<typeof emptyState>[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  // ---- fixed roster helpers ----
  const addCreature = (creature: Creature) => {
    const existing = state.creatures.find((e) => e.creatureId === creature.id);
    if (existing) {
      set(
        'creatures',
        state.creatures.map((e) => (e.id === existing.id ? { ...e, quantity: e.quantity + 1 } : e)),
      );
      return;
    }
    set('creatures', [
      ...state.creatures,
      { id: crypto.randomUUID(), creatureId: creature.id, name: creature.name, imageSrc: creature.tokenImage, quantity: 1, cr: creature.cr },
    ]);
  };

  const addCustomCreature = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    set('creatures', [
      ...state.creatures,
      { id: crypto.randomUUID(), creatureId: null, name: trimmed, imageSrc: '', quantity: 1 },
    ]);
    setCustomName('');
  };

  const updateQuantity = (entryId: string, delta: number) => {
    set(
      'creatures',
      state.creatures
        .map((e) => (e.id === entryId ? { ...e, quantity: Math.max(1, e.quantity + delta) } : e))
        .filter((e) => e.quantity > 0),
    );
  };

  const removeEntry = (entryId: string) => {
    set('creatures', state.creatures.filter((e) => e.id !== entryId));
  };

  const updateCreatureEntry = (entryId: string, changes: Partial<EncounterCreatureEntry>) => {
    set('creatures', state.creatures.map((e) => (e.id === entryId ? { ...e, ...changes } : e)));
  };

  const suggestion = useMemo(
    () => suggestEncounterDifficulty(state.creatures, creatures, Number(state.partySize) || 4, state.creatures.some((entry) => creatures.find((creature) => creature.id === entry.creatureId)?.edition?.includes('2024')) ? '2024' : '2014', Number(state.partyLevelMin) || 5),
    [state.creatures, state.partySize, state.partyLevelMin, creatures],
  );

  const applySuggestion = () => {
    setState((previous) => ({
      ...previous,
      challengeRating: suggestion.cr,
      computedXp: suggestion.adjustedXP,
      difficulty: suggestion.label,
      combatBlock: previous.combatBlock ? { ...previous.combatBlock, computedXp: suggestion.adjustedXP, difficultyBand: suggestion.bracket } : previous.combatBlock,
    }));
  };

  const selectPrimaryType = (value: EncounterPrimaryType | null) => {
    if (!value) return;
    setState((previous) => ({
      ...previous,
      primaryType: value,
      combatBlock: value === 'combat' ? (previous.combatBlock ?? emptyCombatBlock()) : null,
      socialBlock: value === 'social' ? (previous.socialBlock ?? emptySocialBlock()) : null,
      explorationBlock: value === 'exploration' ? (previous.explorationBlock ?? emptyExplorationBlock()) : null,
      resolutionType: value === 'combat' ? previous.resolutionType : 'fixed',
      creatures: value === 'combat' ? previous.creatures : [],
    }));
  };

  // ---- NPC roster helpers ----
  const npcCreatures = useMemo(() => creatures.filter((c) => c.category === 'npc'), [creatures]);

  const addNpc = (creature: Creature) => {
    if (state.npcs.some((n) => n.npcId === creature.id)) return;
    set('npcs', [
      ...state.npcs,
      {
        id: crypto.randomUUID(), npcId: creature.id, name: creature.name, imageSrc: creature.tokenImage,
        attitude: null, agenda: null, secret: null, leverage: null, rpCues: null, sortOrder: state.npcs.length,
      },
    ]);
  };
  const removeNpc = (entryId: string) => set('npcs', state.npcs.filter((n) => n.id !== entryId));
  const updateNpc = (entryId: string, changes: Partial<EncounterNpcEntry>) =>
    set('npcs', state.npcs.map((n) => (n.id === entryId ? { ...n, ...changes } : n)));
  const updateNpcRpCue = (entryId: string, key: keyof RpCues, value: string) => {
    const npc = state.npcs.find((n) => n.id === entryId);
    if (!npc) return;
    updateNpc(entryId, { rpCues: { ...(npc.rpCues ?? {}), [key]: value } });
  };

  // ---- combat block helpers ----
  const setCombatBlock = (block: EncounterCombatBlock | null) => set('combatBlock', block);
  const updateCombatBlock = (changes: Partial<EncounterCombatBlock>) => {
    if (!state.combatBlock) return;
    setCombatBlock({ ...state.combatBlock, ...changes });
  };
  const addDynamicEvent = () =>
    updateCombatBlock({ dynamicEvents: [...(state.combatBlock?.dynamicEvents ?? []), { trigger: '', event: '' }] });
  const updateDynamicEvent = (index: number, changes: Partial<{ trigger: string; event: string }>) =>
    updateCombatBlock({
      dynamicEvents: (state.combatBlock?.dynamicEvents ?? []).map((d, i) => (i === index ? { ...d, ...changes } : d)),
    });
  const removeDynamicEvent = (index: number) =>
    updateCombatBlock({ dynamicEvents: (state.combatBlock?.dynamicEvents ?? []).filter((_, i) => i !== index) });

  // ---- social block helpers ----
  const setSocialBlock = (block: EncounterSocialBlock | null) => set('socialBlock', block);
  const updateSocialBlock = (changes: Partial<EncounterSocialBlock>) => {
    if (!state.socialBlock) return;
    setSocialBlock({ ...state.socialBlock, ...changes });
  };
  const addKeyCheck = () =>
    updateSocialBlock({ keyChecks: [...(state.socialBlock?.keyChecks ?? []), { skill: '', dc: 10, onSuccess: '', onFailure: '' }] });
  const updateKeyCheck = (index: number, changes: Partial<{ skill: string; dc: number; onSuccess: string; onFailure: string }>) =>
    updateSocialBlock({
      keyChecks: (state.socialBlock?.keyChecks ?? []).map((c, i) => (i === index ? { ...c, ...changes } : c)),
    });
  const removeKeyCheck = (index: number) =>
    updateSocialBlock({ keyChecks: (state.socialBlock?.keyChecks ?? []).filter((_, i) => i !== index) });

  const outcomeTierRows = (): OutcomeTierRow[] => {
    const raw = state.socialBlock?.outcomeTiers;
    if (isOutcomeTierRows(raw)) return raw;
    return OUTCOME_TIER_LABELS.map((tier) => ({ tier, consequence: '' }));
  };
  const updateOutcomeTier = (index: number, consequence: string) => {
    const rows = outcomeTierRows();
    rows[index] = { ...rows[index], consequence };
    updateSocialBlock({ outcomeTiers: rows });
  };

  const toggleSocialClock = (enabled: boolean) =>
    updateSocialBlock({ socialClock: enabled ? { successesNeeded: 3, failuresAllowed: 3 } : null });
  const updateSocialClock = (changes: Partial<{ successesNeeded: number; failuresAllowed: number }>) => {
    if (!state.socialBlock?.socialClock) return;
    updateSocialBlock({ socialClock: { ...state.socialBlock.socialClock, ...changes } });
  };

  const addGatedInfo = () =>
    updateSocialBlock({ gatedInfo: [...(state.socialBlock?.gatedInfo ?? []), { fact: '', revealWhen: '' }] });
  const updateGatedInfo = (index: number, changes: Partial<{ fact: string; revealWhen: string }>) =>
    updateSocialBlock({
      gatedInfo: (state.socialBlock?.gatedInfo ?? []).map((g, i) => (i === index ? { ...g, ...changes } : g)),
    });
  const removeGatedInfo = (index: number) =>
    updateSocialBlock({ gatedInfo: (state.socialBlock?.gatedInfo ?? []).filter((_, i) => i !== index) });

  // ---- exploration block helpers ----
  const setExplorationBlock = (block: EncounterExplorationBlock | null) => set('explorationBlock', block);
  const updateExplorationBlock = (changes: Partial<EncounterExplorationBlock>) => {
    if (!state.explorationBlock) return;
    setExplorationBlock({ ...state.explorationBlock, ...changes });
  };
  const ensureTrap = () => state.explorationBlock?.trap ?? { name: '', trigger: '', detectDc: null, disableDc: null, effect: '', damageFormula: '', damageType: null, conditionIds: [] };
  const ensureHazard = () => state.explorationBlock?.hazard ?? { name: '', saveAbility: null, saveDc: null, effect: '', damageFormula: '', damageType: null, conditionIds: [] };
  const ensureSkillChallenge = () => state.explorationBlock?.skillChallenge ?? { goal: '', successesRequired: 3, failuresAllowed: 3, skills: [] };
  const ensurePuzzle = () => state.explorationBlock?.puzzle ?? { premise: '', solution: '', hints: [] };
  const ensureNavigation = () => state.explorationBlock?.navigation ?? { skill: null, dc: null, success: '', failure: '' };
  const rollWanderingTable = async () => {
    const tableId = state.explorationBlock?.wanderingTableId;
    if (!tableId) return;
    const result = await randomTablesApi.rollRandomTable(tableId, {});
    setWanderingRollText(result.items.map((item) => item.ref_hydrated?.name ?? item.resolved_text ?? item.text ?? 'No result').join(' · '));
  };
  const addSensoryClue = () =>
    updateExplorationBlock({ sensoryClues: [...(state.explorationBlock?.sensoryClues ?? []), { sense: 'sight', detail: '', perceiveDc: null }] });
  const updateSensoryClue = (index: number, changes: Partial<{ sense: string; detail: string; perceiveDc: number | null }>) =>
    updateExplorationBlock({
      sensoryClues: (state.explorationBlock?.sensoryClues ?? []).map((s, i) => (i === index ? { ...s, ...changes } : s)),
    });
  const removeSensoryClue = (index: number) =>
    updateExplorationBlock({ sensoryClues: (state.explorationBlock?.sensoryClues ?? []).filter((_, i) => i !== index) });

  const addPoi = () =>
    updateExplorationBlock({
      pointsOfInterest: [...(state.explorationBlock?.pointsOfInterest ?? []), { name: '', hidden: false, revealWhen: '', rewardOrInfo: '' }],
    });
  const updatePoi = (index: number, changes: Partial<{ name: string; hidden?: boolean; revealWhen?: string; rewardOrInfo?: string }>) =>
    updateExplorationBlock({
      pointsOfInterest: (state.explorationBlock?.pointsOfInterest ?? []).map((p, i) => (i === index ? { ...p, ...changes } : p)),
    });
  const removePoi = (index: number) =>
    updateExplorationBlock({ pointsOfInterest: (state.explorationBlock?.pointsOfInterest ?? []).filter((_, i) => i !== index) });

  const isValid = state.name.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const now = Date.now();
    const parsedPage = parseInt(state.page, 10);
    const encounter: Encounter = {
      id: initialEncounter?.id ?? crypto.randomUUID(),
      name: state.name.trim(),
      description: state.description.trim(),
      challengeRating: state.challengeRating.trim(),
      computedXp: state.computedXp,
      difficulty: state.difficulty,
      theme: state.theme.trim(),
      encounterType: state.encounterType.trim() || undefined,
      possibleLocations: state.possibleLocations.length > 0 ? state.possibleLocations : undefined,
      tags: state.tags,
      resolutionType: state.resolutionType,
      sourceId: initialEncounter?.sourceId,
      page: Number.isFinite(parsedPage) ? parsedPage : undefined,
      tables: state.resolutionType === 'random_table' ? state.tables : undefined,
      creatures: state.resolutionType === 'fixed' ? state.creatures : [],
      createdAt: initialEncounter?.createdAt ?? now,
      updatedAt: now,
      primaryType: state.primaryType,
      categoryId: state.categoryId,
      status: state.status,
      readAloud: state.readAloud.trim() || null,
      objective: state.objective.trim() || null,
      partyLevelMin: parseOptionalInt(state.partyLevelMin),
      partyLevelMax: parseOptionalInt(state.partyLevelMax),
      partySize: parseOptionalInt(state.partySize),
      scalingNotes: state.scalingNotes.trim() || null,
      locationId: state.locationId,
      generatorId: state.generatorId,
      rewards: state.rewards,
      tagIds: state.tagIds,
      npcs: state.npcs,
      combatBlock: state.primaryType === 'combat' ? state.combatBlock : null,
      socialBlock: state.primaryType === 'social' ? state.socialBlock : null,
      explorationBlock: state.primaryType === 'exploration' ? state.explorationBlock : null,
    };
    onSubmit(encounter);
  };

  // ---- random-table editing helpers ----
  const setTables = (tables: EncounterRollTable[]) => set('tables', tables);
  const addTable = () => setTables([...state.tables, emptyRollTable()]);
  const removeTable = (index: number) => setTables(state.tables.filter((_, i) => i !== index));
  const updateTable = (index: number, changes: Partial<EncounterRollTable>) =>
    setTables(state.tables.map((t, i) => (i === index ? { ...t, ...changes } : t)));

  const addRow = (tableIndex: number) =>
    updateTable(tableIndex, { table: [...state.tables[tableIndex].table, emptyTableRow()] });
  const removeRow = (tableIndex: number, rowIndex: number) =>
    updateTable(tableIndex, { table: state.tables[tableIndex].table.filter((_, i) => i !== rowIndex) });
  const updateRow = (tableIndex: number, rowIndex: number, changes: Partial<EncounterTableRow>) =>
    updateTable(tableIndex, {
      table: state.tables[tableIndex].table.map((r, i) => (i === rowIndex ? { ...r, ...changes } : r)),
    });

  const addRowCreature = (tableIndex: number, rowIndex: number) => {
    const row = state.tables[tableIndex].table[rowIndex];
    updateRow(tableIndex, rowIndex, { creatures: [...row.creatures, emptyTableCreature()] });
  };
  const removeRowCreature = (tableIndex: number, rowIndex: number, creatureIndex: number) => {
    const row = state.tables[tableIndex].table[rowIndex];
    updateRow(tableIndex, rowIndex, { creatures: row.creatures.filter((_, i) => i !== creatureIndex) });
  };
  const updateRowCreature = (
    tableIndex: number,
    rowIndex: number,
    creatureIndex: number,
    changes: Partial<EncounterTableCreature>,
  ) => {
    const row = state.tables[tableIndex].table[rowIndex];
    updateRow(tableIndex, rowIndex, {
      creatures: row.creatures.map((c, i) => (i === creatureIndex ? { ...c, ...changes } : c)),
    });
  };
  /** Single "count" text field per creature: a bare number -> countFixed, anything with a "d" in
   * it -> countDice (e.g. "2d4"). Mirrors how the importer parses 5etools text into the same
   * two fields, so DM-authored tables roll exactly the same way as imported ones. */
  const parseCountInput = (value: string): Pick<EncounterTableCreature, 'countDice' | 'countFixed'> => {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return { countFixed: parseInt(trimmed, 10), countDice: null };
    if (/d/i.test(trimmed) && trimmed) return { countDice: trimmed, countFixed: null };
    return { countFixed: 1, countDice: null };
  };
  const countInputValue = (c: EncounterTableCreature): string => c.countDice ?? String(c.countFixed ?? 1);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEditMode ? 'Edit Encounter' : 'Add Encounter'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField label="Name" value={state.name} onChange={(e) => set('name', e.target.value)} required fullWidth autoFocus />

          <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Primary type
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={state.primaryType}
                onChange={(_e, value: EncounterPrimaryType | null) => selectPrimaryType(value)}
              >
                {PRIMARY_TYPES.map((t) => (
                  <ToggleButton key={t} value={t}>{humanize(t)}</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Status
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={state.status}
                onChange={(_e, value: EncounterStatus | null) => value && set('status', value)}
              >
                {STATUSES.map((s) => (
                  <ToggleButton key={s} value={s}>{humanize(s)}</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </Stack>

          <TextField
            label="Description (DM notes)"
            value={state.description}
            onChange={(e) => set('description', e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
          />

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', borderLeft: 4, borderLeftColor: 'primary.main' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Read-aloud text (player-facing)
            </Typography>
            <TextField
              value={state.readAloud}
              onChange={(e) => set('readAloud', e.target.value)}
              multiline
              minRows={2}
              maxRows={6}
              fullWidth
              placeholder="The door creaks open, revealing…"
              variant="standard"
              slotProps={{ input: { disableUnderline: true, sx: { fontStyle: 'italic' } } }}
            />
          </Paper>

          <TextField
            label="Objective"
            value={state.objective}
            onChange={(e) => set('objective', e.target.value)}
            fullWidth
            placeholder="What resolves this encounter?"
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label="Challenge Rating"
              value={state.challengeRating}
              onChange={(e) => set('challengeRating', e.target.value)}
              fullWidth
              placeholder="Medium (party level 3-4)"
            />
            <Autocomplete
              freeSolo
              options={ENCOUNTER_THEME_PRESETS}
              value={state.theme}
              onChange={(_e, value) => set('theme', value ?? '')}
              onInputChange={(_e, value) => set('theme', value)}
              renderInput={(params) => <TextField {...params} label="Theme" placeholder="Palace, Dark Horror, Heroic…" />}
              sx={{ flex: 1 }}
            />
          </Stack>

          {state.creatures.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <CalculateIcon fontSize="small" color="action" />
                <Typography variant="body2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                  Encounter difficulty calculator
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Total XP: <strong>{suggestion.totalXP.toLocaleString()}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Adjusted XP (×{suggestion.multiplier}): <strong>{suggestion.adjustedXP.toLocaleString()}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Suggested CR: <strong>{suggestion.cr}</strong>
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="body2">
                  Suggested difficulty: <strong>{suggestion.label}</strong>
                </Typography>
                <Button size="small" onClick={applySuggestion}>
                  Use this
                </Button>
              </Stack>
            </Paper>
          )}

          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              type="number"
              label="Party level min"
              value={state.partyLevelMin}
              onChange={(e) => set('partyLevelMin', e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              type="number"
              label="Party level max"
              value={state.partyLevelMax}
              onChange={(e) => set('partyLevelMax', e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              type="number"
              label="Party size"
              value={state.partySize}
              onChange={(e) => set('partySize', e.target.value)}
              fullWidth
            />
          </Stack>

          <TextField
            label="Scaling notes (general)"
            value={state.scalingNotes}
            onChange={(e) => set('scalingNotes', e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Category
            </Typography>
            <Paper variant="outlined" sx={{ p: 1, borderRadius: 2, maxHeight: 220, overflowY: 'auto' }}>
              <CategoryTreeBrowser selectedId={state.categoryId} onSelect={(id) => set('categoryId', id)} />
            </Paper>
          </Box>

          <TagPicker selectedTagIds={state.tagIds} onChange={(tagIds) => set('tagIds', tagIds)} label="Tags" />

          <Autocomplete<string, true, false, true>
            multiple
            freeSolo
            options={[]}
            value={state.tags}
            onChange={(_e, value) => set('tags', value as string[])}
            renderValue={(value, getItemProps) =>
              value.map((tag, index) => <Chip label={tag} size="small" {...getItemProps({ index })} key={tag} />)
            }
            renderInput={(params) => (
              <TextField {...params} label="Other features / freeform tags" placeholder="Type and press Enter" />
            )}
          />

          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Rewards</Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => set('rewards', [...state.rewards, { kind: 'other', itemId: null, description: '', quantity: 1, sortOrder: state.rewards.length }])}
              >
                Add reward
              </Button>
            </Stack>
            <Stack spacing={1}>
              {state.rewards.map((reward, index) => {
                const updateReward = (patch: Partial<EncounterReward>) =>
                  set('rewards', state.rewards.map((value, i) => (i === index ? { ...value, ...patch } : value)));
                return (
                  <Stack key={index} direction="row" spacing={1}>
                    <EnumSelect
                      label="Type"
                      value={reward.kind}
                      options={['currency', 'item', 'information', 'favor', 'experience', 'other']}
                      // Switching away from 'item' drops the FK rather than leaving a stale one
                      // hanging off a reward that no longer means an item.
                      onChange={(kind) => updateReward({ kind: kind ?? 'other', itemId: kind === 'item' ? reward.itemId : null })}
                    />
                    {reward.kind === 'item' ? (
                      // Task 11.1: the magic item is REFERENCED, not restated. The free-text
                      // box beside it is for what the item row can't carry ("still wrapped in
                      // oilcloth"), not for the item's name.
                      <Autocomplete
                        size="small"
                        options={magicItems}
                        getOptionLabel={(value) => value.name}
                        value={magicItems.find((value) => value.id === reward.itemId) ?? null}
                        onChange={(_e, value) => updateReward({ itemId: value?.id ?? null })}
                        sx={{ flex: 1.4 }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Magic item"
                            helperText={reward.itemId ? undefined : 'Link the compendium item so stat changes follow'}
                          />
                        )}
                      />
                    ) : null}
                    <TextField
                      size="small"
                      label={reward.kind === 'item' ? 'Notes' : 'Description'}
                      value={reward.description}
                      onChange={(e) => updateReward({ description: e.target.value })}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Quantity"
                      value={reward.quantity}
                      onChange={(e) => updateReward({ quantity: Math.max(1, Number(e.target.value) || 1) })}
                      sx={{ width: 100 }}
                    />
                    <IconButton onClick={() => set('rewards', state.rewards.filter((_, i) => i !== index))}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Stack>
                );
              })}
            </Stack>
          </Box>

          <Box>
            <Button size="small" startIcon={<TuneIcon />} onClick={() => setMoreOpen((v) => !v)}>
              {moreOpen ? 'Hide more options' : 'More options'}
            </Button>
            <Collapse in={moreOpen}>
              <Stack spacing={2} sx={{ pt: 2 }}>
                <Autocomplete
                  freeSolo
                  options={ENCOUNTER_TYPE_PRESETS}
                  value={state.encounterType}
                  onChange={(_e, value) => set('encounterType', value ?? '')}
                  onInputChange={(_e, value) => set('encounterType', value)}
                  renderInput={(params) => (
                    <TextField {...params} label="Type of encounter" placeholder="Tavern Fight, Forest Ambush, Puzzle, Heist…" />
                  )}
                />
                <Autocomplete<string, true, false, true>
                  multiple
                  freeSolo
                  options={ENCOUNTER_LOCATION_PRESETS}
                  value={state.possibleLocations}
                  onChange={(_e, value) => set('possibleLocations', value as string[])}
                  renderValue={(value, getItemProps) =>
                    value.map((loc, index) => <Chip label={loc} size="small" {...getItemProps({ index })} key={loc} />)
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Possible locations" placeholder="Forest, Cave, Fort…" />
                  )}
                />
              </Stack>
            </Collapse>
          </Box>
        </Stack>

        {state.primaryType === 'combat' && (
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Roster type
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={state.resolutionType}
              onChange={(_e, value: EncounterResolutionType | null) => value && set('resolutionType', value)}
            >
              <ToggleButton value="fixed">Fixed roster</ToggleButton>
              <ToggleButton value="random_table">Random table</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {state.resolutionType === 'fixed' && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Creatures
              </Typography>

              <Autocomplete
                options={creatures}
                getOptionLabel={(c) => c.name}
                value={null}
                onChange={(_e, value) => value && addCreature(value)}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      {option.tokenImage ? (
                        <Avatar src={option.tokenImage} sx={{ width: 24, height: 24 }} />
                      ) : (
                        <Avatar sx={{ width: 24, height: 24 }}>{option.name.charAt(0)}</Avatar>
                      )}
                      <Typography variant="body2">{option.name}</Typography>
                    </Stack>
                  </li>
                )}
                renderInput={(params) => <TextField {...params} label="Search creatures to add…" placeholder="Goblin, Hobgoblin…" />}
              />

              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  fullWidth
                  label="Add custom creature"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomCreature();
                    }
                  }}
                />
                <Tooltip title="Add custom creature">
                  <IconButton onClick={addCustomCreature} disabled={!customName.trim()}>
                    <AddIcon />
                  </IconButton>
                </Tooltip>
              </Stack>

              {state.creatures.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                  No creatures added yet.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {state.creatures.map((entry) => (
                    <Paper key={entry.id} variant="outlined" sx={{ p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        {entry.imageSrc ? (
                          <Avatar src={entry.imageSrc} sx={{ width: 32, height: 32 }} />
                        ) : (
                          <Avatar sx={{ width: 32, height: 32 }}>{entry.name.charAt(0)}</Avatar>
                        )}
                        <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                          {entry.name}
                          {entry.creatureId === null && (
                            <Typography component="span" variant="caption" color="text.secondary">
                              {' '}
                              (custom)
                            </Typography>
                          )}
                        </Typography>
                        <IconButton size="small" onClick={() => updateQuantity(entry.id, -1)}>
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                        <Box sx={{ minWidth: 24, textAlign: 'center' }}>
                          <Typography variant="body2">{entry.quantity}</Typography>
                        </Box>
                        <IconButton size="small" onClick={() => updateQuantity(entry.id, 1)}>
                          <AddIcon fontSize="small" />
                        </IconButton>
                        <Tooltip title="Remove">
                          <IconButton size="small" onClick={() => removeEntry(entry.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <FormControl size="small" sx={{ minWidth: 170 }}>
                          <InputLabel>Combat role</InputLabel>
                          <Select
                            label="Combat role"
                            value={entry.role ?? ''}
                            onChange={(e) =>
                              updateCreatureEntry(entry.id, { role: (e.target.value || null) as CombatRole | null })
                            }
                          >
                            <MenuItem value=""><em>—</em></MenuItem>
                            {COMBAT_ROLES.map((r) => (
                              <MenuItem key={r} value={r}>{humanize(r)}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          size="small"
                          label="Notes"
                          value={entry.notes ?? ''}
                          onChange={(e) => updateCreatureEntry(entry.id, { notes: e.target.value || null })}
                          fullWidth
                        />
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </>
          )}

          {state.resolutionType === 'random_table' && (
            <>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                  Roll tables
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  label="Page"
                  value={state.page}
                  onChange={(e) => set('page', e.target.value)}
                  sx={{ width: 90 }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Each table is rolled with its own die to pick a result row; if a row names
                creatures with a dice count (e.g. "2d4"), that's rolled separately once the row
                is selected. See the map toolbar's Encounters tab to roll one of these live.
              </Typography>

              {state.tables.map((table, tableIndex) => (
                <Paper key={tableIndex} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
                    <TextField
                      size="small"
                      label="Dice expression"
                      value={table.diceExpression}
                      onChange={(e) => updateTable(tableIndex, { diceExpression: e.target.value })}
                      placeholder="1d10, d100, d12 + d8…"
                      sx={{ width: 160 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Min level"
                      value={table.minlvl ?? ''}
                      onChange={(e) => updateTable(tableIndex, { minlvl: e.target.value ? Number(e.target.value) : null })}
                      sx={{ width: 100 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Max level"
                      value={table.maxlvl ?? ''}
                      onChange={(e) => updateTable(tableIndex, { maxlvl: e.target.value ? Number(e.target.value) : null })}
                      sx={{ width: 100 }}
                    />
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title="Remove table">
                      <IconButton size="small" onClick={() => removeTable(tableIndex)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <Stack spacing={1.5}>
                    {table.table.map((row, rowIndex) => (
                      <Paper key={rowIndex} variant="outlined" sx={{ p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                          <TextField
                            size="small"
                            type="number"
                            label="Min"
                            value={row.min}
                            onChange={(e) => updateRow(tableIndex, rowIndex, { min: Number(e.target.value) })}
                            sx={{ width: 80 }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label="Max"
                            value={row.max}
                            onChange={(e) => updateRow(tableIndex, rowIndex, { max: Number(e.target.value) })}
                            sx={{ width: 80 }}
                          />
                          <TextField
                            size="small"
                            fullWidth
                            label="Result"
                            value={row.resultText}
                            onChange={(e) =>
                              updateRow(tableIndex, rowIndex, { resultText: e.target.value, result: e.target.value })
                            }
                            placeholder="2d4 Pirates and one Pirate Captain aboard a longship…"
                          />
                          <Tooltip title="Remove row">
                            <IconButton size="small" onClick={() => removeRow(tableIndex, rowIndex)}>
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>

                        <Stack spacing={0.75} sx={{ pl: 1 }}>
                          {row.creatures.map((c, creatureIndex) => (
                            <Stack key={creatureIndex} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <CasinoIcon fontSize="small" color="action" />
                              <TextField
                                size="small"
                                variant="standard"
                                label="Creature"
                                value={c.name}
                                onChange={(e) =>
                                  updateRowCreature(tableIndex, rowIndex, creatureIndex, { name: e.target.value })
                                }
                                sx={{ flexGrow: 1 }}
                              />
                              <TextField
                                size="small"
                                variant="standard"
                                label="Count"
                                value={countInputValue(c)}
                                onChange={(e) =>
                                  updateRowCreature(tableIndex, rowIndex, creatureIndex, parseCountInput(e.target.value))
                                }
                                placeholder="2d4 or 1"
                                sx={{ width: 90 }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => removeRowCreature(tableIndex, rowIndex, creatureIndex)}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          ))}
                          <Button size="small" startIcon={<AddIcon />} onClick={() => addRowCreature(tableIndex, rowIndex)} sx={{ alignSelf: 'flex-start' }}>
                            Add creature to this row
                          </Button>
                        </Stack>
                      </Paper>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={() => addRow(tableIndex)}>
                      Add row
                    </Button>
                  </Stack>
                </Paper>
              ))}
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addTable}>
                Add table
              </Button>
            </>
          )}

          <Divider />

          <Typography variant="h6" sx={{ fontWeight: 800 }}>Combat details</Typography>

          <Collapse in={!!state.combatBlock}>
            {state.combatBlock && (
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <EnumSelect label="Shape" value={state.combatBlock.shape} options={COMBAT_SHAPES} onChange={(v) => updateCombatBlock({ shape: v })} />
                  <EnumSelect label="Victory condition" value={state.combatBlock.victoryCondition} options={VICTORY_CONDITIONS} onChange={(v) => updateCombatBlock({ victoryCondition: v })} />
                  <EnumSelect label="Awareness" value={state.combatBlock.awareness} options={AWARENESS_OPTIONS} onChange={(v) => updateCombatBlock({ awareness: v })} />
                </Stack>
                <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <EnumSelect label="Start range" value={state.combatBlock.startRange} options={START_RANGES} onChange={(v) => updateCombatBlock({ startRange: v })} />
                  <EnumSelect label="Lighting" value={state.combatBlock.lighting} options={LIGHTING_OPTIONS} onChange={(v) => updateCombatBlock({ lighting: v })} />
                  <EnumSelect label="Terrain type" value={state.combatBlock.terrainType} options={TERRAIN_TYPES} onChange={(v) => updateCombatBlock({ terrainType: v })} />
                </Stack>

                <MultiChipToggle label="Terrain features" value={state.combatBlock.terrainFeatures} options={TERRAIN_FEATURES} onChange={(v) => updateCombatBlock({ terrainFeatures: v })} />

                <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <EnumSelect label="Morale" value={state.combatBlock.morale} options={MORALE_OPTIONS} onChange={(v) => updateCombatBlock({ morale: v })} />
                  <EnumSelect
                    label="Difficulty band (2024: low/moderate/high, 2014: easy/medium/hard/deadly)"
                    value={state.combatBlock.difficultyBand}
                    options={DIFFICULTY_BANDS}
                    onChange={(v) => updateCombatBlock({ difficultyBand: v })}
                    sx={{ minWidth: 320 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Computed XP"
                    value={state.combatBlock.computedXp ?? ''}
                    onChange={(e) => updateCombatBlock({ computedXp: e.target.value ? Number(e.target.value) : null })}
                    sx={{ minWidth: 140 }}
                  />
                </Stack>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography variant="subtitle2" sx={{ mb: 1 }}>Reinforcements</Typography><Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <EnumSelect label="Mode" value={state.combatBlock.reinforcements?.mode ?? null} options={['none', 'fixed_wave', 'triggered', 'escalating']} onChange={(mode) => updateCombatBlock({ reinforcements: mode ? { mode, trigger: state.combatBlock?.reinforcements?.trigger ?? '', round: state.combatBlock?.reinforcements?.round ?? null, tableId: state.combatBlock?.reinforcements?.tableId ?? null } : null })} />
                  <TextField size="small" type="number" label="Round" value={state.combatBlock.reinforcements?.round ?? ''} onChange={(e) => updateCombatBlock({ reinforcements: { mode: state.combatBlock?.reinforcements?.mode ?? 'fixed_wave', trigger: state.combatBlock?.reinforcements?.trigger ?? '', round: parseOptionalInt(e.target.value), tableId: state.combatBlock?.reinforcements?.tableId ?? null } })} sx={{ width: 100 }} />
                  <TextField size="small" label="Trigger" value={state.combatBlock.reinforcements?.trigger ?? ''} onChange={(e) => updateCombatBlock({ reinforcements: { mode: state.combatBlock?.reinforcements?.mode ?? 'triggered', trigger: e.target.value, round: state.combatBlock?.reinforcements?.round ?? null, tableId: state.combatBlock?.reinforcements?.tableId ?? null } })} sx={{ flex: 1 }} />
                  <Autocomplete options={randomTableOptions} getOptionLabel={(table) => table.name} value={randomTableOptions.find((table) => table.id === state.combatBlock?.reinforcements?.tableId) ?? null} onChange={(_e, value) => updateCombatBlock({ reinforcements: { mode: state.combatBlock?.reinforcements?.mode ?? 'triggered', trigger: state.combatBlock?.reinforcements?.trigger ?? '', round: state.combatBlock?.reinforcements?.round ?? null, tableId: value?.id ?? null } })} renderInput={(params) => <TextField {...params} size="small" label="Reinforcement table" />} sx={{ flex: 1 }} />
                </Stack></Paper>

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Dynamic events
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Triggers that change the fight mid-combat - the highest-value field here.
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {state.combatBlock.dynamicEvents.map((d, i) => (
                      <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <TextField
                          size="small"
                          label="Trigger"
                          value={d.trigger}
                          onChange={(e) => updateDynamicEvent(i, { trigger: e.target.value })}
                          placeholder="round 3, hostage timer expires…"
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          size="small"
                          label="Event"
                          value={d.event}
                          onChange={(e) => updateDynamicEvent(i, { event: e.target.value })}
                          placeholder="the bridge collapses…"
                          sx={{ flex: 1 }}
                        />
                        <IconButton size="small" onClick={() => removeDynamicEvent(i)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={addDynamicEvent}>
                      Add dynamic event
                    </Button>
                  </Stack>
                </Box>

                <MultiChipToggle label="Aftermath" value={state.combatBlock.aftermath} options={AFTERMATH_OPTIONS} onChange={(v) => updateCombatBlock({ aftermath: v })} />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={state.combatBlock.hasLairOrLegendary}
                      onChange={(e) => updateCombatBlock({ hasLairOrLegendary: e.target.checked })}
                    />
                  }
                  label="Has lair or legendary actions"
                />

                <TextField
                  label="Scaling notes (combat)"
                  value={state.combatBlock.scalingNotes ?? ''}
                  onChange={(e) => updateCombatBlock({ scalingNotes: e.target.value || null })}
                  multiline
                  minRows={2}
                  fullWidth
                />

                <Autocomplete
                  options={maps}
                  getOptionLabel={(m) => m.name}
                  value={maps.find((m) => m.id === state.combatBlock?.mapId) ?? null}
                  onChange={(_e, value) => updateCombatBlock({ mapId: value?.id ?? null })}
                  renderInput={(params) => <TextField {...params} label="Map" placeholder="Link a map…" />}
                />
                <Autocomplete
                  options={encounterOptions}
                  getOptionLabel={(encounter) => encounter.name}
                  value={encounterOptions.find((encounter) => encounter.id === state.combatBlock?.transitionEncounterId) ?? null}
                  onChange={(_e, value) => updateCombatBlock({ transitionEncounterId: value?.id ?? null })}
                  renderInput={(params) => <TextField {...params} label="Next encounter" helperText="Optional real transition after this combat resolves." />}
                />
              </Stack>
            )}
          </Collapse>
        </Stack>
        )}

        {state.primaryType === 'social' && (
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            NPC roster
          </Typography>

          <Autocomplete
            options={npcCreatures}
            getOptionLabel={(c) => c.name}
            value={null}
            onChange={(_e, value) => value && addNpc(value)}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  {option.tokenImage ? (
                    <Avatar src={option.tokenImage} sx={{ width: 24, height: 24 }} />
                  ) : (
                    <Avatar sx={{ width: 24, height: 24 }}>{option.name.charAt(0)}</Avatar>
                  )}
                  <Typography variant="body2">{option.name}</Typography>
                </Stack>
              </li>
            )}
            renderInput={(params) => <TextField {...params} label="Search NPCs to add…" placeholder="Search the NPC library…" />}
          />

          {state.npcs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
              No NPCs added yet.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {state.npcs.map((npc) => (
                <Paper key={npc.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.25 }}>
                    {npc.imageSrc ? (
                      <Avatar src={npc.imageSrc} sx={{ width: 32, height: 32 }} />
                    ) : (
                      <Avatar sx={{ width: 32, height: 32 }}>{npc.name.charAt(0)}</Avatar>
                    )}
                    <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }} noWrap>
                      {npc.name}
                    </Typography>
                    <Tooltip title="Remove">
                      <IconButton size="small" onClick={() => removeNpc(npc.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Stack spacing={1.25}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Attitude
                      </Typography>
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        fullWidth
                        value={npc.attitude}
                        onChange={(_e, v: NpcAttitude | null) => updateNpc(npc.id, { attitude: v })}
                      >
                        {NPC_ATTITUDES.map((a) => (
                          <ToggleButton key={a} value={a}>{humanize(a)}</ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                    </Box>
                    <EnumSelect
                      label="Agenda"
                      value={npc.agenda}
                      options={NPC_AGENDAS}
                      onChange={(v) => updateNpc(npc.id, { agenda: v as NpcAgenda | null })}
                    />
                    <TextField
                      size="small"
                      label="Secret"
                      value={npc.secret ?? ''}
                      onChange={(e) => updateNpc(npc.id, { secret: e.target.value || null })}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="Leverage"
                      value={npc.leverage ?? ''}
                      onChange={(e) => updateNpc(npc.id, { leverage: e.target.value || null })}
                      fullWidth
                    />
                    <Typography variant="caption" color="text.secondary">
                      RP cues
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <TextField size="small" label="Voice" value={npc.rpCues?.voice ?? ''} onChange={(e) => updateNpcRpCue(npc.id, 'voice', e.target.value)} sx={{ minWidth: 140, flex: 1 }} />
                      <TextField size="small" label="Mannerism" value={npc.rpCues?.mannerism ?? ''} onChange={(e) => updateNpcRpCue(npc.id, 'mannerism', e.target.value)} sx={{ minWidth: 140, flex: 1 }} />
                      <TextField size="small" label="Appearance tag" value={npc.rpCues?.appearanceTag ?? ''} onChange={(e) => updateNpcRpCue(npc.id, 'appearanceTag', e.target.value)} sx={{ minWidth: 140, flex: 1 }} />
                      <TextField size="small" label="Catchphrase" value={npc.rpCues?.catchphrase ?? ''} onChange={(e) => updateNpcRpCue(npc.id, 'catchphrase', e.target.value)} sx={{ minWidth: 140, flex: 1 }} />
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}

          <Divider />

          <Typography variant="h6" sx={{ fontWeight: 800 }}>Social details</Typography>

          <Collapse in={!!state.socialBlock}>
            {state.socialBlock && (
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <EnumSelect label="Shape" value={state.socialBlock.shape} options={SOCIAL_SHAPES} onChange={(v) => updateSocialBlock({ shape: v })} />
                  <EnumSelect label="Venue" value={state.socialBlock.venue} options={VENUES} onChange={(v) => updateSocialBlock({ venue: v })} />
                  <EnumSelect label="Tone" value={state.socialBlock.tone} options={TONES} onChange={(v) => updateSocialBlock({ tone: v })} />
                </Stack>
                <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <EnumSelect label="Stakes" value={state.socialBlock.stakes} options={STAKES_OPTIONS} onChange={(v) => updateSocialBlock({ stakes: v })} />
                  <EnumSelect label="Escalation" value={state.socialBlock.escalation} options={ESCALATION_OPTIONS} onChange={(v) => updateSocialBlock({ escalation: v })} />
                </Stack>

                <MultiChipToggle label="Player levers" value={state.socialBlock.playerLevers} options={PLAYER_LEVERS} onChange={(v) => updateSocialBlock({ playerLevers: v })} />
                <MultiChipToggle label="Complications" value={state.socialBlock.complications} options={SOCIAL_COMPLICATIONS} onChange={(v) => updateSocialBlock({ complications: v })} />
                <Autocomplete
                  options={encounterOptions}
                  getOptionLabel={(encounter) => encounter.name}
                  value={encounterOptions.find((encounter) => encounter.id === state.socialBlock?.transitionEncounterId) ?? null}
                  onChange={(_e, value) => updateSocialBlock({ transitionEncounterId: value?.id ?? null })}
                  renderInput={(params) => <TextField {...params} label="Escalates / transitions to encounter" />}
                />

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Key checks
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {state.socialBlock.keyChecks.map((c, i) => (
                      <Paper key={i} variant="outlined" sx={{ p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                          <EnumSelect label="Skill" value={c.skill || null} options={SKILLS} onChange={(value) => updateKeyCheck(i, { skill: value ?? '' })} />
                          <TextField size="small" type="number" label="DC" value={c.dc} onChange={(e) => updateKeyCheck(i, { dc: Number(e.target.value) })} sx={{ width: 90 }} />
                          <IconButton size="small" onClick={() => removeKeyCheck(i)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                        <Stack direction="row" spacing={1}>
                          <TextField size="small" label="On success" value={c.onSuccess} onChange={(e) => updateKeyCheck(i, { onSuccess: e.target.value })} sx={{ flex: 1 }} />
                          <TextField size="small" label="On failure" value={c.onFailure} onChange={(e) => updateKeyCheck(i, { onFailure: e.target.value })} sx={{ flex: 1 }} />
                        </Stack>
                      </Paper>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={addKeyCheck}>
                      Add key check
                    </Button>
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Outcome tiers
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {outcomeTierRows().map((row, i) => (
                      <Stack key={row.tier} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ width: 150, fontWeight: 600, flexShrink: 0 }}>
                          {row.tier}
                        </Typography>
                        <TextField size="small" fullWidth value={row.consequence} onChange={(e) => updateOutcomeTier(i, e.target.value)} placeholder="Consequence…" />
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Box>
                  <FormControlLabel
                    control={<Switch checked={!!state.socialBlock.socialClock} onChange={(e) => toggleSocialClock(e.target.checked)} />}
                    label="Social clock"
                  />
                  {state.socialBlock.socialClock && (
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                      <TextField
                        size="small"
                        type="number"
                        label="Successes needed"
                        value={state.socialBlock.socialClock.successesNeeded}
                        onChange={(e) => updateSocialClock({ successesNeeded: Number(e.target.value) })}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Failures allowed"
                        value={state.socialBlock.socialClock.failuresAllowed}
                        onChange={(e) => updateSocialClock({ failuresAllowed: Number(e.target.value) })}
                      />
                    </Stack>
                  )}
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Gated info
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {state.socialBlock.gatedInfo.map((g, i) => (
                      <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <TextField size="small" label="Fact" value={g.fact} onChange={(e) => updateGatedInfo(i, { fact: e.target.value })} sx={{ flex: 1 }} />
                        <TextField size="small" label="Reveal when" value={g.revealWhen} onChange={(e) => updateGatedInfo(i, { revealWhen: e.target.value })} sx={{ flex: 1 }} />
                        <IconButton size="small" onClick={() => removeGatedInfo(i)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={addGatedInfo}>
                      Add gated info
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            )}
          </Collapse>
        </Stack>
        )}

        {state.primaryType === 'exploration' && (
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Exploration details</Typography>

          <Collapse in={!!state.explorationBlock}>
            {state.explorationBlock && (
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <EnumSelect label="Shape" value={state.explorationBlock.shape} options={EXPLORATION_SHAPES} onChange={(v) => updateExplorationBlock({ shape: v })} />
                  <EnumSelect label="Environment" value={state.explorationBlock.environment} options={ENVIRONMENTS} onChange={(v) => updateExplorationBlock({ environment: v })} />
                </Stack>
                <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <EnumSelect label="Terrain difficulty" value={state.explorationBlock.terrainDifficulty} options={TERRAIN_DIFFICULTIES} onChange={(v) => updateExplorationBlock({ terrainDifficulty: v })} />
                  <EnumSelect label="Obstacle type" value={state.explorationBlock.obstacleType} options={OBSTACLE_TYPES} onChange={(v) => updateExplorationBlock({ obstacleType: v })} />
                </Stack>

                {state.explorationBlock.obstacleType === 'trap' && (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography variant="subtitle2" sx={{ mb: 1 }}>Trap details</Typography><Stack spacing={1.5}>
                    <Stack direction="row" spacing={1}><TextField size="small" label="Name" value={ensureTrap().name} onChange={(e) => updateExplorationBlock({ trap: { ...ensureTrap(), name: e.target.value } })} sx={{ flex: 1 }} /><TextField size="small" label="Trigger" value={ensureTrap().trigger} onChange={(e) => updateExplorationBlock({ trap: { ...ensureTrap(), trigger: e.target.value } })} sx={{ flex: 1 }} /></Stack>
                    <Stack direction="row" spacing={1}><TextField size="small" type="number" label="Detect DC" value={ensureTrap().detectDc ?? ''} onChange={(e) => updateExplorationBlock({ trap: { ...ensureTrap(), detectDc: parseOptionalInt(e.target.value) } })} /><TextField size="small" type="number" label="Disable DC" value={ensureTrap().disableDc ?? ''} onChange={(e) => updateExplorationBlock({ trap: { ...ensureTrap(), disableDc: parseOptionalInt(e.target.value) } })} /><TextField size="small" label="Damage" placeholder="2d10" value={ensureTrap().damageFormula} onChange={(e) => updateExplorationBlock({ trap: { ...ensureTrap(), damageFormula: e.target.value } })} /><EnumSelect label="Damage type" value={ensureTrap().damageType} options={DAMAGE_TYPES} onChange={(value) => updateExplorationBlock({ trap: { ...ensureTrap(), damageType: value } })} /></Stack>
                    <TextField size="small" label="Effect" value={ensureTrap().effect} onChange={(e) => updateExplorationBlock({ trap: { ...ensureTrap(), effect: e.target.value } })} fullWidth multiline />
                    <Autocomplete multiple options={conditionOptions} getOptionLabel={(condition) => condition.name} value={conditionOptions.filter((condition) => ensureTrap().conditionIds.includes(condition.id))} onChange={(_e, value) => updateExplorationBlock({ trap: { ...ensureTrap(), conditionIds: value.map((condition) => condition.id) } })} renderInput={(params) => <TextField {...params} size="small" label="Applied conditions" />} />
                  </Stack></Paper>
                )}
                {state.explorationBlock.obstacleType === 'environmental_hazard' && (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography variant="subtitle2" sx={{ mb: 1 }}>Hazard details</Typography><Stack spacing={1.5}>
                    <Stack direction="row" spacing={1}><TextField size="small" label="Name" value={ensureHazard().name} onChange={(e) => updateExplorationBlock({ hazard: { ...ensureHazard(), name: e.target.value } })} sx={{ flex: 1 }} /><EnumSelect label="Save ability" value={ensureHazard().saveAbility} options={ABILITIES} onChange={(value) => updateExplorationBlock({ hazard: { ...ensureHazard(), saveAbility: value } })} /><TextField size="small" type="number" label="Save DC" value={ensureHazard().saveDc ?? ''} onChange={(e) => updateExplorationBlock({ hazard: { ...ensureHazard(), saveDc: parseOptionalInt(e.target.value) } })} /></Stack>
                    <Stack direction="row" spacing={1}><TextField size="small" label="Damage" placeholder="4d6" value={ensureHazard().damageFormula} onChange={(e) => updateExplorationBlock({ hazard: { ...ensureHazard(), damageFormula: e.target.value } })} /><EnumSelect label="Damage type" value={ensureHazard().damageType} options={DAMAGE_TYPES} onChange={(value) => updateExplorationBlock({ hazard: { ...ensureHazard(), damageType: value } })} /><TextField size="small" label="Effect" value={ensureHazard().effect} onChange={(e) => updateExplorationBlock({ hazard: { ...ensureHazard(), effect: e.target.value } })} sx={{ flex: 1 }} /></Stack>
                    <Autocomplete multiple options={conditionOptions} getOptionLabel={(condition) => condition.name} value={conditionOptions.filter((condition) => ensureHazard().conditionIds.includes(condition.id))} onChange={(_e, value) => updateExplorationBlock({ hazard: { ...ensureHazard(), conditionIds: value.map((condition) => condition.id) } })} renderInput={(params) => <TextField {...params} size="small" label="Applied conditions" />} />
                  </Stack></Paper>
                )}
                {state.explorationBlock.shape === 'skill_challenge' && (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography variant="subtitle2" sx={{ mb: 1 }}>Skill challenge</Typography><Stack spacing={1.5}>
                    <TextField size="small" label="Goal" value={ensureSkillChallenge().goal} onChange={(e) => updateExplorationBlock({ skillChallenge: { ...ensureSkillChallenge(), goal: e.target.value } })} />
                    <Stack direction="row" spacing={1}><TextField size="small" type="number" label="Successes required" value={ensureSkillChallenge().successesRequired} onChange={(e) => updateExplorationBlock({ skillChallenge: { ...ensureSkillChallenge(), successesRequired: Number(e.target.value) } })} /><TextField size="small" type="number" label="Failures allowed" value={ensureSkillChallenge().failuresAllowed} onChange={(e) => updateExplorationBlock({ skillChallenge: { ...ensureSkillChallenge(), failuresAllowed: Number(e.target.value) } })} /><Autocomplete multiple options={SKILLS} value={ensureSkillChallenge().skills} onChange={(_e, value) => updateExplorationBlock({ skillChallenge: { ...ensureSkillChallenge(), skills: value } })} renderInput={(params) => <TextField {...params} size="small" label="Allowed skills" />} sx={{ flex: 1 }} /></Stack>
                  </Stack></Paper>
                )}
                {(state.explorationBlock.obstacleType === 'puzzle_mechanism' || state.explorationBlock.shape === 'puzzle') && (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography variant="subtitle2" sx={{ mb: 1 }}>Puzzle details</Typography><Stack spacing={1}>
                    <TextField size="small" label="Premise" value={ensurePuzzle().premise} onChange={(e) => updateExplorationBlock({ puzzle: { ...ensurePuzzle(), premise: e.target.value } })} />
                    <TextField size="small" label="Solution" value={ensurePuzzle().solution} onChange={(e) => updateExplorationBlock({ puzzle: { ...ensurePuzzle(), solution: e.target.value } })} multiline />
                    <Autocomplete multiple freeSolo options={[]} value={ensurePuzzle().hints} onChange={(_e, value) => updateExplorationBlock({ puzzle: { ...ensurePuzzle(), hints: value } })} renderInput={(params) => <TextField {...params} size="small" label="Hints" helperText="Type a hint and press Enter" />} />
                  </Stack></Paper>
                )}

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Sensory clues
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {state.explorationBlock.sensoryClues.map((s, i) => (
                      <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <FormControl size="small" sx={{ width: 110 }}>
                          <InputLabel>Sense</InputLabel>
                          <Select label="Sense" value={s.sense} onChange={(e) => updateSensoryClue(i, { sense: e.target.value })}>
                            {SENSES.map((v) => (
                              <MenuItem key={v} value={v}>{humanize(v)}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField size="small" label="Detail" value={s.detail} onChange={(e) => updateSensoryClue(i, { detail: e.target.value })} sx={{ flex: 1 }} />
                        <TextField
                          size="small"
                          type="number"
                          label="Perceive DC"
                          value={s.perceiveDc ?? ''}
                          onChange={(e) => updateSensoryClue(i, { perceiveDc: e.target.value ? Number(e.target.value) : null })}
                          sx={{ width: 110 }}
                        />
                        <IconButton size="small" onClick={() => removeSensoryClue(i)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={addSensoryClue}>
                      Add sensory clue
                    </Button>
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Points of interest
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {state.explorationBlock.pointsOfInterest.map((p, i) => (
                      <Paper key={i} variant="outlined" sx={{ p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                          <TextField size="small" label="Name" value={p.name} onChange={(e) => updatePoi(i, { name: e.target.value })} sx={{ flex: 1 }} />
                          <FormControlLabel
                            control={<Checkbox size="small" checked={!!p.hidden} onChange={(e) => updatePoi(i, { hidden: e.target.checked })} />}
                            label="Hidden"
                          />
                          <IconButton size="small" onClick={() => removePoi(i)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                        <Stack direction="row" spacing={1}>
                          <TextField size="small" label="Reveal when" value={p.revealWhen ?? ''} onChange={(e) => updatePoi(i, { revealWhen: e.target.value })} sx={{ flex: 1 }} />
                          <TextField size="small" label="Reward / info" value={p.rewardOrInfo ?? ''} onChange={(e) => updatePoi(i, { rewardOrInfo: e.target.value })} sx={{ flex: 1 }} />
                        </Stack>
                      </Paper>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={addPoi}>
                      Add point of interest
                    </Button>
                  </Stack>
                </Box>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography variant="subtitle2" sx={{ mb: 1 }}>Navigation check</Typography><Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <EnumSelect label="Skill" value={ensureNavigation().skill} options={SKILLS} onChange={(value) => updateExplorationBlock({ navigation: { ...ensureNavigation(), skill: value } })} />
                  <TextField size="small" type="number" label="DC" value={ensureNavigation().dc ?? ''} onChange={(e) => updateExplorationBlock({ navigation: { ...ensureNavigation(), dc: parseOptionalInt(e.target.value) } })} sx={{ width: 100 }} />
                  <TextField size="small" label="On success" value={ensureNavigation().success} onChange={(e) => updateExplorationBlock({ navigation: { ...ensureNavigation(), success: e.target.value } })} sx={{ flex: 1 }} />
                  <TextField size="small" label="On failure" value={ensureNavigation().failure} onChange={(e) => updateExplorationBlock({ navigation: { ...ensureNavigation(), failure: e.target.value } })} sx={{ flex: 1 }} />
                </Stack></Paper>

                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <Autocomplete
                    options={randomTableOptions}
                    getOptionLabel={(table) => table.name}
                    value={randomTableOptions.find((table) => table.id === state.explorationBlock?.wanderingTableId) ?? null}
                    onChange={(_e, value) => { updateExplorationBlock({ wanderingTableId: value?.id ?? null }); setWanderingRollText(''); }}
                    renderInput={(params) => <TextField {...params} label="Wandering encounter table" helperText={wanderingRollText || 'Link and test-roll a table while running the exploration.'} />}
                    sx={{ flex: 1 }}
                  />
                  <Button variant="outlined" startIcon={<CasinoIcon />} disabled={!state.explorationBlock.wanderingTableId} onClick={() => void rollWanderingTable()}>Roll table</Button>
                </Stack>

                <Autocomplete
                  options={encounterOptions}
                  getOptionLabel={(encounter) => encounter.name}
                  value={encounterOptions.find((encounter) => encounter.id === state.explorationBlock?.transitionEncounterId) ?? null}
                  onChange={(_e, value) => updateExplorationBlock({ transitionEncounterId: value?.id ?? null })}
                  renderInput={(params) => <TextField {...params} label="Next encounter" />}
                />

                {/* Task 11.2: a wandering table covers one flat table; this covers a composite
                    generator, so an encounter can pull a whole generated result (an NPC, a
                    place) rather than a single rolled row. */}
                <Autocomplete
                  options={generatorOptions}
                  getOptionLabel={(generator) => generator.name}
                  value={generatorOptions.find((generator) => generator.id === state.generatorId) ?? null}
                  onChange={(_e, value) => set('generatorId', value?.id ?? null)}
                  renderInput={(params) => (
                    <TextField {...params} label="Generator" helperText="Roll a composite generator while running this encounter." />
                  )}
                />

                <MultiChipToggle label="Resource cost" value={state.explorationBlock.resourceCost} options={RESOURCE_COSTS} onChange={(v) => updateExplorationBlock({ resourceCost: v })} />

                <FormControlLabel
                  control={<Checkbox checked={state.explorationBlock.verticality} onChange={(e) => updateExplorationBlock({ verticality: e.target.checked })} />}
                  label="Verticality"
                />

                <MultiChipToggle label="Complications" value={state.explorationBlock.complications} options={EXPLORATION_COMPLICATIONS} onChange={(v) => updateExplorationBlock({ complications: v })} />
              </Stack>
            )}
          </Collapse>
        </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid}>
          {isEditMode ? 'Save Changes' : 'Add Encounter'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
