import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import LayersClearIcon from '@mui/icons-material/LayersClear';
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
import { useItemUsageStore } from '../../../store/useItemUsageStore';
import { usePlayItemsStore, getPlayItemsState, getSlotItems, countSlotItems, ITEMS_TAB_KINDS, type ItemsTabKind } from '../../../store/usePlayItemsStore';
import { TAB_DRAG_TYPE, decodeTabDrag, encodeTabDrag } from './tabDrag';
import type { ItemsSurface } from '../layout/playLayoutTrees';

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

/** Below this a tab shows an icon and an ellipsis and nothing else, which is worse than making
 * the strip scroll - five tabs in a narrow pane used to shrink to 32px slivers (checklist
 * P10). Tabs stop shrinking here and the strip scrolls sideways instead. */
const MIN_TAB_WIDTH = 104;

interface ItemsWindowProps extends PaneCloseProps {
  worldId: string;
  campaignId: string;
  slot: ItemsSurface;
  kindSwitcher?: ReactNode;
}

/** The Items window (issues.txt 10.c) - a Chrome-tab-style strip of sub-windows (Random
 * Tables/Encounters/Stats/Places/Factions), one open by default (Random Tables). Every bit of
 * its state - which tabs are open, which is active, and what each one has pinned, opened and
 * expanded - is keyed by pane slot in usePlayItemsStore, so two Items windows on screen at once
 * are two genuinely independent workspaces. */
export function ItemsWindow({ worldId, campaignId, slot, kindSwitcher, ...closeProps }: ItemsWindowProps) {
  const activeTabRef = useRef<HTMLDivElement | null>(null);
  const byCampaignId = usePlayItemsStore((s) => s.byCampaignId);
  const openTab = usePlayItemsStore((s) => s.openTab);
  const closeTab = usePlayItemsStore((s) => s.closeTab);
  const setActiveTab = usePlayItemsStore((s) => s.setActiveTab);
  const moveTab = usePlayItemsStore((s) => s.moveTab);
  const clearSlot = usePlayItemsStore((s) => s.clearSlot);
  // Pulls this campaign's usefulness counters down once per session, so a ranking built up on
  // another machine is already in place before the DM opens anything (checklist I-P9). One call
  // site rather than five: every sub-window lives inside this window.
  const syncUsage = useItemUsageStore((s) => s.syncFromServer);
  const moveTabToSlot = usePlayItemsStore((s) => s.moveTabToSlot);

  const campaignState = getPlayItemsState(byCampaignId, campaignId);
  const slotTabs = getSlotItems(campaignState, slot);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [draggingTab, setDraggingTab] = useState<ItemsTabKind | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const openableKinds = ITEMS_TAB_KINDS.filter((k) => !slotTabs.kinds.includes(k));

  useEffect(() => {
    void syncUsage(campaignId);
  }, [campaignId, syncUsage]);

  // With a scrolling strip the active tab can sit off-screen after a switch from the "+" menu
  // or a pane resize, so pull it back into view whenever it changes.
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [slotTabs.active]);

  // Pins, opened rows and expanded rows accumulate in this window for the life of the
  // campaign, and closing a sub-tab does not touch them - so there has to be a way to empty it
  // without resetting the whole layout (checklist I-P7). The count is in the label so this is
  // never a blind "clear".
  const storedCount = countSlotItems(slotTabs);
  const clearButton = storedCount > 0 && (
    <Tooltip title={`Clear this window - forgets ${storedCount} pinned/open row${storedCount === 1 ? '' : 's'}`}>
      <IconButton
        size="small"
        aria-label={`Clear this window (${storedCount} pinned or open rows)`}
        onClick={() => clearSlot(campaignId, slot)}
        sx={{ flexShrink: 0 }}
      >
        <LayersClearIcon sx={{ fontSize: 17 }} />
      </IconButton>
    </Tooltip>
  );

  const addButton = openableKinds.length > 0 && (
    <Tooltip title="Open a sub-window">
      <IconButton size="small" aria-label="Open a sub-window" onClick={(e) => setAddAnchor(e.currentTarget)} sx={{ flexShrink: 0 }}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  const tabStrip = (
    <Stack
      direction="row"
      sx={{
        // Scrolls rather than crushing - see the note on MIN_TAB_WIDTH.
        overflowX: 'auto',
        overflowY: 'hidden',
        flexGrow: 1,
        minWidth: 0,
        alignItems: 'flex-end',
        pt: 0.5,
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
      onDragOver={(e) => {
        // Keyed off the dataTransfer's types rather than `draggingTab`, which is only set for a
        // drag that started in THIS window - a tab arriving from the other Items window has to
        // be allowed to drop here too.
        if (e.dataTransfer.types.includes(TAB_DRAG_TYPE)) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes(TAB_DRAG_TYPE)) return;
        e.preventDefault();
        const payload = decodeTabDrag(e.dataTransfer.getData(TAB_DRAG_TYPE));
        setDraggingTab(null);
        setDropIndex(null);
        if (!payload) return;
        if (payload.slot === slot) {
          if (dropIndex !== null) moveTab(campaignId, slot, payload.kind, dropIndex);
        } else {
          moveTabToSlot(campaignId, payload.slot, slot, payload.kind, { toIndex: dropIndex ?? undefined });
        }
      }}
    >
      {slotTabs.kinds.map((kind, i) => {
        const Icon = TAB_ICONS[kind];
        const active = slotTabs.active === kind;
        const isDropTarget = draggingTab && draggingTab !== kind && dropIndex === i;
        return (
          <Stack
            key={kind}
            ref={active ? activeTabRef : undefined}
            direction="row"
            spacing={0.5}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData(TAB_DRAG_TYPE, encodeTabDrag(slot, kind));
              e.dataTransfer.effectAllowed = 'move';
              setDraggingTab(kind);
            }}
            onDragEnd={() => {
              setDraggingTab(null);
              setDropIndex(null);
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(TAB_DRAG_TYPE)) return;
              e.preventDefault();
              if (dropIndex !== i) setDropIndex(i);
            }}
            onClick={() => setActiveTab(campaignId, slot, kind)}
            sx={{
              alignItems: 'center',
              px: 1.5,
              py: 0.85,
              cursor: 'pointer',
              flex: '0 1 auto',
              minWidth: MIN_TAB_WIDTH,
              maxWidth: 168,
              flexShrink: 0,
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
                aria-label={`Close ${TAB_LABELS[kind]}`}
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
      <PaneHeader slot={slot} leading={kindSwitcher} center={tabStrip} actions={clearButton} {...closeProps} />

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
