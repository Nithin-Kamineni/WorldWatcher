import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { usePaneDrag, PANE_DRAG_TYPE } from './paneDrag';
import type { PaneSlot } from './playLayoutTrees';

/** One height for every pane header in the workspace. The Items window's tab strip set the bar
 * here (it was the only one that looked deliberate), and matching it everywhere is what makes
 * the panes read as one grid instead of three differently-chromed boxes. */
export const PANE_HEADER_HEIGHT = 40;

/** The close-button props PaneWindow hands down to whichever panel it renders, which the panel
 * forwards straight to its PaneHeader. Declared once and shared so a panel cannot quietly
 * accept two of the three and drop the rest (which is exactly how the "locked layout" tooltip
 * went missing the first time). */
export interface PaneCloseProps {
  onClose?: () => void;
  closeDisabled?: boolean;
  closeTooltip?: string;
}

interface PaneHeaderProps extends PaneCloseProps {
  /** Which pane this header belongs to - makes the header the drag handle for that pane. */
  slot: PaneSlot;
  /** Leading control, conventionally the WindowKindSwitcher. */
  leading?: ReactNode;
  /** Header title. Truncates with an ellipsis rather than wrapping - a long session-note name
   * must not push the tag and the actions onto a second line. */
  title?: string;
  /** Rendered in place of `title` (the Items window puts its tab strip here). */
  center?: ReactNode;
  /** Right-hand controls, in order. A kind tag belongs at the head of this list so it sits
   * immediately left of the first action button. */
  actions?: ReactNode;
}

/** The shared chrome at the top of every Play pane: a fixed-height row carrying the window-kind
 * switcher, a truncating title, that window's own actions and a close button - and doubling as
 * the pane's drag handle, so a DM can pick any window up by its header and swap it with another
 * (see paneDrag.tsx). */
export function PaneHeader({ slot, leading, title, center, actions, onClose, closeTooltip, closeDisabled }: PaneHeaderProps) {
  const { enabled, draggingSlot, beginDrag, endDrag } = usePaneDrag();
  const dragging = draggingSlot === slot;

  return (
    <Stack
      direction="row"
      draggable={enabled}
      onDragStart={(e) => {
        if (!enabled) return;
        e.dataTransfer.setData(PANE_DRAG_TYPE, slot);
        e.dataTransfer.effectAllowed = 'move';
        beginDrag(slot);
      }}
      onDragEnd={endDrag}
      sx={{
        alignItems: 'stretch',
        height: PANE_HEADER_HEIGHT,
        minHeight: PANE_HEADER_HEIGHT,
        flexShrink: 0,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'action.hover',
        opacity: dragging ? 0.45 : 1,
        cursor: enabled ? 'grab' : 'default',
        '&:active': enabled ? { cursor: 'grabbing' } : undefined,
      }}
    >
      {enabled && (
        <Tooltip title="Drag to swap this window with another">
          <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.5, color: 'text.disabled' }}>
            <DragIndicatorIcon sx={{ fontSize: 16 }} />
          </Box>
        </Tooltip>
      )}
      {leading && (
        <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5, mr: 0.25, borderRight: 1, borderColor: 'divider' }}>{leading}</Box>
      )}

      {center ?? (
        <Stack direction="row" sx={{ alignItems: 'center', flexGrow: 1, minWidth: 0, pl: 0.75 }}>
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, minWidth: 0 }}>
            {title}
          </Typography>
        </Stack>
      )}

      <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', flexShrink: 0, pr: 0.5, pl: 0.5 }}>
        {actions}
        {onClose && (
          <Tooltip title={closeTooltip ?? 'Close this window'}>
            <span>
              <IconButton size="small" onClick={onClose} disabled={closeDisabled}>
                <CloseIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );
}
