import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { EncountersSection, type EncounterView } from '../../components/dm/EncountersSection';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';

export function EncountersPage() {
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get('view') as EncounterView | null) ?? 'menu';
  const openEncounterId = searchParams.get('encounter') ?? undefined;

  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const campaign = getCampaignById(campaigns, campaignId);

  if (!worldId || !campaignId) return <Navigate to="/dashboard" replace />;

  const setView = (next: EncounterView) =>
    setSearchParams((prev) => {
      if (next === 'menu') prev.delete('view');
      else prev.set('view', next);
      return prev;
    });

  return (
    <SectionLayout worldId={worldId} campaignId={campaignId}>
      <Breadcrumbs items={[{ label: world?.name ?? '…', to: `/w/${worldId}/home` }, { label: campaign?.name ?? '…', to: `/w/${worldId}/c/${campaignId}/home` }, { label: 'Encounters' }]} />
      <EncountersSection campaignId={campaignId} view={view} onViewChange={setView} openEncounterId={openEncounterId} />
    </SectionLayout>
  );
}
