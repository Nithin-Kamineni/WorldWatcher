import { useEffect, useState } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import GitHubIcon from '@mui/icons-material/GitHub';
import StarIcon from '@mui/icons-material/StarBorder';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import BugReportIcon from '@mui/icons-material/BugReport';
import { WidgetCard } from './WidgetCard';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

const REPO_URL = 'https://api.github.com/repos/Nithin-Kamineni/WorldWatcher';
const LATEST_RELEASE_URL = `${REPO_URL}/releases/latest`;

/** Response shapes confirmed by curling both endpoints directly - only the fields this widget
 * uses are declared. `releases/latest` 404s when the repo has no releases yet, which is
 * expected (not an error state) and handled separately from a real fetch failure. */
interface GithubRepo {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
}

interface GithubRelease {
  tag_name: string;
  name: string | null;
  published_at: string;
  assets: { download_count: number }[];
}

type RepoState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: GithubRepo };
type ReleaseState = { status: 'loading' } | { status: 'error' } | { status: 'none' } | { status: 'ok'; data: GithubRelease };

export function GithubStatsWidget() {
  const [repoState, setRepoState] = useState<RepoState>({ status: 'loading' });
  const [releaseState, setReleaseState] = useState<ReleaseState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(REPO_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
        return res.json();
      })
      .then((data: GithubRepo) => {
        if (!cancelled) setRepoState({ status: 'ok', data });
      })
      .catch((err) => {
        console.error('Failed to load GitHub repo stats', err);
        if (!cancelled) setRepoState({ status: 'error' });
      });

    fetch(LATEST_RELEASE_URL)
      .then((res) => {
        if (res.status === 404) return null; // no releases yet - expected, not an error
        if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
        return res.json();
      })
      .then((data: GithubRelease | null) => {
        if (cancelled) return;
        setReleaseState(data ? { status: 'ok', data } : { status: 'none' });
      })
      .catch((err) => {
        console.error('Failed to load GitHub release stats', err);
        if (!cancelled) setReleaseState({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WidgetCard title="GitHub" icon={<GitHubIcon fontSize="small" />}>
      {repoState.status === 'loading' && (
        <Stack sx={{ alignItems: 'center', justifyContent: 'center', height: '100%', py: 2 }}>
          <CircularProgress size={20} />
        </Stack>
      )}
      {repoState.status === 'error' && (
        <Typography variant="body2" color="text.secondary">
          GitHub stats unavailable right now.
        </Typography>
      )}
      {repoState.status === 'ok' && (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={2.5}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <StarIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {repoState.data.stargazers_count}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <ForkRightIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {repoState.data.forks_count}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <BugReportIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {repoState.data.open_issues_count}
              </Typography>
            </Stack>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            last commit {formatRelativeTime(Date.parse(repoState.data.pushed_at))}
          </Typography>

          <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
            {releaseState.status === 'ok' && (
              <Typography variant="caption" color="text.secondary">
                Latest release {releaseState.data.name ?? releaseState.data.tag_name}
                {releaseState.data.assets.length > 0 &&
                  ` · ${releaseState.data.assets.reduce((sum, a) => sum + a.download_count, 0)} downloads`}
              </Typography>
            )}
            {releaseState.status === 'none' && (
              <Typography variant="caption" color="text.disabled">
                No releases published yet
              </Typography>
            )}
            {releaseState.status === 'error' && (
              <Typography variant="caption" color="text.disabled">
                Release info unavailable
              </Typography>
            )}
          </Box>
        </Stack>
      )}
    </WidgetCard>
  );
}
