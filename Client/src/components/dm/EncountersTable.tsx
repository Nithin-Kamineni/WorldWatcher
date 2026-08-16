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
import { getEncounterFallbackImage, type Encounter } from '../../types/encounter';
import type { Creature } from '../../types/creature';
import { TokenThumbnail } from '../map/TokenThumbnail';

interface EncountersTableProps {
  encounters: Encounter[];
  creatures: Creature[];
  onEdit: (encounter: Encounter) => void;
  onDelete: (encounter: Encounter) => void;
}

function mobTypesFor(encounter: Encounter, creatures: Creature[]): string[] {
  const types = [
    ...encounter.creatures
      .map((entry) => (entry.creatureId ? creatures.find((c) => c.id === entry.creatureId)?.type : undefined))
      .filter((t): t is string => !!t),
    ...(encounter.randomTables ?? []).flatMap((row) => row.creatures.map((c) => c.type)).filter((t): t is string => !!t),
  ];
  return Array.from(new Set(types));
}

export function EncountersTable({ encounters, creatures, onEdit, onDelete }: EncountersTableProps) {
  const rows = useMemo(
    () => encounters.map((encounter) => ({ encounter, mobTypes: mobTypesFor(encounter, creatures) })),
    [encounters, creatures],
  );

  return (
    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 700 }} />
            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Challenge Rating</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Theme</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Type of Mobs</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Other Features</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Creatures</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ encounter, mobTypes }) => {
            const creatureCount = encounter.creatures.reduce((sum, e) => sum + e.quantity, 0);
            const isRandom = encounter.resolutionType === 'random_table';
            return (
              <TableRow key={encounter.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                <TableCell sx={{ width: 56 }}>
                  <TokenThumbnail src={getEncounterFallbackImage(encounter)} name={encounter.name} size={40} />
                </TableCell>
                <TableCell sx={{ maxWidth: 260 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {encounter.name}
                  </Typography>
                  {encounter.description && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {encounter.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={isRandom ? 'Random table' : 'Fixed roster'}
                    size="small"
                    color={isRandom ? 'secondary' : 'default'}
                    variant={isRandom ? 'filled' : 'outlined'}
                  />
                  {isRandom && encounter.page != null && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                      p.{encounter.page}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{encounter.challengeRating || '—'}</TableCell>
                <TableCell>{encounter.theme || '—'}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', maxWidth: 200 }}>
                    {mobTypes.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        —
                      </Typography>
                    ) : (
                      mobTypes.map((t) => <Chip key={t} label={t} size="small" />)
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', maxWidth: 200 }}>
                    {encounter.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>
                  {isRandom ? (
                    <Typography variant="caption" color="text.secondary">
                      rolled on placement
                    </Typography>
                  ) : (
                    <Chip icon={<GroupsIcon />} label={creatureCount} size="small" variant="outlined" />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit encounter">
                    <IconButton size="small" onClick={() => onEdit(encounter)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete encounter">
                    <IconButton size="small" onClick={() => onDelete(encounter)}>
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
  );
}
