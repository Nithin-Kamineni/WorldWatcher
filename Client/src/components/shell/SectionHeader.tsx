import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { SECTION_HEADER_HEIGHT, useIsTruncated } from '../../theme/headerScale';

interface SectionHeaderProps {
  /** Leading icon, conventionally the same one the panel's rail button uses. */
  icon?: ReactNode;
  /** Truncates with an ellipsis rather than wrapping, and only then carries a tooltip. */
  title: string;
  /** Right-hand controls, in order. */
  actions?: ReactNode;
}

/** The shared chrome at the top of a panel: a fixed 40px row (theme/headerScale.ts) carrying an
 * optional icon, a truncating title and that panel's own actions - the non-draggable sibling of
 * Play's PaneHeader, with the same height, background and bottom border so the two read as one
 * system rather than as two independently-styled boxes (checklist I-U1). */
export function SectionHeader({ icon, title, actions }: SectionHeaderProps) {
  const [titleRef, truncated] = useIsTruncated<HTMLSpanElement>(title);

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        height: SECTION_HEADER_HEIGHT,
        minHeight: SECTION_HEADER_HEIGHT,
        flexShrink: 0,
        px: 1.25,
        gap: 0.75,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'action.hover',
      }}
    >
      {icon && <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>{icon}</Box>}
      <Tooltip title={truncated ? title : ''} enterDelay={400}>
        <Typography ref={titleRef} variant="subtitle2" noWrap sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0 }}>
          {title}
        </Typography>
      </Tooltip>
      {actions && (
        <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
