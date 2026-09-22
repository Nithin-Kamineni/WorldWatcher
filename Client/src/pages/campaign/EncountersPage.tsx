import { useParams, useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { EncountersSection } from '../../components/dm/EncountersSection';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';

/** The Encounters page - this campaign's own encounter library.
 *
 * It used to be half of a two-screen page shared with random tables, selected by `?view=`
 * (checklist R4). Both halves are real pages with real rail buttons now, so the only thing
 * `?view=` still does here is forward the old link shapes: anything asking for the table side
 * lands on /tables instead of 404-ing or, worse, quietly showing the wrong screen. */
export function EncountersPage() {
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedView = searchParams.get('view');
  const openEncounterId = searchParams.get('encounter') ?? undefined;
  const openNew = searchParams.get('new') === '1';

  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const campaign = getCampaignById(campaigns, campaignId);

  if (!worldId || !campaignId) return <Navigate to="/dashboard" replace />;

  // Legacy: /encounters?view=random_tables (and the older ?view=generators) were how the Play
  // page's windows and any saved bookmark reached the table browser.
  if (requestedView === 'random_tables' || requestedView === 'generators') {
    const table = searchParams.get('table');
    return <Navigate to={`/w/${worldId}/c/${campaignId}/tables${table ? `?table=${table}` : ''}`} replace />;
  }

  return (
    <SectionLayout worldId={worldId} campaignId={campaignId}>
      <Breadcrumbs
        items={[
          { label: world?.name ?? '…', to: `/w/${worldId}/home` },
          { label: campaign?.name ?? '…', to: `/w/${worldId}/c/${campaignId}/home` },
          { label: 'Encounters' },
        ]}
      />
      <EncountersSection
        campaignId={campaignId}
        openEncounterId={openEncounterId}
        openNew={openNew}
        onGoToTables={() => navigate(`/w/${worldId}/c/${campaignId}/tables`)}
      />
    </SectionLayout>
  );
}
