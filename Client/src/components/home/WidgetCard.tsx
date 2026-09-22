import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EditIcon from '@mui/icons-material/EditOutlined';

interface WidgetCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  minHeight?: number;
}

/** Shared shell for the Home page's dashboard widgets (calendar, weather, quest progress,
 * tips, Docker/GitHub stats, app stats): a titled outlined card with a static "edit
 * placement" pencil in the top-right corner. The pencil is purely a visual affordance for a
 * future widget-layout editor - it opens a "coming soon" tooltip and does nothing else, per
 * issue 7g ("not a necessity to make it working"). */
export function WidgetCard({ title, icon, children, minHeight }: WidgetCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, borderRadius: 3, height: '100%', minHeight, display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5, pr: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {icon && <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>}
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        </Stack>
      </Stack>

      <Tooltip title="Widget layout editing coming soon">
        <span style={{ position: 'absolute', top: 8, right: 8 }}>
          <IconButton
            size="small"
            disabled
            aria-label={`Edit the ${title} widget's layout (coming soon)`}
            sx={{ '&.Mui-disabled': { color: 'text.disabled' } }}
          >
            <EditIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Box sx={{ flexGrow: 1, minHeight: 0 }}>{children}</Box>
    </Paper>
  );
}
