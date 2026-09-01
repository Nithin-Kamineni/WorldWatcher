import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MapIcon from '@mui/icons-material/Map';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';
import { useNavMemoryStore } from '../../store/useNavMemoryStore';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

interface ResumeCardProps {
  worldId: string;
}

/** World Home's Resume card (issue 7i) - replaces the old Campaign Home page's Resume Paper,
 * scoped to whichever campaign in this world was last active (`activeCampaignByWorldId`)
 * rather than requiring a visit to a campaign-specific hub page first. */
export function ResumeCard({ worldId }: ResumeCardProps) {
  const navigate = useNavigate();
  const campaigns = useCampaignStore((s) => s.campaigns);
  const activeCampaignByWorldId = useNavMemoryStore((s) => s.activeCampaignByWorldId);
  const lastLocation = useNavMemoryStore((s) => s.lastLocation);
  const lastVisitedMap = useNavMemoryStore((s) => s.lastVisitedMap);

  const activeCampaignId = activeCampaignByWorldId[worldId];
  const campaign = getCampaignById(campaigns, activeCampaignId);

  if (!campaign || !lastLocation || lastLocation.campaignId !== campaign.id) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 3,
        mb: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        borderColor: 'success.main',
      }}
    >
      <Box>
        <Typography variant="overline" color="success.main">
          Resume
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {campaign.name} — {lastLocation.sectionLabel}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          last visited {formatRelativeTime(lastLocation.visitedAt)}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1.5}>
        {lastVisitedMap && lastVisitedMap.campaignId === campaign.id && (
          <Tooltip title={`Jump straight to ${lastVisitedMap.mapName}`}>
            <Button
              variant="outlined"
              color="success"
              startIcon={<MapIcon />}
              onClick={() => navigate(`/w/${worldId}/c/${campaign.id}/maps/${lastVisitedMap.mapId}`)}
            >
              Maps
            </Button>
          </Tooltip>
        )}
        <Button variant="contained" color="success" startIcon={<PlayArrowIcon />} onClick={() => navigate(lastLocation.path)}>
          Continue
        </Button>
      </Stack>
    </Paper>
  );
}
