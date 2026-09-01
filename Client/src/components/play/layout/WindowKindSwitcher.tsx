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
import type { PlayWindowKind } from '../../../store/usePlayLayoutStore';

const KIND_ICONS: Record<PlayWindowKind, typeof MenuBookOutlinedIcon> = {
  session: MenuBookOutlinedIcon,
  chat: ForumOutlinedIcon,
  items: WidgetsOutlinedIcon,
};

const KIND_LABELS: Record<PlayWindowKind, string> = {
  session: 'Session Notes',
  chat: 'DM Notes',
  items: 'Items',
};

const KIND_ORDER: PlayWindowKind[] = ['session', 'items', 'chat'];

interface WindowKindSwitcherProps {
  kind: PlayWindowKind;
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
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} disabled={disabled}>
            <CurrentIcon fontSize="small" color="action" />
          </IconButton>
        </span>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        {KIND_ORDER.map((k) => {
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
