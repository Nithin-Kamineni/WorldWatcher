import { useParams, useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { RandomTablesSection } from '../../components/dm/randomTables/RandomTablesSection';

/** The Random Tables page - the roll-me-something half of what used to be the Encounters page
 * (checklist R4).
 *
 * `disableContentPadding` because the body is the full-bleed category graph browser, which
 * manages its own scrolling and floats its filter bar over the canvas; the shell's padded,
 * overflow:auto container would box it in and give it a second scrollbar. */
export function TablesPage() {
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const openTableId = searchParams.get('table') ?? undefined;

  if (!worldId || !campaignId) return <Navigate to="/dashboard" replace />;

  // Legacy: the encounter half was ?view=management on this URL's predecessor, and a bookmark
  // or an open Play window may still ask for it.
  if (searchParams.get('view') === 'management') {
    return <Navigate to={`/w/${worldId}/c/${campaignId}/encounters`} replace />;
  }

  return (
    <SectionLayout worldId={worldId} campaignId={campaignId} disableContentPadding>
      <RandomTablesSection
        campaignId={campaignId}
        worldId={worldId}
        openTableId={openTableId}
        onGoToEncounters={() => navigate(`/w/${worldId}/c/${campaignId}/encounters`)}
      />
    </SectionLayout>
  );
}
