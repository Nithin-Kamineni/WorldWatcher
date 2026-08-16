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
import { formatSpellLevel, type Spell } from '../../types/spell';

interface SpellDetailDialogProps {
  open: boolean;
  spell: Spell | null;
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

export function SpellDetailDialog({ open, spell, onClose }: SpellDetailDialogProps) {
  if (!spell) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {spell.name} <Chip label={formatSpellLevel(spell.level)} size="small" sx={{ ml: 1 }} />
      </DialogTitle>
      <DialogContent dividers>
        {spell.imageSrc && (
          <Box
            component="img"
            src={spell.imageSrc}
            alt={spell.name}
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
            <Row label="School" value={spell.school} />
            <Row label="Casting Time" value={spell.castingTime} />
            <Row label="Range" value={spell.range} />
            <Row label="Components" value={spell.components} />
            <Row label="Duration" value={spell.duration} />
            <Row label="Classes" value={spell.classes} />
            <Row label="Description" value={spell.description} />
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
