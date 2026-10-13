import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { WidgetCard } from './WidgetCard';
import { useQuestStore, getQuestsForCampaign } from '../../store/useQuestStore';
import { questProgress } from '../../types/quest';

interface QuestProgressWidgetProps {
  campaignId?: string;
}

/** Quest tracking progress - real objective counts from `useQuestStore` for the active
 * campaign. When there is nothing to show it says so, rather than inventing sample quests
 * (it used to fall back to three made-up tracks, which read as the DM's own). */
export function QuestProgressWidget({ campaignId }: QuestProgressWidgetProps) {
  const questsByCampaignId = useQuestStore((s) => s.questsByCampaignId);
  const fetchQuestsForCampaign = useQuestStore((s) => s.fetchQuestsForCampaign);

  useEffect(() => {
    if (campaignId) fetchQuestsForCampaign(campaignId);
  }, [campaignId, fetchQuestsForCampaign]);

  const quests = getQuestsForCampaign(questsByCampaignId, campaignId);
  const realTracks = quests
    .filter((q) => q.status === 'active' || q.status === 'not_started')
    .map((q) => ({ label: q.name, ...questProgress(q.objectives) }))
    .filter((t) => t.total > 0)
    .slice(0, 4);
  const tracks = campaignId ? realTracks : [];

  return (
    <WidgetCard title="Quest progress" icon={<AssignmentIcon fontSize="small" />}>
      {tracks.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {campaignId
            ? 'No active quests with objectives in this campaign yet. Add objectives to a quest to track it here.'
            : 'Open a campaign to see its quest progress here.'}
        </Typography>
      )}
      <Stack spacing={1.75}>
        {tracks.map((track) => (
          <Box key={track.label}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: 1 }}>
                {track.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {track.done}/{track.total}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={track.total > 0 ? (track.done / track.total) * 100 : 0}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        ))}
      </Stack>
    </WidgetCard>
  );
}
