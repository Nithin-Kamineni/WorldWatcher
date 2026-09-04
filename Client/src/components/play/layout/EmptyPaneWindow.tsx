import { useState } from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import AddIcon from '@mui/icons-material/Add';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import { KIND_ICONS, KIND_LABELS } from './WindowKindSwitcher';
import { PICKABLE_WINDOW_KINDS, type PlayWindowKind } from '../../../store/usePlayLayoutStore';

interface EmptyPaneWindowProps {
  /** Puts a window kind into this space. */
  onPickKind: (kind: PlayWindowKind) => void;
  /** Gives this space back to the neighbouring panes - the "I meant to shrink the layout"
   * half of closing a window. Omitted when this is the only pane left. */
  onDismiss?: () => void;
  /** True while a pane is being dragged over the workspace - the placeholder says so instead
   * of repeating its buttons, since the drop is about to fill it. */
  dragActive: boolean;
}

/** What a closed pane leaves behind: held-open space rather than a silently reflowed layout.
 * The DM can drop another window into it (PaneDropZone handles that), pick a window kind for
 * it, or hand its space back to the neighbours - which is what actually changes the layout. */
export function EmptyPaneWindow({ onPickKind, onDismiss, dragActive, locked }: EmptyPaneWindowProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <Paper
      variant="outlined"
      sx={{
        width: '100%',
        height: '100%',
        borderRadius: 1.5,
        borderStyle: 'dashed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        bgcolor: 'transparent',
      }}
    >
      <Stack spacing={1.25} sx={{ alignItems: 'center', px: 2, textAlign: 'center', minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          Empty window
        </Typography>
        {dragActive ? (
          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
            Drop a window here
          </Typography>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary">
              Drag a window here by its header, or put one in.
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', justifyContent: 'center' }} useFlexGap>
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={(e) => setAnchorEl(e.currentTarget)}>
                Add window
              </Button>
              {onDismiss && (
                <Button size="small" color="inherit" startIcon={<UnfoldLessIcon />} onClick={onDismiss}>
                  Give space back
                </Button>
              )}
            </Stack>
          </>
        )}
      </Stack>

      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        {PICKABLE_WINDOW_KINDS.map((kind) => {
          const Icon = KIND_ICONS[kind];
          return (
            <MenuItem
              key={kind}
              onClick={() => {
                onPickKind(kind);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={KIND_LABELS[kind]} />
            </MenuItem>
          );
        })}
      </Menu>
    </Paper>
  );
}
