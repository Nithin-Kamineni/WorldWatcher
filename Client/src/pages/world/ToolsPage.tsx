import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import TableRowsIcon from '@mui/icons-material/TableRows';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { ComingSoon } from '../../components/shell/ComingSoon';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';

export function ToolsPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);

  return (
    <SectionLayout worldId={worldId!}>
      <Breadcrumbs items={[{ label: world?.name ?? '…' }, { label: 'Tools' }]} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 3 }}>
        <ComingSoon
          icon={<AccountTreeIcon sx={{ fontSize: 48 }} />}
          title="Content Trees"
          description="Tech trees, magic schools, ancestry lineages - node graphs linked to your entries."
        />
        <ComingSoon
          icon={<DashboardCustomizeIcon sx={{ fontSize: 48 }} />}
          title="Whiteboard"
          description="An infinite canvas for sticky notes, shapes, and embedded entry cards."
        />
        <ComingSoon
          icon={<TableRowsIcon sx={{ fontSize: 48 }} />}
          title="Rollable Tables"
          description="Weighted dice tables that chain into other tables or entries."
          note="Random Encounter Tables already exist for this campaign - see Encounters."
        />
      </Box>
    </SectionLayout>
  );
}
