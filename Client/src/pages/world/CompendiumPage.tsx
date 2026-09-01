import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { ComingSoon } from '../../components/shell/ComingSoon';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { CompendiumSection } from '../../components/dm/CompendiumSection';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useWorldStore, getWorldById, getPrimaryCampaignForWorld } from '../../store/useWorldStore';
import { useCampaignStore } from '../../store/useCampaignStore';

export function CompendiumPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const [searchParams] = useSearchParams();
  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const primaryCampaign = getPrimaryCampaignForWorld(campaigns, worldId);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <SectionLayout worldId={worldId!}>
      <Breadcrumbs items={[{ label: world?.name ?? '…' }, { label: 'Compendium' }]} />
      {primaryCampaign ? (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Showing homebrew scoped to {primaryCampaign.name}, plus the shared SRD library.
          </Typography>
          <CompendiumSection
            campaignId={primaryCampaign.id}
            worldId={worldId}
            openCreatureId={searchParams.get('creature') ?? undefined}
            openSpellId={searchParams.get('spell') ?? undefined}
            openItemId={searchParams.get('item') ?? undefined}
          />
        </>
      ) : (
        <Box sx={{ mt: 2 }}>
          <ComingSoon
            icon={<MenuBookIcon sx={{ fontSize: 56 }} />}
            title="No campaign yet"
            description="Create a campaign in this world to browse and manage its Compendium."
          />
        </Box>
      )}
    </SectionLayout>
  );
}
