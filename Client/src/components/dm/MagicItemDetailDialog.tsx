import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import { getMagicItemRarityOption, type MagicItem } from '../../types/magicItem';

interface MagicItemDetailDialogProps {
  open: boolean;
  item: MagicItem | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <TableRow>
      <TableCell sx={{ fontWeight: 700, width: 140, borderColor: 'divider', verticalAlign: 'top' }}>{label}</TableCell>
      <TableCell sx={{ borderColor: 'divider' }}>{value}</TableCell>
    </TableRow>
  );
}

export function MagicItemDetailDialog({ open, item, onClose }: MagicItemDetailDialogProps) {
  if (!item) return null;
  const rarity = getMagicItemRarityOption(item.rarity);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {item.name} <Chip label={rarity.label} color={rarity.color} size="small" sx={{ ml: 1 }} />
      </DialogTitle>
      <DialogContent dividers>
        {item.imageSrc && (
          <Box
            component="img"
            src={item.imageSrc}
            alt={item.name}
            sx={{
              width: '100%',
              maxHeight: 260,
              objectFit: 'contain',
              borderRadius: 2,
              mb: 2,
              bgcolor: 'action.hover',
            }}
          />
        )}
        <Table size="small">
          <TableBody>
            <Row label="Type" value={item.type} />
            <Row
              label="Attunement"
              value={item.attunement ? (item.attunementRequirement ?? 'Required') : 'Not required'}
            />
            <Row label="Description" value={item.description} />
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
