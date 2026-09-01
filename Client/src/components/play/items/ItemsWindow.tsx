import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import CasinoIcon from '@mui/icons-material/Casino';
import ShieldIcon from '@mui/icons-material/Shield';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import { RandomTablesSubWindow } from './RandomTablesSubWindow';
import { EncountersSubWindow } from './EncountersSubWindow';
import { StatsSubWindow } from './StatsSubWindow';
import { PlacesSubWindow } from './PlacesSubWindow';
import { FactionsSubWindow } from './FactionsSubWindow';
import { usePlayItemsStore, getPlayItemsState, getSlotTabs, ITEMS_TAB_KINDS, type ItemsTabKind } from '../../../store/usePlayItemsStore';
import type { PaneSlot } from '../layout/playLayoutTrees';

const TAB_ICONS: Record<ItemsTabKind, typeof CasinoIcon> = {
  'random-tables': CasinoIcon,
  encounters: ShieldIcon,
  stats: AssignmentIndOutlinedIcon,
  places: MapOutlinedIcon,
  factions: Diversity3Icon,
};

const TAB_LABELS: Record<ItemsTabKind, string> = {
  'random-tables': 'Random Tables',
  encounters: 'Encounters',
  stats: 'Stats',
  places: 'Places',
  factions: 'Factions',
};

interface ItemsWindowProps {
  worldId: string;
  campaignId: string;
  slot: PaneSlot;
  kindSwitcher?: ReactNode;
}

/** The Items window (issues.txt 10.c) - a Chrome-tab-style strip of sub-windows (Random
 * Tables/Encounters/Stats/Places/Factions), one open by default (Random Tables). Tab open/
 * close/active state is per pane slot (usePlayItemsStore.tabsBySlot) so a quad layout's two
 * Items windows can hold different tab sets independently. */
export function ItemsWindow({ worldId, campaignId, slot, kindSwitcher }: ItemsWindowProps) {
  const byCampaignId = usePlayItemsStore((s) => s.byCampaignId);
  const openTab = usePlayItemsStore((s) => s.openTab);
  const closeTab = usePlayItemsStore((s) => s.closeTab);
  const setActiveTab = usePlayItemsStore((s) => s.setActiveTab);

  const campaignState = getPlayItemsState(byCampaignId, campaignId);
  const slotTabs = getSlotTabs(campaignState, slot);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const closableKinds = ITEMS_TAB_KINDS.filter((k) => !slotTabs.kinds.includes(k));

  return (
    <Paper
      variant="outlined"
      sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 1.5, overflow: 'hidden' }}
    >
      <Stack direction="row" sx={{ alignItems: 'stretch', borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover', minHeight: 40 }}>
        {kindSwitcher && (
          <Box sx={{ display: 'flex', alignItems: 'center', pl: 1, pr: 1, borderRight: 1, borderColor: 'divider' }}>{kindSwitcher}</Box>
        )}
        <Stack direction="row" sx={{ overflow: 'hidden', minWidth: 0, alignItems: 'flex-end', pt: 0.5 }}>
          {slotTabs.kinds.map((kind, i) => {
            const Icon = TAB_ICONS[kind];
            const active = slotTabs.active === kind;
            return (
              <Stack
                key={kind}
                direction="row"
                spacing={0.5}
                onClick={() => setActiveTab(campaignId, slot, kind)}
                sx={{
                  alignItems: 'center',
                  px: 1.5,
                  py: 0.85,
                  cursor: 'pointer',
                  flex: '1 1 auto',
                  minWidth: 32,
                  maxWidth: 168,
                  overflow: 'hidden',
                  position: 'relative',
                  ml: i > 0 ? '-8px' : 0,
                  zIndex: active ? 2 : 1,
                  clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)',
                  bgcolor: active ? 'background.paper' : 'transparent',
                  color: active ? 'text.primary' : 'text.secondary',
                  '&:hover': { bgcolor: active ? 'background.paper' : 'action.selected' },
                }}
              >
                <Icon fontSize="small" sx={{ flexShrink: 0 }} />
                <Typography
                  variant="caption"
                  sx={{ fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}
                >
                  {TAB_LABELS[kind]}
                </Typography>
                <IconButton
                  size="small"
                  sx={{ p: 0.25, ml: 0.25, flexShrink: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(campaignId, slot, kind);
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Stack>
            );
          })}
        </Stack>
        {closableKinds.length > 0 && (
          <Tooltip title="Open a sub-window">
            <IconButton size="small" onClick={(e) => setAddAnchor(e.currentTarget)} sx={{ my: 'auto', ml: 0.5, mr: 0.75, flexShrink: 0 }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Box sx={{ flexGrow: 1 }} />
      </Stack>

      <Menu anchorEl={addAnchor} open={!!addAnchor} onClose={() => setAddAnchor(null)}>
        {closableKinds.map((kind) => {
          const Icon = TAB_ICONS[kind];
          return (
            <MenuItem
              key={kind}
              onClick={() => {
                openTab(campaignId, slot, kind);
                setAddAnchor(null);
              }}
            >
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={TAB_LABELS[kind]} />
            </MenuItem>
          );
        })}
      </Menu>

      <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', '& > *': { flexGrow: 1, minWidth: 0 } }}>
        {slotTabs.active === 'random-tables' && <RandomTablesSubWindow worldId={worldId} campaignId={campaignId} />}
        {slotTabs.active === 'encounters' && <EncountersSubWindow worldId={worldId} campaignId={campaignId} />}
        {slotTabs.active === 'stats' && <StatsSubWindow worldId={worldId} campaignId={campaignId} />}
        {slotTabs.active === 'places' && <PlacesSubWindow worldId={worldId} campaignId={campaignId} />}
        {slotTabs.active === 'factions' && <FactionsSubWindow worldId={worldId} campaignId={campaignId} />}
        {!slotTabs.active && (
          <Stack sx={{ m: 'auto', alignItems: 'center', gap: 1, textAlign: 'center', px: 3 }}>
            <Typography variant="body2" color="text.secondary">
              No sub-windows open.
            </Typography>
            <IconButton size="small" onClick={(e) => setAddAnchor(e.currentTarget)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Box>
    </Paper>
  );
}
