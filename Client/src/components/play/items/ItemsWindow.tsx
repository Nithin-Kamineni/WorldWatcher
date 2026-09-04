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
import { PaneHeader, type PaneCloseProps } from '../layout/PaneHeader';
import { usePlayItemsStore, getPlayItemsState, getSlotItems, ITEMS_TAB_KINDS, type ItemsTabKind } from '../../../store/usePlayItemsStore';
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

/** Data type for dragging a sub-tab within one window's strip. Deliberately different from
 * PANE_DRAG_TYPE so a tab drag can never be mistaken for a whole-pane drag (and the pane drop
 * zones ignore it). */
const TAB_DRAG_TYPE = 'application/x-worldwatcher-items-tab';

interface ItemsWindowProps extends PaneCloseProps {
  worldId: string;
  campaignId: string;
  slot: PaneSlot;
  kindSwitcher?: ReactNode;
}

/** The Items window (issues.txt 10.c) - a Chrome-tab-style strip of sub-windows (Random
 * Tables/Encounters/Stats/Places/Factions), one open by default (Random Tables). Every bit of
 * its state - which tabs are open, which is active, and what each one has pinned, opened and
 * expanded - is keyed by pane slot in usePlayItemsStore, so two Items windows on screen at once
 * are two genuinely independent workspaces. */
export function ItemsWindow({ worldId, campaignId, slot, kindSwitcher, ...closeProps }: ItemsWindowProps) {
  const byCampaignId = usePlayItemsStore((s) => s.byCampaignId);
  const openTab = usePlayItemsStore((s) => s.openTab);
  const closeTab = usePlayItemsStore((s) => s.closeTab);
  const setActiveTab = usePlayItemsStore((s) => s.setActiveTab);
  const moveTab = usePlayItemsStore((s) => s.moveTab);

  const campaignState = getPlayItemsState(byCampaignId, campaignId);
  const slotTabs = getSlotItems(campaignState, slot);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [draggingTab, setDraggingTab] = useState<ItemsTabKind | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const openableKinds = ITEMS_TAB_KINDS.filter((k) => !slotTabs.kinds.includes(k));

  const addButton = openableKinds.length > 0 && (
    <Tooltip title="Open a sub-window">
      <IconButton size="small" onClick={(e) => setAddAnchor(e.currentTarget)} sx={{ flexShrink: 0 }}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  const tabStrip = (
    <Stack
      direction="row"
      sx={{ overflow: 'hidden', flexGrow: 1, minWidth: 0, alignItems: 'flex-end', pt: 0.5 }}
      onDragOver={(e) => {
        if (draggingTab) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!draggingTab || !e.dataTransfer.types.includes(TAB_DRAG_TYPE)) return;
        e.preventDefault();
        if (dropIndex !== null) moveTab(campaignId, slot, draggingTab, dropIndex);
        setDraggingTab(null);
        setDropIndex(null);
      }}
    >
      {slotTabs.kinds.map((kind, i) => {
        const Icon = TAB_ICONS[kind];
        const active = slotTabs.active === kind;
        const isDropTarget = draggingTab && draggingTab !== kind && dropIndex === i;
        return (
          <Stack
            key={kind}
            direction="row"
            spacing={0.5}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData(TAB_DRAG_TYPE, kind);
              e.dataTransfer.effectAllowed = 'move';
              setDraggingTab(kind);
            }}
            onDragEnd={() => {
              setDraggingTab(null);
              setDropIndex(null);
            }}
            onDragOver={(e) => {
              if (!draggingTab) return;
              e.preventDefault();
              if (dropIndex !== i) setDropIndex(i);
            }}
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
              opacity: draggingTab === kind ? 0.4 : 1,
              clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)',
              bgcolor: isDropTarget ? 'action.selected' : active ? 'background.paper' : 'transparent',
              color: active ? 'text.primary' : 'text.secondary',
              boxShadow: isDropTarget ? (theme) => `inset 2px 0 0 ${theme.palette.primary.main}` : 'none',
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
            <Tooltip title="Close this sub-window">
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
            </Tooltip>
          </Stack>
        );
      })}
      {addButton && <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.5, pb: 0.25 }}>{addButton}</Box>}
    </Stack>
  );

  return (
    <Paper
      variant="outlined"
      sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 1.5, overflow: 'hidden' }}
    >
      <PaneHeader slot={slot} leading={kindSwitcher} center={tabStrip} {...closeProps} />

      <Menu anchorEl={addAnchor} open={!!addAnchor} onClose={() => setAddAnchor(null)}>
        {openableKinds.map((kind) => {
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
        {slotTabs.active === 'random-tables' && <RandomTablesSubWindow worldId={worldId} campaignId={campaignId} slot={slot} />}
        {slotTabs.active === 'encounters' && <EncountersSubWindow worldId={worldId} campaignId={campaignId} slot={slot} />}
        {slotTabs.active === 'stats' && <StatsSubWindow worldId={worldId} campaignId={campaignId} slot={slot} />}
        {slotTabs.active === 'places' && <PlacesSubWindow worldId={worldId} campaignId={campaignId} slot={slot} />}
        {slotTabs.active === 'factions' && <FactionsSubWindow worldId={worldId} campaignId={campaignId} slot={slot} />}
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
