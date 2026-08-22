import { useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import {
  formatCastingTimeShort,
  formatComponentsShort,
  formatRangeShort,
  formatSpellLevel,
  schoolTextColor,
  SPELL_SCHOOL_COLORS,
  type Spell,
} from '../../types/spell';
import { SpellDetailDialog } from './SpellDetailDialog';
import { ImagePreviewPopper } from './ImagePreviewPopper';
import { TokenThumbnail } from '../map/TokenThumbnail';

interface SpellsTableProps {
  spells: Spell[];
  onEdit: (spell: Spell) => void;
  onDelete: (spell: Spell) => void;
}

export function SpellsTable({ spells, onEdit, onDelete }: SpellsTableProps) {
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null);
  const [hoveredSpell, setHoveredSpell] = useState<Spell | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleMouseEnter = (event: React.MouseEvent<HTMLElement>, spell: Spell) => {
    if (!spell.imageSrc) return;
    setAnchorEl(event.currentTarget);
    setHoveredSpell(spell);
  };

  const handleMouseLeave = () => {
    setHoveredSpell(null);
    setAnchorEl(null);
  };

  return (
    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 700 }} />
            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Level</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>School</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Casting Time</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Range</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Components</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {spells.map((spell) => (
            <TableRow key={spell.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
              <TableCell sx={{ width: 56 }}>
                <Box
                  onMouseEnter={(e) => handleMouseEnter(e, spell)}
                  onMouseLeave={handleMouseLeave}
                  sx={{ display: 'inline-flex', cursor: spell.imageSrc ? 'pointer' : undefined }}
                >
                  <TokenThumbnail src={spell.imageSrc} name={spell.name} size={40} />
                </Box>
              </TableCell>
              <TableCell>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  onClick={() => setViewingSpell(spell)}
                >
                  {spell.name}
                </Typography>
                {spell.classes && (
                  <Typography variant="caption" color="text.secondary">
                    {spell.classes}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Chip label={formatSpellLevel(spell.level)} size="small" />
              </TableCell>
              <TableCell>
                {spell.school &&
                  (SPELL_SCHOOL_COLORS[spell.school] ? (
                    <Chip
                      label={spell.school}
                      size="small"
                      sx={{
                        bgcolor: SPELL_SCHOOL_COLORS[spell.school],
                        color: schoolTextColor(SPELL_SCHOOL_COLORS[spell.school]),
                        fontWeight: 600,
                      }}
                    />
                  ) : (
                    spell.school
                  ))}
              </TableCell>
              <TableCell>{formatCastingTimeShort(spell.castingTime)}</TableCell>
              <TableCell>{formatRangeShort(spell.range)}</TableCell>
              <TableCell>{formatComponentsShort(spell.components)}</TableCell>
              <TableCell>{spell.duration}</TableCell>
              <TableCell align="right">
                <Tooltip title="View details">
                  <IconButton size="small" onClick={() => setViewingSpell(spell)}>
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit spell">
                  <IconButton size="small" onClick={() => onEdit(spell)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete spell">
                  <IconButton size="small" onClick={() => onDelete(spell)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ImagePreviewPopper
        open={!!hoveredSpell}
        anchorEl={anchorEl}
        name={hoveredSpell?.name ?? ''}
        imageSrc={hoveredSpell?.imageSrc ?? ''}
      />
      <SpellDetailDialog open={!!viewingSpell} spell={viewingSpell} onClose={() => setViewingSpell(null)} />
    </TableContainer>
  );
}
