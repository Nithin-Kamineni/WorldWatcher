import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import PublicIcon from '@mui/icons-material/Public';
import CastleIcon from '@mui/icons-material/Castle';
import ShieldIcon from '@mui/icons-material/Shield';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { WidgetCard } from './WidgetCard';

interface AppStat {
  label: string;
  value: string;
  icon: typeof PublicIcon;
}

/** Static mock app-usage stats (issue 7c) - there's no real analytics collection yet, so
 * these are clearly-labeled placeholder numbers rather than a live source. */
const STATS: AppStat[] = [
  { label: 'Worlds created', value: '12', icon: PublicIcon },
  { label: 'Campaigns run', value: '27', icon: CastleIcon },
  { label: 'Tokens placed this week', value: '340', icon: ShieldIcon },
  { label: 'Articles written', value: '184', icon: MenuBookIcon },
];

export function AppStatsWidget() {
  return (
    <WidgetCard title="App stats" icon={<QueryStatsIcon fontSize="small" />}>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
        Placeholder - live usage analytics aren&apos;t collected yet
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Stack key={stat.label} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Icon sx={{ fontSize: 20, color: 'primary.main' }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {stat.value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stat.label}
                </Typography>
              </Box>
            </Stack>
          );
        })}
      </Box>
    </WidgetCard>
  );
}
