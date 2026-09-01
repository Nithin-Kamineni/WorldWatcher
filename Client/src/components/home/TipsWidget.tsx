import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LightbulbIcon from '@mui/icons-material/LightbulbOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { WidgetCard } from './WidgetCard';
import { HOME_TIPS, type HomeTipAudience } from '../../types/homeTips';

const ROTATE_INTERVAL_MS = 7000;

const AUDIENCE_LABEL: Record<HomeTipAudience, string> = {
  player: 'Player tip',
  dm: 'DM tip',
  app: 'App tip',
};

const AUDIENCE_COLOR: Record<HomeTipAudience, 'info' | 'secondary' | 'primary'> = {
  player: 'info',
  dm: 'secondary',
  app: 'primary',
};

/** Rotating tips slideshow - same auto-advance + manual prev/next rotation UX as
 * `ArticleGridStage` (see its `ROTATE_INTERVAL_MS`), applied to the static tip bank in
 * `types/homeTips.ts` instead of articles. */
export function TipsWidget() {
  const [index, setIndex] = useState(0);

  const advance = (direction: 1 | -1) => {
    setIndex((prev) => (prev + direction + HOME_TIPS.length) % HOME_TIPS.length);
  };

  useEffect(() => {
    const timer = setInterval(() => advance(1), ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const tip = HOME_TIPS[index];

  return (
    <WidgetCard title="Tips" icon={<LightbulbIcon fontSize="small" />}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
        <Box>
          <Chip label={AUDIENCE_LABEL[tip.audience]} size="small" color={AUDIENCE_COLOR[tip.audience]} variant="outlined" sx={{ mb: 1.5 }} />
          <Typography variant="body2">{tip.text}</Typography>
        </Box>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
          <IconButton size="small" onClick={() => advance(-1)} aria-label="Previous tip">
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" color="text.secondary">
            {index + 1} / {HOME_TIPS.length}
          </Typography>
          <IconButton size="small" onClick={() => advance(1)} aria-label="Next tip">
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </WidgetCard>
  );
}
