import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import WidgetsOutlinedIcon from '@mui/icons-material/WidgetsOutlined';
import { PICKABLE_WINDOW_KINDS, type PlayWindowKind } from '../../../store/usePlayLayoutStore';

/** A pane kind the DM can pick. `empty` is deliberately not one of them - a pane becomes empty
 * by being closed, and fills again by being picked/dropped into. */
export type ContentWindowKind = Exclude<PlayWindowKind, 'empty'>;

export const KIND_ICONS: Record<ContentWindowKind, typeof MenuBookOutlinedIcon> = {
  session: MenuBookOutlinedIcon,
  chat: ForumOutlinedIcon,
  items: WidgetsOutlinedIcon,
};

export const KIND_LABELS: Record<ContentWindowKind, string> = {
  session: 'Session Notes',
  chat: 'DM Notes',
  items: 'Items',
};

interface WindowKindSwitcherProps {
  kind: ContentWindowKind;
  onSetKind: (kind: PlayWindowKind) => void;
  disabled?: boolean;
}

/** The elegant "change what this window shows" affordance (issues.txt 10.1) - the current
 * kind's own icon doubles as the switcher button; clicking it opens a menu of the other 2
 * kinds. Rendered by each pane content component as the leading icon in its own header. */
export function WindowKindSwitcher({ kind, onSetKind, disabled }: WindowKindSwitcherProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const CurrentIcon = KIND_ICONS[kind];

  return (
    <>
      <Tooltip title="Change window type">
        <span>
          <IconButton
            size="small"
            aria-label={`Change window type (currently ${KIND_LABELS[kind]})`}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            disabled={disabled}
          >
            <CurrentIcon fontSize="small" color="action" />
          </IconButton>
        </span>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        {PICKABLE_WINDOW_KINDS.map((k) => {
          const Icon = KIND_ICONS[k];
          return (
            <MenuItem
              key={k}
              selected={k === kind}
              onClick={() => {
                onSetKind(k);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={KIND_LABELS[k]} />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
