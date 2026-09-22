import type { ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import type { SplitDirection } from './playLayoutTrees';

interface CollapsedPaneStripProps {
  direction: SplitDirection;
  /** What this pane is showing, e.g. "DM Notes" - so a collapsed strip still says what it is. */
  label: string;
  icon: ReactNode;
  onExpand: () => void;
}

/** A collapsed pane: a thin strip with its icon, its name and an expand button - collapsing
 * horizontally when its parent split is a row (narrow, full-height strip - needs vertical text),
 * vertically when a column (short, full-width strip - stays horizontal). The label is built as
 * one normal horizontal row and rotated as a whole - cheaper than fighting `writing-mode` and
 * avoids compounding it with the icon's own rotation, which is what made the old arrows look off.
 *
 * This was CollapsedChatStrip, and collapse was a chat-only affordance sitting confusingly
 * beside a generic Close that did something else entirely (checklist I-P11). Collapse is now
 * available on every pane: "shrink this to the edge, I still want it" and "remove this window"
 * are different intentions, and only one of them was reachable for a notes or Items pane. */
export function CollapsedPaneStrip({ direction, label, icon, onExpand }: CollapsedPaneStripProps) {
  const vertical = direction === 'row';

  const content = (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', whiteSpace: 'nowrap' }}>
      <Tooltip title={`Expand ${label}`}>
        <IconButton
          size="small"
          aria-label={`Expand ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
        >
          <UnfoldMoreIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {icon}
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );

  return (
    <Paper
      variant="outlined"
      onClick={onExpand}
      sx={{
        width: '100%',
        height: '100%',
        borderRadius: 1.5,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        bgcolor: 'action.hover',
        '&:hover': { bgcolor: 'action.selected' },
      }}
    >
      <Box sx={vertical ? { transform: 'rotate(-90deg)' } : undefined}>{content}</Box>
    </Paper>
  );
}
