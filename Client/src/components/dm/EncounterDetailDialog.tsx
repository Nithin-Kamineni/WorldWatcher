import { useEffect, useMemo, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CasinoOutlinedIcon from '@mui/icons-material/CasinoOutlined';
import CasinoIcon from '@mui/icons-material/Casino';
import { CreatureStatBlockDialog, StatBox } from './CreatureStatBlockDialog';
import { StructuredContent } from './StructuredContent';
import { encounterCreatureSummary, getEncounterFallbackImage, type Encounter } from '../../types/encounter';
import type { Creature } from '../../types/creature';
import { nextEncounterObjective } from '../../utils/encounterObjectives';
import { useCreatureStore } from '../../store/useCreatureStore';
import { useEncounterDifficultySettingsStore } from '../../store/useEncounterDifficultySettingsStore';
import { computeEncounterDifficulty } from '../../utils/encounterCalculator';

function title(value: string | null | undefined): string { return value ? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unclassified'; }
function Section({ heading, children }: { heading: string; children: React.ReactNode }) { return <Box><Typography variant="subtitle2" color="primary" sx={{ fontWeight: 850, mb: 0.75 }}>{heading}</Typography>{children}</Box>; }

interface Props { encounter: Encounter | null; creatures?: Creature[]; campaignId?: string; onClose: () => void; onEdit?: (encounter: Encounter) => void; }

export function EncounterDetailDialog({ encounter, creatures = [], campaignId, onClose, onEdit }: Props) {
  const [selectedCreature, setSelectedCreature] = useState<Creature | null>(null);
  const [rolledObjective, setRolledObjective] = useState<string | null>(null);
  const fetchCreatureById = useCreatureStore((state) => state.fetchCreatureById);
  const party = useEncounterDifficultySettingsStore((s) => s.getParty(campaignId ?? ''));
  useEffect(() => { setRolledObjective(null); setSelectedCreature(null); }, [encounter?.id]);
  const generatedObjective = useMemo(() => {
    if (!encounter?.id) return nextEncounterObjective(null);
    return nextEncounterObjective(encounter.primaryType);
  }, [encounter?.id, encounter?.primaryType]);
  if (!encounter) return null;
  const image = getEncounterFallbackImage(encounter);
  const randomRows = encounter.randomTables ?? [];
  const xp = encounter.computedXp ?? encounter.combatBlock?.computedXp;
  const liveDifficulty = encounter.creatures.length > 0 ? computeEncounterDifficulty(encounter.creatures, party.partySize, party.partyLevel) : null;
  const openCreature = (creatureId: string | null) => {
    if (!creatureId) return;
    const cached = creatures.find((creature) => creature.id === creatureId);
    if (cached) setSelectedCreature(cached);
    else void fetchCreatureById(creatureId).then((creature) => setSelectedCreature(creature ?? null));
  };
  return <>
    <Dialog open onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Avatar src={image || undefined} sx={{ width: 52, height: 52 }}>{encounter.name.charAt(0)}</Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}><Typography variant="h6" sx={{ fontWeight: 850, lineHeight: 1.2 }}>{encounter.name}</Typography><Typography variant="body2" color="text.secondary">{title(encounter.primaryType)} encounter{encounter.theme ? ` · ${encounter.theme}` : ''}</Typography></Box>
        <Chip size="small" color={encounter.status === 'ready' ? 'success' : 'default'} label={title(encounter.status)} />
      </Stack></DialogTitle>
      <DialogContent dividers><Stack spacing={2.25}>
        <Stack direction="row" spacing={2} useFlexGap sx={{ justifyContent: 'space-around', flexWrap: 'wrap' }}>
          <StatBox label="Pillar" value={title(encounter.primaryType)} /><StatBox label="CR" value={encounter.challengeRating || '—'} />
          <StatBox label="Creatures" value={encounterCreatureSummary(encounter)} /><StatBox label="XP" value={xp?.toLocaleString() ?? '—'} />
          {liveDifficulty && <StatBox label={`Difficulty (${party.partySize} @ lvl ${party.partyLevel})`} value={liveDifficulty.label} />}
        </Stack>
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {encounter.encounterType && <Chip size="small" color="primary" variant="outlined" label={encounter.encounterType} />}
          {encounter.possibleLocations?.map((location) => <Chip key={location} size="small" variant="outlined" label={location} />)}
          {encounter.tags.map((tag) => <Chip key={tag} size="small" label={tag} />)}
        </Stack>
        {encounter.readAloud && <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderLeftColor: 'primary.main', fontStyle: 'italic' }}><StructuredContent value={encounter.readAloud} /></Paper>}
        <Section heading="Objective"><Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}><Box sx={{ flex: 1 }}><StructuredContent value={rolledObjective ?? encounter.objective ?? generatedObjective} /></Box><Button size="small" startIcon={<CasinoIcon />} onClick={() => setRolledObjective(nextEncounterObjective(encounter.primaryType, rolledObjective ?? encounter.objective ?? generatedObjective))}>New objective</Button></Stack></Section>
        {encounter.description && <Section heading="Description"><StructuredContent value={encounter.description} /></Section>}
        {encounter.creatures.length > 0 && <Section heading="Creature roster"><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>{encounter.creatures.map((entry) => <Chip key={entry.id} clickable={!!entry.creatureId} onClick={() => openCreature(entry.creatureId)} avatar={<Avatar src={entry.imageSrc || undefined} />} label={`${entry.quantityFormula ?? entry.quantity}× ${entry.name}${entry.role ? ` · ${title(entry.role)}` : ''}`} />)}</Stack></Section>}
        {randomRows.length > 0 && <Section heading="Random-table outcomes"><Stack spacing={1}>{randomRows.map((row) => <Paper key={row.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}><Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}><Chip size="small" icon={<CasinoOutlinedIcon />} label={row.min === row.max ? row.min : `${row.min}–${row.max}`} /><Box sx={{ minWidth: 0 }}><StructuredContent value={row.resultText} />{row.creatures.length > 0 && <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 0.75 }}>{row.creatures.map((entry) => <Chip key={entry.id} clickable={!!entry.creatureId} onClick={() => openCreature(entry.creatureId)} size="small" variant="outlined" label={`${entry.quantityFormula} ${entry.name}${entry.type ? ` · ${entry.type}` : ''}`} />)}</Stack>}</Box></Stack></Paper>)}</Stack></Section>}
        {encounter.primaryType === 'combat' && encounter.combatBlock && <><Divider /><Section heading="Combat"><StructuredContent value={{ victory_condition: encounter.combatBlock.victoryCondition, awareness: encounter.combatBlock.awareness, morale: encounter.combatBlock.morale, terrain: encounter.combatBlock.terrainType, terrain_features: encounter.combatBlock.terrainFeatures, start_range: encounter.combatBlock.startRange, dynamic_events: encounter.combatBlock.dynamicEvents, aftermath: encounter.combatBlock.aftermath }} /></Section></>}
        {encounter.primaryType === 'social' && encounter.socialBlock && <><Divider /><Section heading="Social interaction"><StructuredContent value={{ venue: encounter.socialBlock.venue, tone: encounter.socialBlock.tone, stakes: encounter.socialBlock.stakes, player_levers: encounter.socialBlock.playerLevers, key_checks: encounter.socialBlock.keyChecks, complications: encounter.socialBlock.complications, escalation: encounter.socialBlock.escalation }} /></Section></>}
        {encounter.primaryType === 'exploration' && encounter.explorationBlock && <><Divider /><Section heading="Exploration"><StructuredContent value={{ environment: encounter.explorationBlock.environment, obstacle: encounter.explorationBlock.obstacleType, terrain_difficulty: encounter.explorationBlock.terrainDifficulty, sensory_clues: encounter.explorationBlock.sensoryClues, points_of_interest: encounter.explorationBlock.pointsOfInterest, complications: encounter.explorationBlock.complications }} /></Section></>}
      </Stack></DialogContent>
      <DialogActions>{onEdit && <Button onClick={() => onEdit(encounter)}>Edit encounter</Button>}<Button variant="contained" onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
    <CreatureStatBlockDialog open={!!selectedCreature} creature={selectedCreature} onClose={() => setSelectedCreature(null)} />
  </>;
}
