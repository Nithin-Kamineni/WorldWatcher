import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import BorderLeftIcon from '@mui/icons-material/BorderLeft';
import BorderRightIcon from '@mui/icons-material/BorderRight';
import BorderTopIcon from '@mui/icons-material/BorderTop';
import BorderBottomIcon from '@mui/icons-material/BorderBottom';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import { SECTION_HEADER_HEIGHT, useIsTruncated } from '../../../theme/headerScale';
import { usePaneDrag, PANE_DRAG_TYPE } from './paneDrag';
import type { ItemsSurface, SplitDirection } from './playLayoutTrees';

/** One height for every pane header in the workspace. The Items window's tab strip set the bar
 * here (it was the only one that looked deliberate), and matching it everywhere is what makes
 * the panes read as one grid instead of three differently-chromed boxes.
 *
 * It is now the app's ONE header scale rather than Play's own - SECTION_HEADER_HEIGHT is the
 * source, and SectionHeader gives the same row to panels outside Play (checklist I-U1). */
export const PANE_HEADER_HEIGHT = SECTION_HEADER_HEIGHT;

/** The four ways to split a pane, in the order they read on screen. */
const SPLIT_ACTIONS = [
  { side: 'right' as const, label: 'Split right', icon: BorderRightIcon },
  { side: 'down' as const, label: 'Split down', icon: BorderBottomIcon },
  { side: 'left' as const, label: 'Split left', icon: BorderLeftIcon },
  { side: 'up' as const, label: 'Split up', icon: BorderTopIcon },
];

/** The chrome props PaneWindow hands down to whichever panel it renders, which the panel
 * forwards straight to its PaneHeader. Declared once and shared so a panel cannot quietly
 * accept two of them and drop the rest (which is exactly how the "locked layout" tooltip went
 * missing the first time).
 *
 * Collapse lives here rather than on ChatPanel now: it used to be a chat-only affordance, which
 * is what made it read as a confusing second flavour of Close (checklist I-P11). */
export interface PaneCloseProps {
  onClose?: () => void;
  closeDisabled?: boolean;
  closeTooltip?: string;
  /** Shrinks this pane to a strip. Omitted only where collapsing makes no sense (an empty
   * placeholder, and the map page's Reference sidebar, which is not in a split). */
  onCollapse?: () => void;
  /** Which way this pane's parent split runs - decides which way the collapse chevron points
   * (a row split shrinks width, a column split shrinks height). */
  parentDirection?: SplitDirection;
}

interface PaneHeaderProps extends PaneCloseProps {
  /** Which pane this header belongs to - makes the header the drag handle for that pane. */
  slot: ItemsSurface;
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
export function PaneHeader({
  slot,
  leading,
  title,
  center,
  actions,
  onClose,
  closeTooltip,
  closeDisabled,
  onCollapse,
  parentDirection = 'row',
}: PaneHeaderProps) {
  const { enabled, draggingSlot, beginDrag, endDrag, slots, labelForSlot, swap, split } = usePaneDrag();
  const dragging = draggingSlot === slot;

  // The handle is a real button with a menu, not decoration. Native HTML5 drag is mouse-only:
  // there was no keyboard path to move a window and no touch fallback, and it is also why
  // Playwright's real mouse cannot drive it (checklist I-P2 / E12). Picking a target from a
  // menu covers keyboard, touch and "I would rather not drag" in one control, and reuses the
  // same swap the drop path calls.
  const [moveAnchor, setMoveAnchor] = useState<HTMLElement | null>(null);
  const swapTargets = slots.filter((other) => other !== slot);
  // The Items window puts its tab strip in `center` and has no `title`, so name it the way the
  // swap menu names every other pane rather than falling back to "this window".
  const moveLabel = title ?? (slot === 'map' ? 'this window' : labelForSlot(slot));

  // Whether the title is actually clipped right now - shared with SectionHeader so every
  // truncating header in the app measures itself the same way.
  const [titleRef, truncated] = useIsTruncated<HTMLSpanElement>(title);

  return (
    <Stack
      direction="row"
      draggable={enabled}
      onDragStart={(e) => {
        // 'map' is the map page's Reference sidebar, which never sits inside a
        // PaneDragProvider - `enabled` is false there, so the narrowing is belt-and-braces.
        if (!enabled || slot === 'map') return;
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
        <>
          <Tooltip title="Move or split this window - drag it, or click for split and swap options">
            <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.25 }}>
              <IconButton
                size="small"
                aria-label={`Move or split ${moveLabel}`}
                aria-haspopup="menu"
                aria-expanded={moveAnchor ? true : undefined}
                disabled={slot === 'map'}
                onClick={(event) => setMoveAnchor(event.currentTarget)}
                sx={{ color: 'text.disabled', p: 0.25 }}
              >
                <DragIndicatorIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          </Tooltip>
          <Menu anchorEl={moveAnchor} open={!!moveAnchor} onClose={() => setMoveAnchor(null)}>
            {/* Splitting from a MENU, not only by dragging to an edge: it is the same reasoning
                as the swap items above - a menu item works from the keyboard and on a touch
                screen, where a drag to a pane edge does not (checklist I-P1 / I-P2). */}
            {SPLIT_ACTIONS.map(({ side, label, icon: Icon }) => (
              <MenuItem
                key={side}
                onClick={() => {
                  setMoveAnchor(null);
                  if (slot !== 'map') split(slot, side);
                }}
              >
                <ListItemIcon>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={label} />
              </MenuItem>
            ))}
            {swapTargets.length > 0 && <Divider />}
            {swapTargets.map((other) => (
              <MenuItem
                key={other}
                onClick={() => {
                  setMoveAnchor(null);
                  if (slot !== 'map') swap(slot, other);
                }}
              >
                <ListItemText inset primary={`Swap with ${labelForSlot(other)}`} />
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
      {leading && (
        <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5, mr: 0.25, borderRight: 1, borderColor: 'divider' }}>{leading}</Box>
      )}

      {center ?? (
        <Stack direction="row" sx={{ alignItems: 'center', flexGrow: 1, minWidth: 0, pl: 0.75 }}>
          {/* The title truncates rather than wrapping, so a long session-note name is only
              readable through this tooltip - and only when it is actually cut off, so a short
              title does not sprout a redundant hover label (checklist P12). */}
          <Tooltip title={truncated && title ? title : ''} enterDelay={400}>
            <Typography
              ref={titleRef}
              variant="subtitle2"
              noWrap
              sx={{ fontWeight: 700, minWidth: 0 }}
            >
              {title}
            </Typography>
          </Tooltip>
        </Stack>
      )}

      <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', flexShrink: 0, pr: 0.5, pl: 0.5 }}>
        {actions}
        {onCollapse && (
          <Tooltip title="Collapse this window to a strip">
            <IconButton size="small" aria-label={`Collapse ${moveLabel}`} onClick={onCollapse}>
              <UnfoldLessIcon fontSize="small" sx={{ transform: parentDirection === 'row' ? 'rotate(90deg)' : 'none' }} />
            </IconButton>
          </Tooltip>
        )}
        {onClose && (
          <Tooltip title={closeTooltip ?? 'Close this window'}>
            <span>
              <IconButton
                size="small"
                aria-label={closeTooltip ?? (title ? `Close ${title}` : 'Close this window')}
                onClick={onClose}
                disabled={closeDisabled}
              >
                <CloseIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );
}
