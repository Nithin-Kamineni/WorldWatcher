import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import type { SplitDirection } from './playLayoutTrees';

interface CollapsedChatStripProps {
  direction: SplitDirection;
  onExpand: () => void;
}

/** The chat-only collapsed state (issues.txt 8.4) - a thin strip with just an icon and an
 * expand button, collapsing horizontally when its parent split is a row (narrow, full-height
 * strip - needs vertical text), vertically when a column (short, full-width strip - stays
 * horizontal). The label is built as one normal horizontal row and rotated as a whole -
 * cheaper than fighting `writing-mode` and avoids compounding it with the icon's own
 * rotation, which is what made the old arrows look off. */
export function CollapsedChatStrip({ direction, onExpand }: CollapsedChatStripProps) {
  const vertical = direction === 'row';

  const label = (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', whiteSpace: 'nowrap' }}>
      <Tooltip title="Expand DM Notes">
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
        >
          <UnfoldMoreIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <ForumOutlinedIcon fontSize="small" color="action" />
      <Typography variant="caption" color="text.secondary">
        DM Notes
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
      <Box sx={vertical ? { transform: 'rotate(-90deg)' } : undefined}>{label}</Box>
    </Paper>
  );
}
