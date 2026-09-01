import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNewOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface PinnableItemRowProps {
  icon?: ReactNode;
  title: string;
  /** Short key-facts line shown in collapsed form (issues.txt 10.c.3e/4a: e.g. "Palace · 4
   * columns", "CR 3 · 4 creatures · Forest") - keeps the sub-window scannable without expanding
   * every row. */
  tagline: string;
  pinned: boolean;
  onTogglePin: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenNewTab?: () => void;
  children?: ReactNode;
}

/** The shared collapsed/expanded row shell for all 4 Items sub-windows - one consistent visual
 * language (tagline header + pin/expand/open-in-new-tab affordances) instead of 4 bespoke
 * list-item designs, per issues.txt 10.c.3b/3e/3f and 4a/4b/5a/6. */
export function PinnableItemRow({ icon, title, tagline, pinned, onTogglePin, expanded, onToggleExpand, onOpenNewTab, children }: PinnableItemRowProps) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.25, overflow: 'hidden', mb: 0.75 }}>
      <Stack
        direction="row"
        spacing={1}
        onClick={onToggleExpand}
        sx={{ alignItems: 'center', px: 1.25, py: 0.9, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
      >
        {icon}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {tagline}
          </Typography>
        </Box>
        {onOpenNewTab && (
          <Tooltip title="Open in new tab">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onOpenNewTab();
              }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={pinned ? 'Unpin' : 'Pin'}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            color={pinned ? 'primary' : 'default'}
          >
            {pinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <ExpandMoreIcon fontSize="small" sx={{ color: 'text.disabled', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </Stack>
      {expanded && children && (
        <Box sx={{ px: 1.25, pb: 1.25, pt: 0.25, borderTop: 1, borderColor: 'divider' }}>{children}</Box>
      )}
    </Paper>
  );
}
