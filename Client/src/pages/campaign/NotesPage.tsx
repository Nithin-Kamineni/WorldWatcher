import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Stack from '@mui/material/Stack';
import FolderIcon from '@mui/icons-material/FolderOutlined';
import RouteIcon from '@mui/icons-material/Route';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { ComingSoon } from '../../components/shell/ComingSoon';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { NotesFolderExplorer } from '../../components/notes/NotesFolderExplorer';
import { QuestsSection } from '../../components/dm/QuestsSection';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';

type NotesTab = 'folders' | 'plots' | 'quests';

export function NotesPage() {
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as NotesTab | null) ?? 'folders';

  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const campaign = getCampaignById(campaigns, campaignId);

  if (!worldId || !campaignId) return <Navigate to="/dashboard" replace />;

  const setTab = (next: NotesTab) =>
    setSearchParams((prev) => {
      if (next === 'folders') prev.delete('tab');
      else prev.set('tab', next);
      return prev;
    });

  return (
    <SectionLayout worldId={worldId} campaignId={campaignId}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Breadcrumbs
          items={[
            { label: world?.name ?? '…', to: `/w/${worldId}/home` },
            { label: campaign?.name ?? '…', to: `/w/${worldId}/c/${campaignId}/home` },
            { label: 'Notes' },
          ]}
        />
        <ToggleButtonGroup size="small" exclusive value={tab} onChange={(_e, v) => v && setTab(v)}>
          <ToggleButton value="folders">
            <FolderIcon fontSize="small" sx={{ mr: 0.5 }} /> Folders
          </ToggleButton>
          <ToggleButton value="plots">
            <RouteIcon fontSize="small" sx={{ mr: 0.5 }} /> Plots
          </ToggleButton>
          <ToggleButton value="quests">
            <ListAltIcon fontSize="small" sx={{ mr: 0.5 }} /> Quests
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {tab === 'folders' && <NotesFolderExplorer campaignId={campaignId} />}

      {tab === 'plots' && (
        <ComingSoon
          icon={<RouteIcon sx={{ fontSize: 56 }} />}
          title="Plots is coming soon"
          description="Your campaign's module outline - break the story into Acts, Chapters, and Scenes."
          planned={[
            'Acts → Chapters → Scenes outline, drag to reorder',
            'Each scene templated: Goal, Hook, Stakes, Beats',
            'Link scenes to Locations, NPCs, Encounters, Quests',
          ]}
        />
      )}

      {tab === 'quests' && <QuestsSection campaignId={campaignId} worldId={worldId} />}
    </SectionLayout>
  );
}
