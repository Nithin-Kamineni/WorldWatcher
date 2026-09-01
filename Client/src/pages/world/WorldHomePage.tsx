import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { CampaignsSection } from '../../components/home/CampaignsSection';
import { ResumeCard } from '../../components/home/ResumeCard';
import { CalendarWidget } from '../../components/home/CalendarWidget';
import { WeatherWidget } from '../../components/home/WeatherWidget';
import { QuestProgressWidget } from '../../components/home/QuestProgressWidget';
import { TipsWidget } from '../../components/home/TipsWidget';
import { DockerStatsWidget } from '../../components/home/DockerStatsWidget';
import { GithubStatsWidget } from '../../components/home/GithubStatsWidget';
import { AppStatsWidget } from '../../components/home/AppStatsWidget';
import { useWorldStore, getWorldById, getCampaignsForWorld } from '../../store/useWorldStore';
import { useCampaignStore } from '../../store/useCampaignStore';
import { useNavMemoryStore } from '../../store/useNavMemoryStore';

export function WorldHomePage() {
  const { worldId } = useParams<{ worldId: string }>();
  const worlds = useWorldStore((s) => s.worlds);
  const worldsLoaded = useWorldStore((s) => s.worldsLoaded);
  const fetchWorlds = useWorldStore((s) => s.fetchWorlds);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const activeCampaignByWorldId = useNavMemoryStore((s) => s.activeCampaignByWorldId);

  useEffect(() => {
    fetchWorlds();
    fetchCampaigns();
  }, [fetchWorlds, fetchCampaigns]);

  const world = getWorldById(worlds, worldId);
  const worldCampaigns = getCampaignsForWorld(campaigns, worldId);

  if (!world) {
    if (!worldsLoaded) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      );
    }
    return <Navigate to="/dashboard" replace />;
  }

  const activeCampaignId = activeCampaignByWorldId[world.id];

  return (
    <SectionLayout worldId={world.id}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        {world.name}
      </Typography>
      {world.description && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
          {world.description}
        </Typography>
      )}

      <ResumeCard worldId={world.id} />

      <CampaignsSection worldId={world.id} worldName={world.name} worldCampaigns={worldCampaigns} activeCampaignId={activeCampaignId} />

      <Typography variant="h6" sx={{ fontWeight: 700, mt: 5, mb: 2 }}>
        Dashboard
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 2,
        }}
      >
        <TipsWidget />
        <CalendarWidget />
        <WeatherWidget />
        <QuestProgressWidget campaignId={activeCampaignId} />
        <GithubStatsWidget />
        <DockerStatsWidget />
        <AppStatsWidget />
      </Box>
    </SectionLayout>
  );
}
