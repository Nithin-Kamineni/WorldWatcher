import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ThunderstormIcon from '@mui/icons-material/Thunderstorm';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CloudIcon from '@mui/icons-material/Cloud';
import GrainIcon from '@mui/icons-material/Grain';
import { WidgetCard } from './WidgetCard';

interface ForecastDay {
  label: string;
  icon: typeof WbSunnyIcon;
  high: string;
}

/** Static mock in-world weather - fantasy flavor text, not a real forecast. Dummy data per
 * issue 7c since there's no weather-simulation feature. */
const FORECAST: ForecastDay[] = [
  { label: 'Tomorrow', icon: CloudIcon, high: 'Overcast, mild winds off the coast' },
  { label: 'In 2 days', icon: ThunderstormIcon, high: 'Storm rolling in from the Sundered Peaks' },
  { label: 'In 3 days', icon: GrainIcon, high: 'Light rain, good for travel by river' },
];

export function WeatherWidget() {
  return (
    <WidgetCard title="Weather" icon={<WbSunnyIcon fontSize="small" />}>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
        Placeholder - fantasy flavor, not real data
      </Typography>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
        <WbSunnyIcon sx={{ fontSize: 40, color: 'warning.main' }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Clear, 68°
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Calm skies over the Verdant March
          </Typography>
        </Box>
      </Stack>
      <Stack spacing={1}>
        {FORECAST.map((day) => {
          const Icon = day.icon;
          return (
            <Stack key={day.label} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ width: 72, flexShrink: 0, color: 'text.secondary' }}>
                {day.label}
              </Typography>
              <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {day.high}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </WidgetCard>
  );
}
