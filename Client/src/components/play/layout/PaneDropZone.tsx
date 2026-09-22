import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { alpha } from '@mui/material/styles';
import { usePaneDrag, PANE_DRAG_TYPE } from './paneDrag';
import type { PaneSlot } from './playLayoutTrees';

interface PaneDropZoneProps {
  slot: PaneSlot;
  /** Shown in the snap hint - "Swap with DM Notes". */
  label: string;
}

/** The snap target for pane drag-and-drop. It exists only while a pane is actually in flight,
 * so it never sits on top of a window the DM is trying to use, and it covers the whole pane
 * rather than a thin edge - the panes *are* the snap grid here, and dropping on one trades the
 * two windows' places. Hovering tints the pane so the swap is visible before the mouse is
 * released. */
export function PaneDropZone({ slot, label }: PaneDropZoneProps) {
  const { draggingSlot, hoverSlot, setHoverSlot, dropOn } = usePaneDrag();
  if (draggingSlot === null || draggingSlot === slot) return null;
  const over = hoverSlot === slot;

  return (
    <Box
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!over) setHoverSlot(slot);
      }}
      onDragLeave={() => {
        if (over) setHoverSlot(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        // Only a drag that started on a pane header may rearrange the workspace.
        if (!e.dataTransfer.types.includes(PANE_DRAG_TYPE)) return;
        dropOn(slot);
      }}
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 6,
        borderRadius: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color .12s, box-shadow .12s',
        // Mode-aware: the same 22% primary that reads as a clear snap tint over a light pane
        // barely registers over a dark one, so dark mode gets a stronger wash (checklist I-U5).
        bgcolor: (theme) => (over ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.34 : 0.2) : 'transparent'),
        boxShadow: (theme) => (over ? `inset 0 0 0 2px ${theme.palette.primary.main}` : 'none'),
      }}
    >
      {over && (
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            alignItems: 'center',
            px: 1.25,
            py: 0.75,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            boxShadow: 3,
          }}
        >
          <SwapHorizIcon fontSize="small" />
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Swap with {label}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
