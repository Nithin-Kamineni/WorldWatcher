import { useState } from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import { KIND_ICONS, KIND_LABELS } from './WindowKindSwitcher';
import { TAB_DRAG_TYPE, decodeTabDrag } from '../items/tabDrag';
import { PICKABLE_WINDOW_KINDS, type PlayWindowKind } from '../../../store/usePlayLayoutStore';
import { primaryForeground } from '../../../theme/theme';

interface EmptyPaneWindowProps {
  /** Puts a window kind into this space. */
  onPickKind: (kind: PlayWindowKind) => void;
  /** Gives this space back to the neighbouring panes - the "I meant to shrink the layout"
   * half of closing a window. Omitted when this is the only pane left. */
  onDismiss?: () => void;
  /** True while a pane is being dragged over the workspace - the placeholder says so instead
   * of repeating its buttons, since the drop is about to fill it. */
  dragActive: boolean;
  /** Layout lock. Both actions here change the layout - filling the space and handing it back -
   * so the lock has to disable them, the same way it disables the pane header's close button. */
  locked?: boolean;
  /** The kind this pane held before it was closed. Offered as a one-click reopen, because
   * "close it to see the map, then put it back" is the common case (checklist P4). */
  rememberedKind?: Exclude<PlayWindowKind, 'empty'>;
  /** Tears an Items sub-tab off into this space: the pane becomes an Items window holding just
   * that tab, with its pins and open rows intact (checklist I-P3). */
  onTearOffTab?: (payload: { slot: string; kind: string }) => void;
}

/** What a closed pane leaves behind: held-open space rather than a silently reflowed layout.
 * The DM can drop another window into it (PaneDropZone handles that), pick a window kind for
 * it, or hand its space back to the neighbours - which is what actually changes the layout. */
export function EmptyPaneWindow({ onPickKind, onDismiss, dragActive, locked = false, rememberedKind, onTearOffTab }: EmptyPaneWindowProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [tabOver, setTabOver] = useState(false);
  const RememberedIcon = rememberedKind ? KIND_ICONS[rememberedKind] : null;
  const acceptsTab = !!onTearOffTab && !locked;

  return (
    <Paper
      variant="outlined"
      onDragOver={(e) => {
        if (!acceptsTab || !e.dataTransfer.types.includes(TAB_DRAG_TYPE)) return;
        e.preventDefault();
        setTabOver(true);
      }}
      onDragLeave={() => setTabOver(false)}
      onDrop={(e) => {
        setTabOver(false);
        if (!acceptsTab || !e.dataTransfer.types.includes(TAB_DRAG_TYPE)) return;
        e.preventDefault();
        const payload = decodeTabDrag(e.dataTransfer.getData(TAB_DRAG_TYPE));
        if (payload) onTearOffTab(payload);
      }}
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
        borderColor: tabOver ? 'primary.main' : undefined,
        boxShadow: (theme) => (tabOver ? `inset 0 0 0 2px ${theme.palette.primary.main}` : 'none'),
      }}
    >
      {/* A live region, because this placeholder APPEARS in response to an action taken
          elsewhere - closing a pane, or dragging one over it - so a screen reader user has no
          reason to be looking here when it changes (checklist I-U6). Polite, not assertive:
          it is a status, not an alert. */}
      <Stack
        role="status"
        aria-live="polite"
        spacing={1.25}
        sx={{ alignItems: 'center', px: 2, textAlign: 'center', minWidth: 0 }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          Empty window
        </Typography>
        {tabOver ? (
          <Typography variant="caption" sx={{ fontWeight: 700, color: primaryForeground }}>
            Drop to give this sub-window its own pane
          </Typography>
        ) : dragActive ? (
          <Typography variant="caption" sx={{ fontWeight: 700, color: primaryForeground }}>
            Drop a window here
          </Typography>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary">
              {locked ? 'The layout is locked.' : 'Drag a window here by its header, or put one in.'}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', justifyContent: 'center' }} useFlexGap>
              {rememberedKind && RememberedIcon && (
                <Tooltip title={locked ? 'Unlock the layout to add windows' : ''}>
                  <span>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<RememberedIcon />}
                      disabled={locked}
                      onClick={() => onPickKind(rememberedKind)}
                    >
                      Reopen {KIND_LABELS[rememberedKind]}
                    </Button>
                  </span>
                </Tooltip>
              )}
              <Tooltip title={locked ? 'Unlock the layout to add windows' : ''}>
                <span>
                  <Button
                    size="small"
                    variant={rememberedKind ? 'text' : 'outlined'}
                    startIcon={<AddIcon />}
                    disabled={locked}
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                  >
                    {rememberedKind ? 'Something else' : 'Add window'}
                  </Button>
                </span>
              </Tooltip>
              {onDismiss && (
                <Tooltip title={locked ? 'Unlock the layout to change it' : ''}>
                  <span>
                    <Button
                      size="small"
                      color="inherit"
                      startIcon={<UnfoldLessIcon />}
                      disabled={locked}
                      onClick={onDismiss}
                    >
                      Give space back
                    </Button>
                  </span>
                </Tooltip>
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
