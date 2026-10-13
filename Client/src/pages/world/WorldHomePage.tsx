import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TuneIcon from '@mui/icons-material/Tune';
import { Link as RouterLink } from 'react-router-dom';
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
import { WorldCoverHero } from '../../components/home/WorldCoverHero';
import { HOME_WIDGETS, useHomeWidgetsStore, type HomeWidgetId } from '../../store/useHomeWidgetsStore';
import { useWorldStore, getWorldById, getCampaignsForWorld } from '../../store/useWorldStore';
import { useCampaignStore } from '../../store/useCampaignStore';
import { useNavMemoryStore } from '../../store/useNavMemoryStore';
import { SectionTitle } from '../../components/shell/PageTitle';

export function WorldHomePage() {
  const { worldId } = useParams<{ worldId: string }>();
  const worlds = useWorldStore((s) => s.worlds);
  const worldsLoaded = useWorldStore((s) => s.worldsLoaded);
  const fetchWorlds = useWorldStore((s) => s.fetchWorlds);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const activeCampaignByWorldId = useNavMemoryStore((s) => s.activeCampaignByWorldId);
  const hiddenWidgets = useHomeWidgetsStore((s) => s.hidden);

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

  const renderWidget = (id: HomeWidgetId) => {
    switch (id) {
      case 'tips':
        return <TipsWidget key={id} />;
      case 'quests':
        return <QuestProgressWidget key={id} campaignId={activeCampaignId} />;
      case 'appStats':
        return <AppStatsWidget key={id} worldId={world.id} />;
      case 'github':
        return <GithubStatsWidget key={id} />;
      case 'docker':
        return <DockerStatsWidget key={id} />;
      case 'calendar':
        return <CalendarWidget key={id} />;
      case 'weather':
        return <WeatherWidget key={id} />;
    }
  };
  const visibleWidgets = HOME_WIDGETS.filter((w) => !hiddenWidgets.includes(w.id));

  return (
    <SectionLayout worldId={world.id}>
      <WorldCoverHero world={world} />

      <ResumeCard worldId={world.id} />

      <CampaignsSection worldId={world.id} worldName={world.name} worldCampaigns={worldCampaigns} activeCampaignId={activeCampaignId} />

      <Stack direction="row" sx={{ mt: 5, mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionTitle>Dashboard</SectionTitle>
        <Button
          size="small"
          startIcon={<TuneIcon fontSize="small" />}
          component={RouterLink}
          to={`/w/${world.id}/settings?section=widgets`}
        >
          Customize
        </Button>
      </Stack>
      {visibleWidgets.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Every widget is switched off - turn some back on under Customize.
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 2,
          }}
        >
          {visibleWidgets.map((w) => renderWidget(w.id))}
        </Box>
      )}
    </SectionLayout>
  );
}
