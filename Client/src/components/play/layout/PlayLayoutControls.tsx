import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import CheckBoxOutlineBlankOutlinedIcon from '@mui/icons-material/CheckBoxOutlineBlankOutlined';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';
import ViewWeekOutlinedIcon from '@mui/icons-material/ViewWeekOutlined';
import ViewQuiltOutlinedIcon from '@mui/icons-material/ViewQuiltOutlined';
import ViewComfyOutlinedIcon from '@mui/icons-material/ViewComfyOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { ALL_LAYOUT_IDS, PLAY_LAYOUTS, QUICK_LAYOUT_IDS, type PlayLayoutId, type PlayLayoutIconKey } from './playLayoutTrees';

const LAYOUT_ICONS: Record<PlayLayoutIconKey, typeof CheckBoxOutlineBlankOutlinedIcon> = {
  single: CheckBoxOutlineBlankOutlinedIcon,
  'double-row': ViewColumnOutlinedIcon,
  'double-col': ViewAgendaOutlinedIcon,
  'triple-even': ViewWeekOutlinedIcon,
  'triple-half': ViewQuiltOutlinedIcon,
  quad: ViewComfyOutlinedIcon,
};

interface PlayLayoutControlsProps {
  layoutId: PlayLayoutId;
  locked: boolean;
  onSelectLayout: (id: PlayLayoutId) => void;
  onToggleLock: () => void;
  onResetLayout: () => void;
}

function LayoutButton({
  id,
  active,
  disabled,
  onClick,
}: {
  id: PlayLayoutId;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const def = PLAY_LAYOUTS[id];
  const Icon = LAYOUT_ICONS[def.iconKey];
  return (
    <Tooltip title={def.label}>
      <span>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={disabled}
          sx={{
            border: 1,
            borderColor: active ? 'primary.main' : 'divider',
            bgcolor: active ? 'action.selected' : 'transparent',
            color: active ? 'primary.main' : 'text.secondary',
          }}
        >
          <Icon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}

/** The Play workspace's layout picker + lock/reset controls, extracted out of the (now removed)
 * standalone PlayLayoutToolbar row so it can be embedded directly in the top bar on the Play
 * page instead of costing its own full-width row (issues.txt main-page point 10). No wrapper
 * Paper/back-button here - the host (TopBar) supplies its own chrome and back affordance. */
export function PlayLayoutControls({ layoutId, locked, onSelectLayout, onToggleLock, onResetLayout }: PlayLayoutControlsProps) {
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const otherLayouts = ALL_LAYOUT_IDS.filter((id) => !QUICK_LAYOUT_IDS.includes(id));
  const moreActive = otherLayouts.includes(layoutId);

  return (
    <>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        {QUICK_LAYOUT_IDS.map((id) => (
          <LayoutButton key={id} id={id} active={layoutId === id} disabled={locked} onClick={() => onSelectLayout(id)} />
        ))}

        <Tooltip title="More layouts">
          <span>
            <IconButton
              size="small"
              disabled={locked}
              onClick={(e) => setMoreAnchor(e.currentTarget)}
              sx={{
                border: 1,
                borderColor: moreActive ? 'primary.main' : 'divider',
                bgcolor: moreActive ? 'action.selected' : 'transparent',
                color: moreActive ? 'primary.main' : 'text.secondary',
              }}
            >
              <MoreHorizIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

      <Tooltip title={locked ? 'Unlock layout' : 'Lock layout (prevents accidental changes)'}>
        <IconButton size="small" onClick={onToggleLock} color={locked ? 'primary' : 'default'}>
          {locked ? <LockIcon fontSize="small" /> : <LockOpenOutlinedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Reset layout sizes">
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
        <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.5, width: 240 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, pb: 0.5 }}>
            More layouts
          </Typography>
          {otherLayouts.map((id) => {
            const def = PLAY_LAYOUTS[id];
            const Icon = LAYOUT_ICONS[def.iconKey];
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
                  bgcolor: layoutId === id ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Icon fontSize="small" color={layoutId === id ? 'primary' : 'action'} />
                <Typography variant="body2">{def.label}</Typography>
              </Stack>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}
