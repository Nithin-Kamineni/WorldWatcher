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
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { getFactionInfluenceOption, type Faction } from '../../types/faction';

interface FactionsTableProps {
  factions: Faction[];
  onEdit: (faction: Faction) => void;
  onDelete: (faction: Faction) => void;
}

export function FactionsTable({ factions, onEdit, onDelete }: FactionsTableProps) {
  const rows = useMemo(() => factions, [factions]);

  return (
    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Goals</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Influence</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((faction) => (
            <TableRow key={faction.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
              <TableCell sx={{ maxWidth: 280 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  {faction.imageSrc ? (
                    <Avatar src={faction.imageSrc} sx={{ width: 32, height: 32 }} />
                  ) : (
                    <Avatar sx={{ width: 32, height: 32 }}>{faction.name.charAt(0)}</Avatar>
                  )}
                  <Stack sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {faction.name}
                    </Typography>
                    {faction.description && (
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {faction.description}
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </TableCell>
              <TableCell>{faction.factionType || '—'}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', maxWidth: 260 }}>
                  {faction.goals.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      —
                    </Typography>
                  ) : (
                    faction.goals.map((goal) => <Chip key={goal} label={goal} size="small" variant="outlined" />)
                  )}
                </Stack>
              </TableCell>
              <TableCell>
                <Chip label={getFactionInfluenceOption(faction.influence).label} size="small" variant="outlined" />
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Edit faction">
                  <IconButton size="small" onClick={() => onEdit(faction)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete faction">
                  <IconButton size="small" onClick={() => onDelete(faction)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
