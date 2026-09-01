import { useEffect, useState } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { WidgetCard } from './WidgetCard';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

const DOCKER_HUB_URL = 'https://hub.docker.com/v2/repositories/nihtin/worldwatcher/';

/** Response shape confirmed by curling the endpoint directly (public, unauthenticated) - only
 * the fields this widget uses are declared. */
interface DockerHubRepo {
  pull_count: number;
  star_count: number;
  last_updated: string;
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: DockerHubRepo };

export function DockerStatsWidget() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(DOCKER_HUB_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Docker Hub responded ${res.status}`);
        return res.json();
      })
      .then((data: DockerHubRepo) => {
        if (!cancelled) setState({ status: 'ok', data });
      })
      .catch((err) => {
        console.error('Failed to load Docker Hub stats', err);
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WidgetCard title="Docker Hub" icon={<CloudDownloadIcon fontSize="small" />}>
      {state.status === 'loading' && (
        <Stack sx={{ alignItems: 'center', justifyContent: 'center', height: '100%', py: 2 }}>
          <CircularProgress size={20} />
        </Stack>
      )}
      {state.status === 'error' && (
        <Typography variant="body2" color="text.secondary">
          Docker Hub stats unavailable right now.
        </Typography>
      )}
      {state.status === 'ok' && (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {state.data.pull_count.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              pulls
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            nihtin/worldwatcher · updated {formatRelativeTime(Date.parse(state.data.last_updated))}
          </Typography>
        </Stack>
      )}
    </WidgetCard>
  );
}
