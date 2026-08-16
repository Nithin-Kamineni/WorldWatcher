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
import Typography from '@mui/material/Typography';
import type { BastionFacility } from '../../types/bastion';

interface BastionFacilityDetailDialogProps {
  open: boolean;
  facility: BastionFacility | null;
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

export function BastionFacilityDetailDialog({ open, facility, onClose }: BastionFacilityDetailDialogProps) {
  if (!facility) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {facility.name}{' '}
        <Chip label={facility.facilityType === 'special' ? 'Special' : 'Basic'} size="small" sx={{ ml: 1 }} />
      </DialogTitle>
      <DialogContent dividers>
        {facility.imageSrc && (
          <Box
            component="img"
            src={facility.imageSrc}
            alt={facility.name}
            sx={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 2, mb: 2, bgcolor: 'action.hover' }}
          />
        )}
        <Table size="small">
          <TableBody>
            <Row label="Space" value={facility.space.join(', ')} />
            <Row label="Prerequisite Level" value={facility.prerequisiteLevel ?? undefined} />
            <Row label="Orders" value={facility.orders.join(', ')} />
            <Row label="Page" value={facility.page ?? undefined} />
            <Row
              label="Description"
              value={
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {facility.description}
                </Typography>
              }
            />
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
