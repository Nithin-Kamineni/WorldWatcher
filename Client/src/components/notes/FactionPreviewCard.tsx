import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Faction } from '../../types/faction';

interface FactionPreviewCardProps {
  open: boolean;
  faction: Faction | null;
  onClose: () => void;
}

export function ChipRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {values.map((v, i) => (
          <Chip key={i} label={v} size="small" variant="outlined" />
        ))}
      </Stack>
    </Box>
  );
}

/** Read-only @-mention preview card for a Faction - lighter-weight than FactionDetailPanel,
 * which is wired specifically into the diplomacy relations graph (center/selected/relation
 * props) and isn't a standalone "just show me this faction" view. */
export function FactionPreviewCard({ open, faction, onClose }: FactionPreviewCardProps) {
  if (!faction) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {faction.name}
        {faction.factionType && <Chip label={faction.factionType} size="small" sx={{ ml: 1 }} />}
      </DialogTitle>
      <DialogContent dividers>
        {faction.imageSrc && (
          <Box
            component="img"
            src={faction.imageSrc}
            alt={faction.name}
            sx={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 2, mb: 2, bgcolor: 'action.hover' }}
          />
        )}
        {faction.description && (
          <Typography variant="body2" sx={{ mb: 1.5, whiteSpace: 'pre-wrap' }}>
            {faction.description}
          </Typography>
        )}
        <ChipRow label="Goals" values={faction.goals} />
        <ChipRow label="Beliefs" values={faction.beliefs} />
        <ChipRow label="Resources" values={faction.resources} />
        <ChipRow label="Locations" values={faction.locations} />
        <ChipRow label="Members" values={faction.members} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
