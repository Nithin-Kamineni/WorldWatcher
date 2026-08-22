import { useEffect, useMemo, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Autocomplete from '@mui/material/Autocomplete';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import CasinoIcon from '@mui/icons-material/Casino';
import { isAllowedImageFile } from '../../utils/fileValidation';
import { useCreatureStore, getCreaturesForCampaign } from '../../store/useCreatureStore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  useRandomizerBankStore,
  randomFullName,
  randomMotivation,
  randomPitfall,
  randomProfession,
} from '../../store/useRandomizerBankStore';
import { FieldRandomizer } from './FieldRandomizer';
import { SPELL_CLASS_OPTIONS } from '../../types/spell';
import {
  CREATURE_IMPORTANCE_OPTIONS,
  CREATURE_RELATION_OPTIONS,
  type AbilityScores,
  type Creature,
  type CreatureImportance,
  type CreatureRelation,
} from '../../types/creature';
import { DEFAULT_RELATIVE_SIZE, MAX_RELATIVE_SIZE, MIN_RELATIVE_SIZE } from '../../types/token';

type RandomizableField = 'name' | 'relation' | 'importance' | 'profession' | 'motivations' | 'pitfalls' | 'buildMode';

interface NpcFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (creature: Creature) => void;
  initialCreature?: Creature;
  campaignId: string;
}

const emptyAbilities: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

function emptyState() {
  return {
    tokenImage: '',
    name: '',
    relation: 'neutral' as CreatureRelation,
    importance: 'npc' as CreatureImportance,
    description: '',
    profession: '',
    isCustomBuild: true,
    baseCreatureId: undefined as string | undefined,
    size: 'Medium',
    type: '',
    alignment: '',
    ac: 10,
    hp: 10,
    hpFormula: '',
    speed: '30 ft',
    abilities: emptyAbilities,
    skills: '',
    senses: '',
    passivePerception: 10,
    languages: '',
    cr: '',
    proficiency: 2,
    traits: '',
    level: 1,
    characterClass: '',
    motivations: '',
    pitfalls: '',
    history: '',
    defaultSize: DEFAULT_RELATIVE_SIZE,
  };
}

function stateFromCreature(creature: Creature): ReturnType<typeof emptyState> {
  return {
    tokenImage: creature.tokenImage,
    name: creature.name,
    relation: creature.relation,
    importance: creature.importance,
    description: creature.description ?? '',
    profession: creature.profession ?? '',
    isCustomBuild: creature.isCustomBuild,
    baseCreatureId: creature.baseCreatureId,
    size: creature.size,
    type: creature.type,
    alignment: creature.alignment,
    ac: creature.ac,
    hp: creature.hp,
    hpFormula: creature.hpFormula ?? '',
    speed: creature.speed,
    abilities: creature.abilities,
    skills: creature.skills ?? '',
    senses: creature.senses ?? '',
    passivePerception: creature.passivePerception ?? 10,
    languages: creature.languages ?? '',
    cr: creature.cr,
    proficiency: creature.proficiency,
    traits: creature.traits ?? '',
    level: creature.level ?? 1,
    characterClass: creature.characterClass ?? '',
    motivations: creature.motivations ?? '',
    pitfalls: creature.pitfalls ?? '',
    history: creature.history ?? '',
    defaultSize: creature.defaultSize,
  };
}

/** Copies a monster's stat-block fields (everything CreatureFormDialog edits) into NPC form
 * state, keeping the NPC-only fields (relation/importance/description/profession/motivations/
 * pitfalls/history) and identity untouched - the user can still hand-edit anything after. */
function applyBaseCreature(prev: ReturnType<typeof emptyState>, base: Creature): ReturnType<typeof emptyState> {
  return {
    ...prev,
    size: base.size,
    type: base.type,
    alignment: base.alignment,
    ac: base.ac,
    hp: base.hp,
    hpFormula: base.hpFormula ?? '',
    speed: base.speed,
    abilities: base.abilities,
    skills: base.skills ?? '',
    senses: base.senses ?? '',
    passivePerception: base.passivePerception ?? 10,
    languages: base.languages ?? '',
    cr: base.cr,
    proficiency: base.proficiency,
    traits: base.traits ?? '',
    baseCreatureId: base.id,
  };
}

export function NpcFormDialog({
  open,
  onClose,
  onSubmit,
  initialCreature,
  campaignId,
}: NpcFormDialogProps) {
  const isEditMode = !!initialCreature;
  const [state, setState] = useState(emptyState());
  const [imageManuallySet, setImageManuallySet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [locked, setLocked] = useState<Set<RandomizableField>>(new Set());
  const toggleLock = (field: RandomizableField) => {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };
  const bank = useRandomizerBankStore();
  const fetchBanks = useRandomizerBankStore((s) => s.fetchBanks);

  const creaturePickerBrowse = useCreatureStore((s) => s.creaturePickerBrowse);
  const fetchCreaturePickerBrowse = useCreatureStore((s) => s.fetchCreaturePickerBrowse);
  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);
  const [creatureSearch, setCreatureSearch] = useState('');
  const debouncedCreatureSearch = useDebouncedValue(creatureSearch, 300);
  const [baseCreature, setBaseCreature] = useState<Creature | null>(null);

  useEffect(() => {
    if (!open) return;
    setState(initialCreature ? stateFromCreature(initialCreature) : emptyState());
    setImageManuallySet(false);
    setCreatureSearch('');
    setLocked(new Set());
    fetchBanks();
    if (initialCreature?.baseCreatureId) {
      fetchCreaturesForCampaign(campaignId);
    } else {
      setBaseCreature(null);
    }
  }, [open, initialCreature, campaignId, fetchCreaturesForCampaign, fetchBanks]);

  useEffect(() => {
    if (!open || !initialCreature?.baseCreatureId) return;
    const found = getCreaturesForCampaign(creaturesByCampaignId, campaignId).find(
      (c) => c.id === initialCreature.baseCreatureId,
    );
    if (found) setBaseCreature(found);
  }, [open, initialCreature, campaignId, creaturesByCampaignId]);

  useEffect(() => {
    if (!open || state.isCustomBuild) return;
    fetchCreaturePickerBrowse({
      campaignId,
      category: 'monster',
      scope: 'own_or_global',
      page: 1,
      pageSize: 20,
      search: debouncedCreatureSearch,
    });
  }, [open, state.isCustomBuild, campaignId, debouncedCreatureSearch, fetchCreaturePickerBrowse]);

  const monsterOptions = useMemo(() => creaturePickerBrowse?.items ?? [], [creaturePickerBrowse]);

  const set = <K extends keyof ReturnType<typeof emptyState>>(key: K, value: ReturnType<typeof emptyState>[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const setAbility = (key: keyof AbilityScores, value: number) => {
    setState((prev) => ({ ...prev, abilities: { ...prev.abilities, [key]: value } }));
  };

  const handleSelectBaseCreature = (creature: Creature | null) => {
    setBaseCreature(creature);
    if (!creature) return;
    setState((prev) => {
      const next = applyBaseCreature(prev, creature);
      return imageManuallySet ? next : { ...next, tokenImage: creature.tokenImage };
    });
  };

  const randomizeName = () => {
    if (locked.has('name')) return;
    const name = randomFullName(bank);
    if (name) set('name', name);
  };
  const randomizeRelation = () => {
    if (locked.has('relation')) return;
    const options = CREATURE_RELATION_OPTIONS.filter((o) => o.value !== 'player');
    set('relation', options[Math.floor(Math.random() * options.length)].value);
  };
  const randomizeImportance = () => {
    if (locked.has('importance')) return;
    const options = CREATURE_IMPORTANCE_OPTIONS.filter((o) => o.value !== 'monster');
    set('importance', options[Math.floor(Math.random() * options.length)].value);
  };
  const randomizeProfession = () => {
    if (locked.has('profession')) return;
    const profession = randomProfession(bank);
    if (profession) set('profession', profession);
  };
  const randomizeMotivations = () => {
    if (locked.has('motivations')) return;
    const motivation = randomMotivation(bank);
    if (motivation) set('motivations', motivation);
  };
  const randomizePitfalls = () => {
    if (locked.has('pitfalls')) return;
    const pitfall = randomPitfall(bank);
    if (pitfall) set('pitfalls', pitfall);
  };
  /** Coin-flips Custom vs Creature; Creature picks a random monster and copies its stats
   * as-is, Custom randomizes level + class on top of whatever's already there. */
  const randomizeBuildMode = async () => {
    if (locked.has('buildMode')) return;
    const goCustom = Math.random() < 0.5;
    if (goCustom) {
      set('isCustomBuild', true);
      set('level', 1 + Math.floor(Math.random() * 10));
      set('characterClass', SPELL_CLASS_OPTIONS[Math.floor(Math.random() * SPELL_CLASS_OPTIONS.length)]);
      return;
    }
    await useCreatureStore.getState().fetchCreaturePickerBrowse({
      campaignId,
      category: 'monster',
      scope: 'own_or_global',
      page: 1,
      pageSize: 50,
      search: '',
    });
    const items = useCreatureStore.getState().creaturePickerBrowse?.items ?? [];
    if (items.length === 0) return;
    const picked = items[Math.floor(Math.random() * items.length)];
    set('isCustomBuild', false);
    handleSelectBaseCreature(picked);
  };

  const randomizeAllUnlocked = () => {
    randomizeName();
    randomizeRelation();
    randomizeImportance();
    randomizeProfession();
    randomizeMotivations();
    randomizePitfalls();
    randomizeBuildMode();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isAllowedImageFile(file)) return;
    setImageManuallySet(true);
    set('tokenImage', URL.createObjectURL(file));
  };

  const isValid = state.name.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const now = Date.now();
    const creature: Creature = {
      id: initialCreature?.id ?? crypto.randomUUID(),
      category: 'npc',
      tokenImage: state.tokenImage,
      name: state.name.trim(),
      relation: state.relation,
      importance: state.importance,
      description: state.description.trim() || undefined,
      profession: state.profession.trim() || undefined,
      isCustomBuild: state.isCustomBuild,
      baseCreatureId: state.isCustomBuild ? undefined : state.baseCreatureId,
      size: state.size,
      type: state.type,
      alignment: state.alignment,
      ac: state.ac,
      hp: state.hp,
      hpFormula: state.hpFormula.trim() || undefined,
      speed: state.speed,
      abilities: state.abilities,
      skills: state.skills.trim() || undefined,
      senses: state.senses.trim() || undefined,
      passivePerception: state.passivePerception,
      languages: state.languages.trim() || undefined,
      cr: state.cr,
      proficiency: state.proficiency,
      traits: state.traits.trim() || undefined,
      level: state.isCustomBuild ? state.level : undefined,
      characterClass: state.isCustomBuild ? state.characterClass.trim() || undefined : undefined,
      motivations: state.motivations.trim() || undefined,
      pitfalls: state.pitfalls.trim() || undefined,
      history: state.history.trim() || undefined,
      defaultSize: state.defaultSize,
      currentSize: initialCreature?.currentSize ?? state.defaultSize,
      isFavorite: initialCreature?.isFavorite ?? false,
      createdAt: initialCreature?.createdAt ?? now,
      updatedAt: now,
    };
    onSubmit(creature);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
            {isEditMode ? 'Edit NPC' : 'Add NPC'}
          </Typography>
          <Tooltip title="Randomize every unlocked field">
            <IconButton size="small" onClick={randomizeAllUnlocked}>
              <CasinoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            {state.tokenImage ? (
              <Avatar src={state.tokenImage} sx={{ width: 56, height: 56 }} />
            ) : (
              <Avatar sx={{ width: 56, height: 56 }}>{state.name.charAt(0) || '?'}</Avatar>
            )}
            <Button size="small" variant="outlined" startIcon={<AddPhotoAlternateIcon />} onClick={() => fileInputRef.current?.click()}>
              Upload portrait
            </Button>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={handleFileSelected} />
          </Stack>

          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
            <TextField label="Name" value={state.name} onChange={(e) => set('name', e.target.value)} required fullWidth autoFocus />
            <FieldRandomizer locked={locked.has('name')} onToggleLock={() => toggleLock('name')} onRandomize={randomizeName} />
          </Stack>

          <Stack direction="row" spacing={2}>
            <Stack direction="row" spacing={0.5} sx={{ flexGrow: 1, alignItems: 'center' }}>
              <FormControl fullWidth>
                <InputLabel id="relation-label">Relation</InputLabel>
                <Select
                  labelId="relation-label"
                  label="Relation"
                  value={state.relation}
                  onChange={(e) => set('relation', e.target.value as CreatureRelation)}
                >
                  {CREATURE_RELATION_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FieldRandomizer locked={locked.has('relation')} onToggleLock={() => toggleLock('relation')} onRandomize={randomizeRelation} />
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ flexGrow: 1, alignItems: 'center' }}>
              <FormControl fullWidth>
                <InputLabel id="importance-label">Importance</InputLabel>
                <Select
                  labelId="importance-label"
                  label="Importance"
                  value={state.importance}
                  onChange={(e) => set('importance', e.target.value as CreatureImportance)}
                >
                  {CREATURE_IMPORTANCE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FieldRandomizer locked={locked.has('importance')} onToggleLock={() => toggleLock('importance')} onRandomize={randomizeImportance} />
            </Stack>
          </Stack>

          <TextField
            label="Description"
            value={state.description}
            onChange={(e) => set('description', e.target.value)}
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            placeholder="Appearance, mannerisms, first impression…"
          />

          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <TextField
              label="Profession"
              value={state.profession}
              onChange={(e) => set('profession', e.target.value)}
              fullWidth
              placeholder="Trader, blacksmith, guide…"
            />
            <FieldRandomizer locked={locked.has('profession')} onToggleLock={() => toggleLock('profession')} onRandomize={randomizeProfession} />
          </Stack>

          <Divider />
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Stat block
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={state.isCustomBuild ? 'custom' : 'creature'}
              onChange={(_e, v) => v && set('isCustomBuild', v === 'custom')}
            >
              <ToggleButton value="custom">Custom</ToggleButton>
              <ToggleButton value="creature">Creature</ToggleButton>
            </ToggleButtonGroup>
            <FieldRandomizer locked={locked.has('buildMode')} onToggleLock={() => toggleLock('buildMode')} onRandomize={randomizeBuildMode} />
          </Stack>

          {!state.isCustomBuild && (
            <Autocomplete
              options={monsterOptions}
              value={baseCreature}
              getOptionLabel={(c) => c.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_e, value) => handleSelectBaseCreature(value)}
              onInputChange={(_e, value) => setCreatureSearch(value)}
              // See FactionRelationsField.tsx's identical fix: Autocomplete's Popper is
              // portaled to <body> without a z-index, so it opens behind this Dialog's
              // z-index:modal layer unless bumped above it.
              slotProps={{ popper: { sx: { zIndex: (theme) => theme.zIndex.modal + 1 } } }}
              renderInput={(params) => (
                <TextField {...params} label="Base creature" placeholder="Search monsters…" helperText="Autofills the stat block below - still editable after." />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Avatar src={option.tokenImage} sx={{ width: 28, height: 28 }}>
                      {option.name.charAt(0)}
                    </Avatar>
                    <Stack>
                      <Typography variant="body2">{option.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.type} · CR {option.cr}
                      </Typography>
                    </Stack>
                  </Stack>
                </li>
              )}
            />
          )}

          {state.isCustomBuild && (
            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  label="Level"
                  type="number"
                  value={state.level}
                  onChange={(e) => set('level', Number(e.target.value))}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Class"
                  value={state.characterClass}
                  onChange={(e) => set('characterClass', e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Fighter, Wizard…"
                />
              </Grid>
            </Grid>
          )}

          <Grid container spacing={2}>
            <Grid size={4}>
              <TextField
                label="Size"
                value={state.size}
                onChange={(e) => set('size', e.target.value)}
                fullWidth
                size="small"
                disabled={!state.isCustomBuild}
              />
            </Grid>
            <Grid size={8}>
              <TextField
                label="Type / Species"
                value={state.type}
                onChange={(e) => set('type', e.target.value)}
                fullWidth
                size="small"
                disabled={!state.isCustomBuild}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Alignment"
                value={state.alignment}
                onChange={(e) => set('alignment', e.target.value)}
                fullWidth
                size="small"
                disabled={!state.isCustomBuild}
              />
            </Grid>
            <Grid size={4}>
              <TextField
                label="AC"
                type="number"
                value={state.ac}
                onChange={(e) => set('ac', Number(e.target.value))}
                fullWidth
                size="small"
                disabled={!state.isCustomBuild}
              />
            </Grid>
            <Grid size={4}>
              <TextField
                label="HP"
                type="number"
                value={state.hp}
                onChange={(e) => set('hp', Number(e.target.value))}
                fullWidth
                size="small"
                disabled={!state.isCustomBuild}
              />
            </Grid>
            <Grid size={4}>
              <TextField
                label="HP formula"
                value={state.hpFormula}
                onChange={(e) => set('hpFormula', e.target.value)}
                fullWidth
                size="small"
                placeholder="2d6"
                disabled={!state.isCustomBuild}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                label="Speed"
                value={state.speed}
                onChange={(e) => set('speed', e.target.value)}
                fullWidth
                size="small"
                disabled={!state.isCustomBuild}
              />
            </Grid>
            <Grid size={3}>
              <TextField
                label="CR"
                value={state.cr}
                onChange={(e) => set('cr', e.target.value)}
                fullWidth
                size="small"
                disabled={!state.isCustomBuild}
              />
            </Grid>
            <Grid size={3}>
              <TextField
                label="Proficiency"
                type="number"
                value={state.proficiency}
                onChange={(e) => set('proficiency', Number(e.target.value))}
                fullWidth
                size="small"
                disabled={!state.isCustomBuild}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                label="Default size (× grid cell)"
                type="number"
                value={state.defaultSize}
                onChange={(e) => set('defaultSize', Number(e.target.value))}
                fullWidth
                size="small"
                slotProps={{ htmlInput: { step: 0.1, min: MIN_RELATIVE_SIZE, max: MAX_RELATIVE_SIZE } }}
              />
            </Grid>
          </Grid>

          <Divider />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Ability scores
          </Typography>
          <Grid container spacing={2}>
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((key) => (
              <Grid size={4} key={key}>
                <TextField
                  label={key.toUpperCase()}
                  type="number"
                  value={state.abilities[key]}
                  onChange={(e) => setAbility(key, Number(e.target.value))}
                  fullWidth
                  size="small"
                  disabled={!state.isCustomBuild}
                />
              </Grid>
            ))}
          </Grid>

          <Divider />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Roleplay
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
            <TextField
              label="Motivations / Goals"
              value={state.motivations}
              onChange={(e) => set('motivations', e.target.value)}
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
            />
            <FieldRandomizer locked={locked.has('motivations')} onToggleLock={() => toggleLock('motivations')} onRandomize={randomizeMotivations} />
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
            <TextField
              label="Pitfalls"
              value={state.pitfalls}
              onChange={(e) => set('pitfalls', e.target.value)}
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              placeholder="Weaknesses, fears, secrets that can be used against them…"
            />
            <FieldRandomizer locked={locked.has('pitfalls')} onToggleLock={() => toggleLock('pitfalls')} onRandomize={randomizePitfalls} />
          </Stack>
          <TextField
            label="History"
            value={state.history}
            onChange={(e) => set('history', e.target.value)}
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
          />

          <Divider />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Other
          </Typography>
          <TextField
            label="Skills"
            value={state.skills}
            onChange={(e) => set('skills', e.target.value)}
            fullWidth
            size="small"
            disabled={!state.isCustomBuild}
          />
          <TextField
            label="Senses"
            value={state.senses}
            onChange={(e) => set('senses', e.target.value)}
            fullWidth
            size="small"
            disabled={!state.isCustomBuild}
          />
          <TextField
            label="Passive Perception"
            type="number"
            value={state.passivePerception}
            onChange={(e) => set('passivePerception', Number(e.target.value))}
            fullWidth
            size="small"
            disabled={!state.isCustomBuild}
          />
          <TextField
            label="Languages"
            value={state.languages}
            onChange={(e) => set('languages', e.target.value)}
            fullWidth
            size="small"
            disabled={!state.isCustomBuild}
          />
          <TextField
            label="Traits / notes"
            value={state.traits}
            onChange={(e) => set('traits', e.target.value)}
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid}>
          {isEditMode ? 'Save Changes' : 'Add NPC'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
