import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';

/** Old campaign-first URLs (/campaigns/:campaignId[/dm][/map/:mapId]) redirect
 * here once the campaign is loaded (for its world_id), then forward into the
 * equivalent new /w/:worldId/c/:campaignId/... URL. */
export function LegacyCampaignRedirect({ suffix }: { suffix: (mapId?: string) => string }) {
  const navigate = useNavigate();
  const { campaignId, mapId } = useParams<{ campaignId: string; mapId?: string }>();
  const campaigns = useCampaignStore((s) => s.campaigns);
  const campaignsLoaded = useCampaignStore((s) => s.campaignsLoaded);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (!campaignsLoaded || !campaignId) return;
    const campaign = getCampaignById(campaigns, campaignId);
    if (campaign) {
      navigate(`/w/${campaign.worldId}/c/${campaign.id}${suffix(mapId)}`, { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignsLoaded, campaignId, mapId]);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress />
    </Box>
  );
}
