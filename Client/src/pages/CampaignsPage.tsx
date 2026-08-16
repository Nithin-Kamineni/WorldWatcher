import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { AppShell } from '../components/layout/AppShell';
import { CampaignCard } from '../components/campaigns/CampaignCard';
import { useCampaignStore } from '../store/useCampaignStore';

export function CampaignsPage() {
  const navigate = useNavigate();
  const campaigns = useCampaignStore((state) => state.campaigns);
  const campaignsLoading = useCampaignStore((state) => state.campaignsLoading);
  const campaignsLoaded = useCampaignStore((state) => state.campaignsLoaded);
  const fetchCampaigns = useCampaignStore((state) => state.fetchCampaigns);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <AppShell>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Campaigns
      </Typography>
      {campaignsLoading && !campaignsLoaded ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 3,
          }}
        >
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onClick={() => navigate(`/campaigns/${campaign.id}`)}
            />
          ))}
        </Box>
      )}
    </AppShell>
  );
}
