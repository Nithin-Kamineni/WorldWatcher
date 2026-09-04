import { useEffect, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import { TokenThumbnail } from '../../map/TokenThumbnail';
import { CreatureExpandedDetails } from '../../dm/CreatureExpandedDetails';
import { useCreatureStore } from '../../../store/useCreatureStore';
import type { Creature } from '../../../types/creature';

interface EncounterCreatureRowProps {
  /** The library creature this roster line references, or null for a one-off inline entry
   * that has no card to open (EncounterCreatureEntry.creatureId). */
  creatureId: string | null;
  name: string;
  imageSrc: string;
  /** Right-hand annotation - "x3" for a mob, an attitude chip for an NPC. */
  trailing?: ReactNode;
  /** Already-loaded copy, if the caller has one (the campaign's creature list usually does). */
  creature?: Creature;
  /** Opens this creature in the window's Stats tab, where it gets the full-height card and
   * can be pinned for the rest of the session. */
  onOpenInStats?: () => void;
}

/** One creature/NPC line inside an expanded encounter, with its stat card one click away.
 *
 * Reading an encounter's roster is the moment a DM needs the stat block - it was previously a
 * dead label, so the card had to be hunted down in the Stats tab by name. The card body is the
 * same CreatureExpandedDetails the Stats sub-window renders, and the roster line still offers
 * "open in Stats" for the DM who wants it pinned there instead of inline here. */
export function EncounterCreatureRow({ creatureId, name, imageSrc, trailing, creature, onOpenInStats }: EncounterCreatureRowProps) {
  const creaturesById = useCreatureStore((s) => s.creaturesById);
  const fetchCreatureById = useCreatureStore((s) => s.fetchCreatureById);
  const [open, setOpen] = useState(false);

  const resolved = creature ?? (creatureId ? creaturesById[creatureId] : undefined);

  // Only fetched on demand: an encounter with a dozen distinct creatures should not fire a
  // dozen requests just because its roster is on screen.
  useEffect(() => {
    if (open && creatureId && !resolved) void fetchCreatureById(creatureId);
  }, [open, creatureId, resolved, fetchCreatureById]);

  const canOpen = !!creatureId;

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        onClick={canOpen ? () => setOpen((v) => !v) : undefined}
        sx={{
          alignItems: 'center',
          borderRadius: 1,
          px: 0.5,
          py: 0.25,
          cursor: canOpen ? 'pointer' : 'default',
          '&:hover': canOpen ? { bgcolor: 'action.hover' } : undefined,
        }}
      >
        <TokenThumbnail src={imageSrc} name={name} size={22} />
        <Typography variant="caption" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
          {name}
        </Typography>
        {trailing}
        {canOpen && onOpenInStats && (
          <Tooltip title="Open in the Stats tab">
            <IconButton
              size="small"
              sx={{ p: 0.25 }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenInStats();
              }}
            >
              <AssignmentIndOutlinedIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        )}
        {canOpen && (
          <Tooltip title={open ? 'Hide stat card' : 'Show stat card'}>
            <ExpandMoreIcon
              sx={{ fontSize: 16, color: 'text.disabled', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
            />
          </Tooltip>
        )}
      </Stack>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1, py: 0.75, mb: 0.5, borderLeft: 2, borderColor: 'divider' }}>
          {resolved ? (
            <CreatureExpandedDetails creature={resolved} />
          ) : (
            <LinearProgress />
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
