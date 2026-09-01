import { useParams } from 'react-router-dom';
import PublicIcon from '@mui/icons-material/Public';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { ComingSoon } from '../../components/shell/ComingSoon';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';

export function AtlasPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);

  return (
    <SectionLayout worldId={worldId!}>
      <Breadcrumbs items={[{ label: world?.name ?? '…' }, { label: 'Atlas' }]} />
      <ComingSoon
        icon={<PublicIcon sx={{ fontSize: 56 }} />}
        title="Atlas is coming soon"
        description="World and region maps with markers, layers, and pins linked to your NPCs, factions, and quests."
        planned={['Nested world → region → city → dungeon maps', 'Marker-group layers (Cities, Dungeons, Quests, GM notes)', 'Click a pin to preview and open the linked entry']}
        note="Today's battle maps for combat live under this campaign's Maps section."
      />
    </SectionLayout>
  );
}
