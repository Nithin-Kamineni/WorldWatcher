import { useMemo } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import GroupsIcon from '@mui/icons-material/Groups';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { encounterCreatureSummary, getEncounterFallbackImage, type Encounter, type EncounterPrimaryType } from '../../types/encounter';
import type { Creature } from '../../types/creature';
import { TokenThumbnail } from '../map/TokenThumbnail';
import { computeEncounterDifficulty, type DifficultyBracket } from '../../utils/encounterCalculator';

function humanize(value: string): string { return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
const PRIMARY_TYPE_COLORS: Record<EncounterPrimaryType, 'error' | 'info' | 'success'> = { combat: 'error', social: 'info', exploration: 'success' };
const DIFFICULTY_COLORS: Record<DifficultyBracket, 'default' | 'success' | 'info' | 'warning' | 'error'> = {
  trivial: 'default', easy: 'success', medium: 'info', hard: 'warning', deadly: 'error',
};

interface EncountersTableProps {
  encounters: Encounter[]; creatures: Creature[];
  partySize: number; partyLevel: number;
  onEdit: (encounter: Encounter) => void; onDelete: (encounter: Encounter) => void; onView: (encounter: Encounter) => void;
}

function mobTypesFor(encounter: Encounter, creatures: Creature[]): string[] {
  const types = [
    ...encounter.creatures.map((entry) => entry.creatureId ? creatures.find((c) => c.id === entry.creatureId)?.type : undefined).filter((type): type is string => !!type),
    ...(encounter.randomTables ?? []).flatMap((row) => row.creatures.map((creature) => creature.type)).filter((type): type is string => !!type),
  ];
  return Array.from(new Set(types));
}

export function EncountersTable({ encounters, creatures, partySize, partyLevel, onEdit, onDelete, onView }: EncountersTableProps) {
  const rows = useMemo(() => encounters.map((encounter) => ({
    encounter,
    mobTypes: mobTypesFor(encounter, creatures),
    difficulty: encounter.creatures.length > 0 ? computeEncounterDifficulty(encounter.creatures, partySize, partyLevel) : null,
  })), [encounters, creatures, partySize, partyLevel]);
  return (
    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1.5, overflowX: 'auto' }}>
      <Table>
        <TableHead><TableRow sx={{ bgcolor: 'action.hover' }}>
          <TableCell /><TableCell sx={{ fontWeight: 700 }}>Encounter</TableCell><TableCell sx={{ fontWeight: 700 }}>Pillar</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>CR</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Difficulty</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Creatures</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Creature Types</TableCell><TableCell sx={{ fontWeight: 700 }}>XP</TableCell>
          <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
        </TableRow></TableHead>
        <TableBody>{rows.map(({ encounter, mobTypes, difficulty }) => {
          const xp = encounter.computedXp ?? encounter.combatBlock?.computedXp;
          return <TableRow key={encounter.id} hover onClick={() => onView(encounter)} sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}>
            <TableCell sx={{ width: 56 }}><TokenThumbnail src={getEncounterFallbackImage(encounter)} name={encounter.name} size={40} /></TableCell>
            <TableCell sx={{ minWidth: 240, maxWidth: 360 }}><Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{encounter.name}</Typography>{encounter.description && <Typography variant="body2" color="text.secondary" noWrap>{encounter.description}</Typography>}</TableCell>
            <TableCell>{encounter.primaryType ? <Chip label={humanize(encounter.primaryType)} size="small" color={PRIMARY_TYPE_COLORS[encounter.primaryType]} variant="outlined" /> : '—'}</TableCell>
            <TableCell><Typography variant="body2">{encounter.challengeRating || '—'}</Typography></TableCell>
            <TableCell>{difficulty ? <Tooltip title={`vs a party of ${partySize} at level ${partyLevel}`}><Chip label={difficulty.label} size="small" color={DIFFICULTY_COLORS[difficulty.bracket]} /></Tooltip> : <Typography variant="caption" color="text.secondary">—</Typography>}</TableCell>
            <TableCell><Chip icon={<GroupsIcon />} label={encounterCreatureSummary(encounter)} size="small" variant="outlined" /></TableCell>
            <TableCell><Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', maxWidth: 220 }}>{mobTypes.length ? mobTypes.map((type) => <Chip key={type} label={type} size="small" />) : <Typography variant="caption" color="text.secondary">—</Typography>}</Stack></TableCell>
            <TableCell>{xp != null ? xp.toLocaleString() : '—'}</TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
              <Tooltip title="Edit encounter"><IconButton size="small" onClick={(event) => { event.stopPropagation(); onEdit(encounter); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Delete encounter"><IconButton size="small" onClick={(event) => { event.stopPropagation(); onDelete(encounter); }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
            </TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
    </TableContainer>
  );
}
