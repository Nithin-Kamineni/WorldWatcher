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
import { getMagicItemRarityOption, type MagicItem } from '../../types/magicItem';
import { MagicItemDetailDialog } from './MagicItemDetailDialog';
import { ImagePreviewPopper } from './ImagePreviewPopper';
import { TokenThumbnail } from '../map/TokenThumbnail';

interface MagicItemsTableProps {
  items: MagicItem[];
  onEdit: (item: MagicItem) => void;
  onDelete: (item: MagicItem) => void;
}

function attunementLabel(item: MagicItem): string {
  if (!item.attunement) return 'Not required';
  return item.attunementRequirement || 'Required';
}

export function MagicItemsTable({ items, onEdit, onDelete }: MagicItemsTableProps) {
  const [viewingItem, setViewingItem] = useState<MagicItem | null>(null);
  const [hoveredItem, setHoveredItem] = useState<MagicItem | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleMouseEnter = (event: React.MouseEvent<HTMLElement>, item: MagicItem) => {
    if (!item.imageSrc) return;
    setAnchorEl(event.currentTarget);
    setHoveredItem(item);
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
    setAnchorEl(null);
  };

  return (
    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 700 }} />
            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Rarity</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Attunement</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const rarity = getMagicItemRarityOption(item.rarity);
            return (
              <TableRow key={item.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                <TableCell sx={{ width: 56 }}>
                  <Box
                    onMouseEnter={(e) => handleMouseEnter(e, item)}
                    onMouseLeave={handleMouseLeave}
                    sx={{ display: 'inline-flex', cursor: item.imageSrc ? 'pointer' : undefined }}
                  >
                    <TokenThumbnail src={item.imageSrc} name={item.name} size={40} />
                  </Box>
                </TableCell>
                <TableCell sx={{ maxWidth: 260 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => setViewingItem(item)}
                  >
                    {item.name}
                  </Typography>
                </TableCell>
                <TableCell>{item.type}</TableCell>
                <TableCell>
                  <Chip label={rarity.label} color={rarity.color} size="small" />
                </TableCell>
                <TableCell>{attunementLabel(item)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="View details">
                    <IconButton size="small" onClick={() => setViewingItem(item)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit item">
                    <IconButton size="small" onClick={() => onEdit(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete item">
                    <IconButton size="small" onClick={() => onDelete(item)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ImagePreviewPopper
        open={!!hoveredItem}
        anchorEl={anchorEl}
        name={hoveredItem?.name ?? ''}
        imageSrc={hoveredItem?.imageSrc ?? ''}
      />
      <MagicItemDetailDialog open={!!viewingItem} item={viewingItem} onClose={() => setViewingItem(null)} />
    </TableContainer>
  );
}
