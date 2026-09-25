import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Tooltip from '@mui/material/Tooltip';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useShellStore } from '../../store/useShellStore';
import { RightPanelUtilityStrip } from './RightPanelUtilityStrip';
import { RIGHT_PANEL_WIDTH, RIGHT_PANEL_ICON_ONLY_WIDTH } from '../../theme/layout';

/** Shared look for both the "expand" (collapsed state) and "collapse" (open state) floating
 * arrows - same size/transparency/hover behavior, only the side, rounding and icon differ, so
 * they read as one consistent affordance at the same vertical position either way. */
const floatingArrowSx = {
  position: 'absolute' as const,
  top: '50%',
  width: 20,
  height: 52,
  bgcolor: 'action.selected',
  color: 'text.secondary',
  opacity: 0.35,
  transition: 'opacity 150ms ease, background-color 150ms ease, color 150ms ease',
  zIndex: 2,
  '&:hover': { opacity: 1, bgcolor: 'action.hover', color: 'text.primary' },
};

interface RightPanelProps {
  worldId?: string;
  children?: ReactNode;
}

export function RightPanel({ worldId, children }: RightPanelProps) {
  const open = useShellStore((s) => s.rightPanelOpen);
  const toggle = useShellStore((s) => s.toggleRightPanel);

  if (!open) {
    // Zero-width flex item - the toggle itself is an absolutely-positioned floating arrow
    // pinned to this edge, so it never claims any of the horizontal layout space a full-height
    // rail would (issues.txt: "will not occupy space in any page, will be just floating").
    return (
      <Box sx={{ width: 0, flexShrink: 0, position: 'relative', display: { xs: 'none', md: 'block' } }}>
        <Tooltip title="Show details panel" placement="left">
          <ButtonBase
            onClick={toggle}
            sx={{
              ...floatingArrowSx,
              right: 0,
              transform: 'translateY(-50%)',
              borderRadius: '4px 0 0 4px',
            }}
          >
            <ChevronLeftIcon fontSize="small" />
          </ButtonBase>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: children ? RIGHT_PANEL_WIDTH : RIGHT_PANEL_ICON_ONLY_WIDTH,
        flexShrink: 0,
        borderLeft: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Mirrors the collapsed state's floating arrow - same vertical position, opposite side
          and direction, so there's a hide affordance right where the show one was. */}
      <Tooltip title="Hide details panel" placement="left">
        <ButtonBase
          onClick={toggle}
          sx={{
            ...floatingArrowSx,
            left: 0,
            transform: 'translateY(-50%)',
            borderRadius: '4px',
          }}
        >
          <ChevronRightIcon fontSize="small" />
        </ButtonBase>
      </Tooltip>

      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflowY: 'auto',
          p: children ? 2 : 0,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {children}
      </Box>
      <RightPanelUtilityStrip worldId={worldId} />
    </Box>
  );
}
