import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import {
  abilityModifier,
  formatModifier,
  getCreatureImportanceOption,
  getCreatureRelationOption,
  type AbilityScores,
  type Creature,
} from '../../types/creature';

interface CreatureStatBlockDialogProps {
  open: boolean;
  creature: Creature | null;
  onClose: () => void;
}

const ABILITY_LABELS: { key: keyof AbilityScores; label: string }[] = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <TableRow>
      <TableCell sx={{ fontWeight: 700, width: 180, borderColor: 'divider' }}>{label}</TableCell>
      <TableCell sx={{ borderColor: 'divider' }}>{value}</TableCell>
    </TableRow>
  );
}

export function CreatureStatBlockDialog({ open, creature, onClose }: CreatureStatBlockDialogProps) {
  if (!creature) return null;
  const isNpc = creature.category === 'npc';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {creature.tokenImage ? (
            <Avatar src={creature.tokenImage} alt={creature.name} />
          ) : (
            <Avatar>{creature.name.charAt(0)}</Avatar>
          )}
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
            {creature.name}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Table size="small">
          <TableBody>
            {isNpc && <Row label="Relation" value={getCreatureRelationOption(creature.relation).label} />}
            {isNpc && <Row label="Importance" value={getCreatureImportanceOption(creature.importance).label} />}
            {isNpc && <Row label="Description" value={creature.description} />}
            {isNpc && <Row label="Profession" value={creature.profession} />}
            {isNpc && <Row label="Level" value={creature.level} />}
            {isNpc && <Row label="Class" value={creature.characterClass} />}
            <Row label="Size" value={creature.size} />
            <Row label="Type" value={creature.type} />
            <Row label="Alignment" value={creature.alignment} />
            <Row label="AC" value={creature.ac} />
            <Row label="HP" value={creature.hpFormula ? `${creature.hp} (${creature.hpFormula})` : creature.hp} />
            <Row label="Speed" value={creature.speed} />
            {ABILITY_LABELS.map(({ key, label }) => (
              <Row
                key={key}
                label={label}
                value={`${creature.abilities[key]} (${formatModifier(abilityModifier(creature.abilities[key]))})`}
              />
            ))}
            <Row label="Skills" value={creature.skills} />
            <Row label="Senses" value={creature.senses} />
            <Row label="Passive Perception" value={creature.passivePerception} />
            <Row label="Languages" value={creature.languages} />
            <Row label="CR" value={creature.cr} />
            <Row label="Proficiency" value={`+${creature.proficiency}`} />
            <Row label={isNpc ? 'Personality traits' : 'Traits'} value={creature.traits} />
            {isNpc && <Row label="Motivations / Goals" value={creature.motivations} />}
            {isNpc && <Row label="Pitfalls" value={creature.pitfalls} />}
            {isNpc && <Row label="History" value={creature.history} />}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
