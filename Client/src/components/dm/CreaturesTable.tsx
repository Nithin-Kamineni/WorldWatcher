import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { getCreatureImportanceOption, getCreatureRelationOption, type Creature, type CreatureCategory } from '../../types/creature';
import { SizeControl } from '../map/SizeControl';

interface CreaturesTableProps {
  creatures: Creature[];
  category: CreatureCategory;
  onView: (creature: Creature) => void;
  onEdit: (creature: Creature) => void;
  onDelete: (creature: Creature) => void;
  onUpdateCreature: (creature: Creature) => void;
}

export function CreaturesTable({ creatures, category, onView, onEdit, onDelete, onUpdateCreature }: CreaturesTableProps) {
  const isNpc = category === 'npc';
  return (
    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 700 }} />
            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
            {isNpc && <TableCell sx={{ fontWeight: 700 }}>Relation</TableCell>}
            {isNpc && <TableCell sx={{ fontWeight: 700 }}>Importance</TableCell>}
            {isNpc && <TableCell sx={{ fontWeight: 700 }}>Level</TableCell>}
            {isNpc && <TableCell sx={{ fontWeight: 700 }}>Class</TableCell>}
            {!isNpc && <TableCell sx={{ fontWeight: 700 }}>Alignment</TableCell>}
            {!isNpc && <TableCell sx={{ fontWeight: 700 }}>AC</TableCell>}
            <TableCell sx={{ fontWeight: 700 }}>HP</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>CR</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {creatures.map((creature) => {
            const relation = getCreatureRelationOption(creature.relation);
            const importance = getCreatureImportanceOption(creature.importance);
            return (
              <TableRow key={creature.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                <TableCell sx={{ width: 56 }}>
                  {creature.tokenImage ? (
                    <Avatar src={creature.tokenImage} alt={creature.name} sx={{ width: 40, height: 40 }} />
                  ) : (
                    <Avatar sx={{ width: 40, height: 40 }}>{creature.name.charAt(0)}</Avatar>
                  )}
                </TableCell>
                <TableCell>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => onView(creature)}
                  >
                    {creature.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isNpc ? creature.profession || creature.type : creature.type}
                  </Typography>
                </TableCell>
                {isNpc && (
                  <TableCell>
                    <Chip label={relation.label} color={relation.color} size="small" />
                  </TableCell>
                )}
                {isNpc && (
                  <TableCell>
                    <Chip label={importance.label} color={importance.color} size="small" variant="outlined" />
                  </TableCell>
                )}
                {isNpc && <TableCell>{creature.level ?? '—'}</TableCell>}
                {isNpc && (
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {creature.characterClass ?? '—'}
                    </Typography>
                  </TableCell>
                )}
                {!isNpc && <TableCell>{creature.alignment || '—'}</TableCell>}
                {!isNpc && <TableCell>{creature.ac}</TableCell>}
                <TableCell>{creature.hp}</TableCell>
                <TableCell>{creature.cr}</TableCell>
                <TableCell>
                  <SizeControl
                    currentSize={creature.currentSize}
                    defaultSize={creature.defaultSize}
                    onCurrentChange={(currentSize) => onUpdateCreature({ ...creature, currentSize })}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={creature.isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                    <IconButton size="small" onClick={() => onUpdateCreature({ ...creature, isFavorite: !creature.isFavorite })}>
                      {creature.isFavorite ? (
                        <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                      ) : (
                        <StarBorderIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="View stat block">
                    <IconButton size="small" onClick={() => onView(creature)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit creature">
                    <IconButton size="small" onClick={() => onEdit(creature)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete creature">
                    <IconButton size="small" onClick={() => onDelete(creature)}>
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
