import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { WidgetCard } from './WidgetCard';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Static month grid + a sample "next session" line - there is no in-world calendar or
 * session schedule yet (Timeline is still coming soon), so the card is titled "(coming soon)"
 * and can be switched off in Settings > Home dashboard widgets. */
export function CalendarWidget() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <WidgetCard title="Calendar" icon={<CalendarMonthIcon fontSize="small" />} comingSoon>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        {monthLabel}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 1.5 }}>
        {WEEKDAYS.map((d, i) => (
          <Typography key={i} variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            {d}
          </Typography>
        ))}
        {cells.map((day, i) => (
          <Box
            key={i}
            sx={{
              textAlign: 'center',
              borderRadius: 1,
              py: 0.4,
              fontSize: 12,
              ...(day === today && { bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 700 }),
            }}
          >
            {day ?? ''}
          </Box>
        ))}
      </Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Chip label="Next session" size="small" color="primary" variant="outlined" />
        <Typography variant="body2" color="text.secondary">
          Saturday, 7:00 PM
        </Typography>
      </Stack>
    </WidgetCard>
  );
}
