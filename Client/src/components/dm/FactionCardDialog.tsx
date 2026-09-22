import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DescriptionIcon from '@mui/icons-material/Description';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import { StatBox, ChipList, FieldBlock } from './CreatureStatBlockDialog';
import { useArticleStore, getArticleForLinkedEntity } from '../../store/useArticleStore';
import { getFactionInfluenceOption, type Faction } from '../../types/faction';

interface FactionCardDialogProps {
  open: boolean;
  faction: Faction | null;
  onClose: () => void;
  /** World this dialog is rendered under, if any - gates the view/add-article button in the
   * header, since a linked article only makes sense within a world. Mirrors
   * CreatureStatBlockDialog's `worldId`. */
  worldId?: string;
  onViewArticle?: (faction: Faction, articleId: string) => void;
  onAddArticle?: (faction: Faction) => void;
}

/** The read-only faction card - the Faction counterpart to CreatureStatBlockDialog's NPC
 * card, and deliberately built from that card's own exported blocks (StatBox / ChipList /
 * FieldBlock) so the two read as the same kind of object.
 *
 * Note what this is *not*: FactionDetailPanel, the diplomacy graph's side panel, is a
 * pairwise "this faction vs. the centered one" comparison tied to a FactionRelation. This is
 * the single-faction view, so the four 0-100 strength stats show as a compact numeric row
 * here rather than as that panel's two-row comparison bars. */
export function FactionCardDialog({ open, faction, onClose, worldId, onViewArticle, onAddArticle }: FactionCardDialogProps) {
  const articles = useArticleStore((s) => s.articles);

  if (!faction) return null;

  const linkedArticle = getArticleForLinkedEntity(articles, worldId, 'faction', faction.id);
  const influence = getFactionInfluenceOption(faction.influence);
  /** Faction stores its itemized fields as real string[], while ChipList takes the
   * newline-joined form the NPC card's fields use - joining here reuses that renderer
   * instead of adding a second chip-list implementation. */
  const asChipValue = (items: string[]) => items.join('\n');
  /** 0 means "none recorded" for these four, and StatBox already hides empty values - so map
   * 0 to undefined and let an unfilled faction show a short card instead of a row of zeros. */
  const orHidden = (value: number) => value || undefined;
  const hasStats = [faction.power, faction.military, faction.naval, faction.economy, faction.reputation].some((v) => v > 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {faction.imageSrc ? <Avatar src={faction.imageSrc} alt={faction.name} /> : <Avatar>{faction.name.charAt(0)}</Avatar>}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {faction.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {faction.factionType || 'Faction'}
              {faction.governance ? `, ${faction.governance}` : ''}
            </Typography>
          </Box>
          {worldId &&
            (linkedArticle ? (
              <Tooltip title="View article">
                <IconButton size="small" onClick={() => onViewArticle?.(faction, linkedArticle.id)}>
                  <DescriptionIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Add article">
                <IconButton size="small" onClick={() => onAddArticle?.(faction)}>
                  <NoteAddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ))}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Chip size="small" color="primary" label={`${influence.label} influence`} />
          {faction.factionType && <Chip size="small" variant="outlined" label={faction.factionType} />}
          {faction.members.length > 0 && (
            <Chip size="small" variant="outlined" label={`${faction.members.length} notable member${faction.members.length === 1 ? '' : 's'}`} />
          )}
        </Stack>

        {hasStats && (
          <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-around', mb: 2, flexWrap: 'wrap', rowGap: 1.5 }}>
            <StatBox label="Power" value={faction.powerLabel || orHidden(faction.power)} />
            <StatBox label="Military" value={orHidden(faction.military)} />
            <StatBox label="Naval" value={orHidden(faction.naval)} />
            <StatBox label="Economy" value={orHidden(faction.economy)} />
            <StatBox label="Reputation" value={orHidden(faction.reputation)} />
          </Stack>
        )}

        {(faction.description || faction.goals.length > 0 || faction.beliefs.length > 0) && <Divider sx={{ mb: 1.5 }} />}

        <FieldBlock label="Description" value={faction.description} />
        <ChipList label="Goals" value={asChipValue(faction.goals)} />
        <ChipList label="Beliefs" value={asChipValue(faction.beliefs)} />
        <ChipList label="Resources" value={asChipValue(faction.resources)} />
        <ChipList label="Notable members" value={asChipValue(faction.members)} />
        <ChipList label="Locations" value={asChipValue(faction.locations)} />
        <FieldBlock label="Base of operations" value={faction.locationSummary} />
        <FieldBlock label="Notes" value={faction.notes} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
