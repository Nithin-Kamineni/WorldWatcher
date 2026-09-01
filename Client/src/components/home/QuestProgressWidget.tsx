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

const DUMMY_TRACKS = [
  { label: 'Main Quest: The Sundered Crown', done: 3, total: 7 },
  { label: 'Side Quest: Missing Caravan', done: 1, total: 3 },
  { label: 'Faction: Silver Hand standing', done: 4, total: 5 },
];

/** Quest tracking progress - reads real objective counts from `useQuestStore` when an active
 * campaign has quests with objectives (cheap: the store is already fetched elsewhere and this
 * just derives counts), and falls back to static dummy tracks otherwise. Static data is
 * explicitly fine per issue 7b. */
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
  const hasRealQuests = !!campaignId && realTracks.length > 0;

  const tracks = hasRealQuests ? realTracks : DUMMY_TRACKS;

  return (
    <WidgetCard title="Quest progress" icon={<AssignmentIcon fontSize="small" />}>
      {!hasRealQuests && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
          Placeholder - start tracking quests in a campaign to see real progress
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
