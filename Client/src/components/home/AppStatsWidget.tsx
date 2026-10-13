import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import PublicIcon from '@mui/icons-material/Public';
import CastleIcon from '@mui/icons-material/Castle';
import MapIcon from '@mui/icons-material/Map';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { WidgetCard } from './WidgetCard';
import { useWorldStore, getCampaignsForWorld } from '../../store/useWorldStore';
import { useCampaignStore } from '../../store/useCampaignStore';
import { useArticleStore, getArticlesForWorld } from '../../store/useArticleStore';

interface AppStat {
  label: string;
  /** null while the count is still loading - rendered as a dash, never as a made-up number */
  value: number | null;
  icon: typeof PublicIcon;
}

/** Counts of the DM's own content, read from the same stores the rest of the app uses: every
 * world, this world's campaigns, its World Manager entries, and the battle maps across its
 * campaigns. It used to be four hardcoded numbers; nothing here is sampled or estimated. */
export function AppStatsWidget({ worldId }: { worldId: string }) {
  const worlds = useWorldStore((s) => s.worlds);
  const worldsLoaded = useWorldStore((s) => s.worldsLoaded);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const campaignsLoaded = useCampaignStore((s) => s.campaignsLoaded);
  const mapsByCampaignId = useCampaignStore((s) => s.mapsByCampaignId);
  const mapsLoadedByCampaignId = useCampaignStore((s) => s.mapsLoadedByCampaignId);
  const fetchMapsForCampaign = useCampaignStore((s) => s.fetchMapsForCampaign);
  const articles = useArticleStore((s) => s.articles);
  const loadedWorldIds = useArticleStore((s) => s.loadedWorldIds);
  const ensureSeeded = useArticleStore((s) => s.ensureSeeded);

  const worldCampaigns = getCampaignsForWorld(campaigns, worldId);
  const campaignIdsKey = worldCampaigns.map((c) => c.id).join(',');

  useEffect(() => {
    void ensureSeeded(worldId);
  }, [worldId, ensureSeeded]);

  useEffect(() => {
    for (const id of campaignIdsKey ? campaignIdsKey.split(',') : []) {
      if (!useCampaignStore.getState().mapsLoadedByCampaignId[id]) void fetchMapsForCampaign(id);
    }
  }, [campaignIdsKey, fetchMapsForCampaign]);

  const mapsLoaded = worldCampaigns.every((c) => mapsLoadedByCampaignId[c.id]);
  const mapCount = worldCampaigns.reduce((sum, c) => sum + (mapsByCampaignId[c.id]?.length ?? 0), 0);

  const stats: AppStat[] = [
    { label: 'Worlds', value: worldsLoaded ? worlds.length : null, icon: PublicIcon },
    { label: 'Campaigns in this world', value: campaignsLoaded ? worldCampaigns.length : null, icon: CastleIcon },
    {
      label: 'World Manager entries',
      value: loadedWorldIds.includes(worldId) ? getArticlesForWorld(articles, worldId).length : null,
      icon: MenuBookIcon,
    },
    { label: 'Battle maps', value: campaignsLoaded && mapsLoaded ? mapCount : null, icon: MapIcon },
  ];

  return (
    <WidgetCard title="App stats" icon={<QueryStatsIcon fontSize="small" />}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Stack key={stat.label} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Icon sx={{ fontSize: 20, color: 'primary.main' }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {stat.value ?? '—'}
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
