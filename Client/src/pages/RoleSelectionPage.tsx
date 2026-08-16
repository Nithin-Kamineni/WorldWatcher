import { useEffect } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import CastleIcon from '@mui/icons-material/Castle';
import PersonIcon from '@mui/icons-material/Person';
import { AppShell } from '../components/layout/AppShell';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { useCampaignStore, getCampaignById } from '../store/useCampaignStore';

export function RoleSelectionPage() {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  const campaigns = useCampaignStore((state) => state.campaigns);
  const campaignsLoaded = useCampaignStore((state) => state.campaignsLoaded);
  const fetchCampaigns = useCampaignStore((state) => state.fetchCampaigns);
  const campaign = getCampaignById(campaigns, campaignId);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  if (!campaign) {
    if (!campaignsLoaded) {
      return (
        <AppShell>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        </AppShell>
      );
    }
    return <Navigate to="/campaigns" replace />;
  }

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: 'Campaigns', to: '/campaigns' }, { label: campaign.name }]} />
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        {campaign.name}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        How would you like to join this session?
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
        <RoleOption
          icon={<CastleIcon sx={{ fontSize: 48 }} color="primary" />}
          label="Dungeon Master"
          description="Manage maps and run the encounter"
          onClick={() => navigate(`/campaigns/${campaign.id}/dm`)}
        />
        <RoleOption
          icon={<PersonIcon sx={{ fontSize: 48 }} color="disabled" />}
          label="Player"
          description="Coming soon"
          onClick={() => {}}
        />
      </Stack>
    </AppShell>
  );
}

interface RoleOptionProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}

function RoleOption({ icon, label, description, onClick }: RoleOptionProps) {
  return (
    <ButtonBase onClick={onClick} sx={{ borderRadius: 4, display: 'block', width: { xs: '100%', sm: 240 } }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          borderRadius: 4,
          textAlign: 'center',
          transition: 'transform 160ms ease',
          '&:hover': { transform: 'translateY(-4px)' },
        }}
      >
        <Box sx={{ mb: 2 }}>{icon}</Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Paper>
    </ButtonBase>
  );
}
