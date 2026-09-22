import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { ShortcutsSettingsDialog } from '../../components/settings/ShortcutsSettingsDialog';
import { RailLabelsSettingItem } from '../../components/settings/RailLabelsSettingItem';
import { UiScaleSettingItem } from '../../components/settings/UiScaleSettingItem';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';
import { PageTitle } from '../../components/shell/PageTitle';

const SECTIONS = ['Players / Invites', 'Publishing', 'Campaign settings'];

export function CampaignSettingsPage() {
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>();
  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const campaign = getCampaignById(campaigns, campaignId);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  if (!worldId || !campaignId) return <Navigate to="/dashboard" replace />;

  return (
    <SectionLayout worldId={worldId} campaignId={campaignId}>
      <Breadcrumbs items={[{ label: world?.name ?? '…', to: `/w/${worldId}/home` }, { label: campaign?.name ?? '…', to: `/w/${worldId}/c/${campaignId}/home` }, { label: 'Settings' }]} />
      <PageTitle sx={{ mb: 2 }}>Campaign settings</PageTitle>
      <Paper variant="outlined" sx={{ borderRadius: 3, maxWidth: 480, overflow: 'hidden' }}>
        <List disablePadding>
          <UiScaleSettingItem />
          <RailLabelsSettingItem />
          <ListItemButton onClick={() => setShortcutsOpen(true)}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <KeyboardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Keyboard shortcuts" secondary="Customize map & combat hotkeys" />
            <ChevronRightIcon fontSize="small" color="disabled" />
          </ListItemButton>
          {SECTIONS.map((label) => (
            <ListItemButton key={label} disabled>
              <ListItemText primary={label} />
              <Box>
                <Chip label="Soon" size="small" variant="outlined" />
              </Box>
            </ListItemButton>
          ))}
        </List>
      </Paper>

      <ShortcutsSettingsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </SectionLayout>
  );
}
