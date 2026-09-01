import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Encounter } from '../../types/encounter';

interface EncounterPreviewCardProps {
  open: boolean;
  encounter: Encounter | null;
  onClose: () => void;
}

/** Read-only @-mention preview card for an Encounter - EncounterFormDialog is create/edit-only
 * (has an onSubmit), so this is a small dedicated read view instead of repurposing it. */
export function EncounterPreviewCard({ open, encounter, onClose }: EncounterPreviewCardProps) {
  if (!encounter) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {encounter.name}
        {encounter.challengeRating && <Chip label={`CR ${encounter.challengeRating}`} size="small" sx={{ ml: 1 }} />}
      </DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
          {encounter.theme && <Chip label={encounter.theme} size="small" variant="outlined" />}
          {encounter.encounterType && <Chip label={encounter.encounterType} size="small" variant="outlined" />}
        </Stack>
        {encounter.description && (
          <Typography variant="body2" sx={{ mb: 1.5, whiteSpace: 'pre-wrap' }}>
            {encounter.description}
          </Typography>
        )}
        {encounter.possibleLocations && encounter.possibleLocations.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Possible Locations
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {encounter.possibleLocations.map((loc, i) => (
                <Chip key={i} label={loc} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>
        )}
        {encounter.tags.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {encounter.tags.map((tag, i) => (
              <Chip key={i} label={tag} size="small" />
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
