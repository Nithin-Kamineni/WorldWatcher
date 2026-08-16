import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { isAllowedImageFile } from '../../utils/fileValidation';
import {
  CREATURE_IMPORTANCE_OPTIONS,
  CREATURE_RELATION_OPTIONS,
  type AbilityScores,
  type Creature,
  type CreatureCategory,
  type CreatureImportance,
  type CreatureRelation,
} from '../../types/creature';
import { DEFAULT_RELATIVE_SIZE, MAX_RELATIVE_SIZE, MIN_RELATIVE_SIZE } from '../../types/token';

interface CreatureFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (creature: Creature) => void;
  initialCreature?: Creature;
  /** which sub-tab the dialog was opened from - fixes the category for new creatures */
  defaultCategory: CreatureCategory;
}

const emptyAbilities: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

function emptyState() {
  return {
    tokenImage: '',
    name: '',
    relation: 'neutral' as CreatureRelation,
    importance: 'monster' as CreatureImportance,
    profession: '',
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

function stateFromCreature(creature: Creature) {
  return {
    tokenImage: creature.tokenImage,
    name: creature.name,
    relation: creature.relation,
    importance: creature.importance,
    profession: creature.profession ?? '',
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

export function CreatureFormDialog({ open, onClose, onSubmit, initialCreature, defaultCategory }: CreatureFormDialogProps) {
  const isEditMode = !!initialCreature;
  const category = initialCreature?.category ?? defaultCategory;
  const isNpc = category === 'npc';
  const [state, setState] = useState(emptyState());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setState(initialCreature ? stateFromCreature(initialCreature) : emptyState());
  }, [open, initialCreature]);

  const set = <K extends keyof ReturnType<typeof emptyState>>(key: K, value: ReturnType<typeof emptyState>[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const setAbility = (key: keyof AbilityScores, value: number) => {
    setState((prev) => ({ ...prev, abilities: { ...prev.abilities, [key]: value } }));
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isAllowedImageFile(file)) return;
    set('tokenImage', URL.createObjectURL(file));
  };

  const isValid = state.name.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const now = Date.now();
    const creature: Creature = {
      id: initialCreature?.id ?? crypto.randomUUID(),
      category,
      tokenImage: state.tokenImage,
      name: state.name.trim(),
      relation: state.relation,
      importance: state.importance,
      profession: isNpc ? state.profession.trim() || undefined : undefined,
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
      level: isNpc ? state.level : undefined,
      characterClass: isNpc ? state.characterClass.trim() || undefined : undefined,
      motivations: isNpc ? state.motivations.trim() || undefined : undefined,
      pitfalls: isNpc ? state.pitfalls.trim() || undefined : undefined,
      history: isNpc ? state.history.trim() || undefined : undefined,
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
      <DialogTitle sx={{ fontWeight: 700 }}>{isEditMode ? 'Edit Creature' : 'Add Creature'}</DialogTitle>
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

          <TextField
            label="Name"
            value={state.name}
            onChange={(e) => set('name', e.target.value)}
            required
            fullWidth
            autoFocus
          />

          {isNpc && (
            <>
              <Stack direction="row" spacing={2}>
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
              </Stack>

              <TextField
                label="Profession"
                value={state.profession}
                onChange={(e) => set('profession', e.target.value)}
                fullWidth
                placeholder="Trader, blacksmith, guide…"
              />

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
              <TextField
                label="Motivations / Goals"
                value={state.motivations}
                onChange={(e) => set('motivations', e.target.value)}
                fullWidth
                multiline
                minRows={2}
                maxRows={4}
              />
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
              <TextField
                label="History"
                value={state.history}
                onChange={(e) => set('history', e.target.value)}
                fullWidth
                multiline
                minRows={2}
                maxRows={4}
              />
            </>
          )}

          <Divider />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Combat stats
          </Typography>
          <Grid container spacing={2}>
            <Grid size={4}>
              <TextField label="Size" value={state.size} onChange={(e) => set('size', e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid size={8}>
              <TextField label="Type" value={state.type} onChange={(e) => set('type', e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid size={12}>
              <TextField label="Alignment" value={state.alignment} onChange={(e) => set('alignment', e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid size={4}>
              <TextField
                label="AC"
                type="number"
                value={state.ac}
                onChange={(e) => set('ac', Number(e.target.value))}
                fullWidth
                size="small"
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
              />
            </Grid>
            <Grid size={6}>
              <TextField label="Speed" value={state.speed} onChange={(e) => set('speed', e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid size={3}>
              <TextField label="CR" value={state.cr} onChange={(e) => set('cr', e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid size={3}>
              <TextField
                label="Proficiency"
                type="number"
                value={state.proficiency}
                onChange={(e) => set('proficiency', Number(e.target.value))}
                fullWidth
                size="small"
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
                />
              </Grid>
            ))}
          </Grid>

          <Divider />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Other
          </Typography>
          <TextField label="Skills" value={state.skills} onChange={(e) => set('skills', e.target.value)} fullWidth size="small" />
          <TextField label="Senses" value={state.senses} onChange={(e) => set('senses', e.target.value)} fullWidth size="small" />
          <TextField
            label="Passive Perception"
            type="number"
            value={state.passivePerception}
            onChange={(e) => set('passivePerception', Number(e.target.value))}
            fullWidth
            size="small"
          />
          <TextField label="Languages" value={state.languages} onChange={(e) => set('languages', e.target.value)} fullWidth size="small" />
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
          {isEditMode ? 'Save Changes' : 'Add Creature'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
