import { useParams } from 'react-router-dom';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { ComingSoon } from '../../components/shell/ComingSoon';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';

export function TimelinePage() {
  const { worldId } = useParams<{ worldId: string }>();
  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);

  return (
    <SectionLayout worldId={worldId!}>
      <Breadcrumbs items={[{ label: world?.name ?? '…' }, { label: 'Timeline' }]} />
      <ComingSoon
        icon={<CalendarMonthIcon sx={{ fontSize: 56 }} />}
        title="Timeline is coming soon"
        description="Eras, chronicles, and a custom calendar for tracking your world's history and session log."
        planned={['Zoomable era/event timeline, drag events to reposition', 'Event-type filters (Wars, Founding, Session log…)', 'Custom calendar: months, days/week, moons, leap rules']}
      />
    </SectionLayout>
  );
}
