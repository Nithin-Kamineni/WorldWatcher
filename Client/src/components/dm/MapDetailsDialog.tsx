import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import { getMapKindOption, MAP_SETTING_OPTIONS, type MapData } from '../../types/map';

interface MapDetailsDialogProps {
  open: boolean;
  map: MapData | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <TableRow>
      <TableCell sx={{ fontWeight: 700, width: 160, borderColor: 'divider', verticalAlign: 'top' }}>{label}</TableCell>
      <TableCell sx={{ borderColor: 'divider' }}>{value}</TableCell>
    </TableRow>
  );
}

export function MapDetailsDialog({ open, map, onClose }: MapDetailsDialogProps) {
  if (!map) return null;

  const settingLabel = map.setting ? MAP_SETTING_OPTIONS.find((o) => o.value === map.setting)?.label : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{map.name}</DialogTitle>
      <DialogContent dividers>
        <Table size="small">
          <TableBody>
            <Row
              label="Type"
              value={
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {map.kinds.map((kind) => {
                    const option = getMapKindOption(kind);
                    return <Chip key={kind} label={option.label} color={option.color} size="small" />;
                  })}
                </Stack>
              }
            />
            <Row label="Location" value={map.location} />
            <Row label="Setting" value={settingLabel} />
            <Row label="Description" value={map.description} />
            <Row label="What's happening" value={map.activity} />
            {(map.customDetails ?? []).map((detail) => (
              <Row key={detail.id} label={detail.label || 'Detail'} value={detail.value} />
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
