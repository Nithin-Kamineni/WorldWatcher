import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import { LayoutGlyph } from './LayoutGlyph';
import { ALL_LAYOUT_IDS, PLAY_LAYOUTS, QUICK_LAYOUT_IDS, type PaneSlot, type PlayLayoutId } from './playLayoutTrees';

interface PlayLayoutControlsProps {
  layoutId: PlayLayoutId;
  locked: boolean;
  /** Slots the DM has closed in the *current* layout - drawn hollow on its button so the
   * toolbar reflects what is actually on screen, not just which layout is selected. */
  closedSlots?: PaneSlot[];
  /** True when at least one pane in the current layout has had its space handed back to its
   * neighbours - enables the "bring closed windows back" button. */
  hasDismissedPanes?: boolean;
  onSelectLayout: (id: PlayLayoutId) => void;
  onToggleLock: () => void;
  onResetLayout: () => void;
  onRestorePanes?: () => void;
}

function LayoutButton({
  id,
  active,
  disabled,
  emptySlots,
  onClick,
}: {
  id: PlayLayoutId;
  active: boolean;
  disabled: boolean;
  emptySlots?: PaneSlot[];
  onClick: () => void;
}) {
  const def = PLAY_LAYOUTS[id];
  return (
    <Tooltip title={def.label}>
      <span>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={disabled}
          sx={{
            borderRadius: 1.5,
            border: 1,
            borderColor: active ? 'primary.main' : 'divider',
            bgcolor: active ? 'action.selected' : 'transparent',
            color: active ? 'primary.main' : 'text.secondary',
          }}
        >
          <LayoutGlyph layoutId={id} emptySlots={active ? emptySlots : undefined} />
        </IconButton>
      </span>
    </Tooltip>
  );
}

/** The Play workspace's layout picker + lock/reset controls, extracted out of the (now removed)
 * standalone PlayLayoutToolbar row so it can be embedded directly in the top bar on the Play
 * page instead of costing its own full-width row (issues.txt main-page point 10). No wrapper
 * Paper/back-button here - the host (TopBar) supplies its own chrome and back affordance.
 *
 * Every layout is labelled by a LayoutGlyph drawn from its own split tree rather than by a
 * hand-picked MUI icon, so the button always shows the pane arrangement it selects. */
export function PlayLayoutControls({
  layoutId,
  locked,
  closedSlots,
  hasDismissedPanes,
  onSelectLayout,
  onToggleLock,
  onResetLayout,
  onRestorePanes,
}: PlayLayoutControlsProps) {
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const otherLayouts = ALL_LAYOUT_IDS.filter((id) => !QUICK_LAYOUT_IDS.includes(id));
  const moreActive = otherLayouts.includes(layoutId);

  return (
    <>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        {QUICK_LAYOUT_IDS.map((id) => (
          <LayoutButton
            key={id}
            id={id}
            active={layoutId === id}
            disabled={locked}
            emptySlots={closedSlots}
            onClick={() => onSelectLayout(id)}
          />
        ))}

        <Tooltip title="More layouts">
          <span>
            <IconButton
              size="small"
              disabled={locked}
              onClick={(e) => setMoreAnchor(e.currentTarget)}
              sx={{
                borderRadius: 1.5,
                border: 1,
                borderColor: moreActive ? 'primary.main' : 'divider',
                bgcolor: moreActive ? 'action.selected' : 'transparent',
                color: moreActive ? 'primary.main' : 'text.secondary',
              }}
            >
              {moreActive ? <LayoutGlyph layoutId={layoutId} emptySlots={closedSlots} /> : <MoreHorizIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

      {hasDismissedPanes && onRestorePanes && (
        <Tooltip title="Bring closed windows back">
          <span>
            <IconButton size="small" onClick={onRestorePanes} disabled={locked} color="primary">
              <GridViewOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}

      <Tooltip title={locked ? 'Unlock layout' : 'Lock layout (prevents accidental changes)'}>
        <IconButton size="small" onClick={onToggleLock} color={locked ? 'primary' : 'default'}>
          {locked ? <LockIcon fontSize="small" /> : <LockOpenOutlinedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Reset this layout (sizes, closed windows and window types)">
        <span>
          <IconButton size="small" onClick={onResetLayout} disabled={locked}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Popover
        open={!!moreAnchor}
        anchorEl={moreAnchor}
        onClose={() => setMoreAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.5, width: 260 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, pb: 0.5 }}>
            More layouts
          </Typography>
          {otherLayouts.map((id) => {
            const def = PLAY_LAYOUTS[id];
            const selected = layoutId === id;
            return (
              <Stack
                key={id}
                direction="row"
                spacing={1.25}
                onClick={() => {
                  onSelectLayout(id);
                  setMoreAnchor(null);
                }}
                sx={{
                  alignItems: 'center',
                  px: 1,
                  py: 0.75,
                  borderRadius: 2,
                  cursor: 'pointer',
                  color: selected ? 'primary.main' : 'text.secondary',
                  bgcolor: selected ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <LayoutGlyph layoutId={id} emptySlots={selected ? closedSlots : undefined} size={20} />
                <Typography variant="body2" sx={{ color: 'text.primary' }}>
                  {def.label}
                </Typography>
              </Stack>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}
