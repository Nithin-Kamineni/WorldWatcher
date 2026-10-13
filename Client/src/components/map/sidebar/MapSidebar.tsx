import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import LayersIcon from '@mui/icons-material/Layers';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import WidgetsOutlinedIcon from '@mui/icons-material/WidgetsOutlined';
import CasinoIcon from '@mui/icons-material/Casino';
import { TokensPanel, type TokenChanges } from './TokensPanel';
import { DicePanel } from '../../dice/DicePanel';
import { FloorSwitcherPanel } from './FloorSwitcherPanel';
import { InitiativePanel } from './InitiativePanel';
import { ItemsWindow } from '../../play/items/ItemsWindow';
import type { MapFloor } from '../../../types/map';
import type { InitiativeState } from '../../../types/initiative';
import type { PlacedToken } from '../../../types/token';
import type { ShortcutOverride } from '../../../store/useShortcutStore';
import { useTokenManagerUiStore, type TokenManagerTab } from '../../../store/useTokenManagerUiStore';
import type { EncounterCreatureEntry } from '../../../types/encounter';
import { MAP_RAIL_WIDTH, MAP_PANEL_WIDTH, MAP_WIDE_PANEL_WIDTH } from '../../../theme/layout';
import { useMapUiStore, MAP_SIDEBAR_MAX_WIDTH, MAP_SIDEBAR_MIN_WIDTH } from '../../../store/useMapUiStore';
import { getEffectiveCombo } from '../../../store/useShortcutStore';
import { formatCombo } from '../../../types/shortcut';

export type SidebarSection = 'tokens' | 'floors' | 'initiative' | 'dice' | 'reference';

/** A request from the page to open the sidebar on a given section. `nonce` is what makes a
 * repeat of the same request register - double-clicking the same token twice must reopen the
 * Reference panel the second time too. */
export interface SidebarOpenRequest {
  section: SidebarSection;
  nonce: number;
  /** For `tokens`: which tab to land on (right-clicking a token forces 'floor'). */
  tokenTab?: TokenManagerTab;
  /** For `tokens`: the row to highlight and scroll to. */
  focusTokenId?: string | null;
}

interface MapSidebarProps {
  worldId: string;
  campaignId: string;
  floors: MapFloor[];
  activeFloorId: string;
  onSelectFloor: (floorId: string) => void;
  placedTokens: PlacedToken[];
  initiative: InitiativeState;
  onRollInitiative: () => void;
  onCancelRoll: () => void;
  onUpdateBaseRoll: (entryId: string, baseRoll: number) => void;
  onToggleEntryLock: (entryId: string) => void;
  onStartEncounter: () => void;
  onNextTurn: () => void;
  onEndEncounter: () => void;
  onUpdateToken: (tokenId: string, changes: TokenChanges & Partial<Pick<PlacedToken, 'notes'>>) => void;
  onDeleteToken: (tokenId: string) => void;
  lockedEncounterId: string | null | undefined;
  onLockEncounter: (encounterId: string | null) => void;
  resolvedEncounterRoster: EncounterCreatureEntry[] | null;
  onSetResolvedEncounterRoster: (roster: EncounterCreatureEntry[] | null) => void;
  /** This map's square, in stage px - token sizes are edited in squares. */
  gridSize: number;
  selectedTokenIds: string[];
  onTokenSelect: (token: PlacedToken, additive: boolean) => void;
  onTokenStatsRequest: (token: PlacedToken) => void;
  shortcutOverrides: Record<string, ShortcutOverride>;
  /** Set by the page to pull a section open - see SidebarOpenRequest. */
  openRequest?: SidebarOpenRequest | null;
}

const RAIL_WIDTH = MAP_RAIL_WIDTH;
const PANEL_WIDTH = MAP_PANEL_WIDTH;
/** Reference needs more room than the token/floor lists: it carries a stat block, not a row. */
const WIDE_PANEL_WIDTH = MAP_WIDE_PANEL_WIDTH;

export function MapSidebar({
  worldId,
  campaignId,
  floors,
  activeFloorId,
  onSelectFloor,
  placedTokens,
  initiative,
  onRollInitiative,
  onCancelRoll,
  onUpdateBaseRoll,
  onToggleEntryLock,
  onStartEncounter,
  onNextTurn,
  onEndEncounter,
  onUpdateToken,
  onDeleteToken,
  lockedEncounterId,
  onLockEncounter,
  resolvedEncounterRoster,
  onSetResolvedEncounterRoster,
  gridSize,
  selectedTokenIds,
  onTokenSelect,
  onTokenStatsRequest,
  shortcutOverrides,
  openRequest,
}: MapSidebarProps) {
  const collapsed = useMapUiStore((state) => state.sidebarCollapsed);
  const setCollapsed = useMapUiStore((state) => state.setSidebarCollapsed);
  const toggleCollapsed = useMapUiStore((state) => state.toggleSidebar);
  const toggleCombo = formatCombo(getEffectiveCombo(shortcutOverrides, 'toggleSidebar'));
  const [section, setSection] = useState<SidebarSection>('tokens');
  // Restores whichever tab the DM was last on, rather than always resetting to "On map" -
  // right-clicking a specific token still forces 'floor', since that is a jump to its row.
  const [tokenTab, setTokenTab] = useState<TokenManagerTab>(() => useTokenManagerUiStore.getState().lastTab);
  const [focusTokenId, setFocusTokenId] = useState<string | null>(null);
  const storedWidth = useMapUiStore((state) => state.sidebarWidths[section]);
  const setSidebarWidth = useMapUiStore((state) => state.setSidebarWidth);
  const resetSidebarWidth = useMapUiStore((state) => state.resetSidebarWidth);
  /** Width while a drag is in progress - committed to the store once, on release. */
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragStart = useRef<{ x: number; width: number } | null>(null);
  const defaultWidth = section === 'reference' || section === 'tokens' ? WIDE_PANEL_WIDTH : PANEL_WIDTH;
  const panelWidth = dragWidth ?? storedWidth ?? defaultWidth;

  // The panel sits to the RIGHT of the canvas with its handle on its left edge, so dragging
  // left widens it. Pointer capture keeps the drag alive when the cursor outruns the handle.
  const handleResizeStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, width: panelWidth };
    setDragWidth(panelWidth);
  };
  const handleResizeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    const next = start.width + (start.x - e.clientX);
    setDragWidth(Math.min(MAP_SIDEBAR_MAX_WIDTH, Math.max(MAP_SIDEBAR_MIN_WIDTH, next)));
  };
  const handleResizeEnd = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    if (dragWidth !== null) setSidebarWidth(section, dragWidth);
    setDragWidth(null);
  };

  useEffect(() => {
    if (!openRequest) return;
    setSection(openRequest.section);
    if (openRequest.tokenTab) setTokenTab(openRequest.tokenTab);
    setFocusTokenId(openRequest.focusTokenId ?? null);
    setCollapsed(false);
  }, [openRequest, setCollapsed]);

  /** Jumps to a token's row under Tokens > On map, where its name, notes, size and the rest
   * are edited - the initiative list's right-click "Edit token" lands here. */
  const openTokenOnMap = (tokenId: string) => {
    setSection('tokens');
    setTokenTab('floor');
    setFocusTokenId(tokenId);
    setCollapsed(false);
  };

  const handleSectionClick = (next: SidebarSection) => {
    if (!collapsed && section === next) {
      setCollapsed(true);
      return;
    }
    setSection(next);
    setCollapsed(false);
  };

  return (
    <Stack direction="row" sx={{ height: '100%', flexShrink: 0 }}>
      {!collapsed && (
        <Box sx={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
        <Tooltip title={`Collapse sidebar (${toggleCombo})`} placement="left">
          <IconButton
            size="small"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            sx={{
              position: 'absolute',
              top: '50%',
              left: -14,
              transform: 'translateY(-50%)',
              zIndex: 2,
              width: 22,
              height: 44,
              borderRadius: '8px 0 0 8px',
              bgcolor: 'background.paper',
              border: 1,
              borderRight: 0,
              borderColor: 'divider',
              '&:hover': { bgcolor: 'action.selected' },
            }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Drag to resize - double-click to reset" placement="left" enterDelay={600}>
          <Box
            role="separator"
            aria-orientation="vertical"
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            onDoubleClick={() => resetSidebarWidth(section)}
            sx={{
              width: 6,
              flexShrink: 0,
              cursor: 'col-resize',
              touchAction: 'none',
              bgcolor: dragWidth !== null ? 'primary.main' : 'transparent',
              transition: 'background-color 0.15s',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          />
        </Tooltip>
        </Box>
      )}
      {!collapsed && (
        <Paper
          elevation={0}
          sx={{
            width: panelWidth,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            borderRadius: 0,
            overflow: 'hidden',
          }}
        >
          {section === 'tokens' && (
            <TokensPanel
              campaignId={campaignId}
              placedTokens={placedTokens}
              onUpdateToken={onUpdateToken}
              onDeleteToken={onDeleteToken}
              focusTokenId={focusTokenId}
              tab={tokenTab}
              onTabChange={setTokenTab}
              lockedEncounterId={lockedEncounterId}
              onLockEncounter={onLockEncounter}
              resolvedEncounterRoster={resolvedEncounterRoster}
              onSetResolvedEncounterRoster={onSetResolvedEncounterRoster}
              encounterActive={initiative.status === 'active'}
              gridSize={gridSize}
            />
          )}
          {section === 'dice' && <DicePanel />}
          {section === 'floors' && (
            <FloorSwitcherPanel floors={floors} activeFloorId={activeFloorId} onSelectFloor={onSelectFloor} />
          )}
          {section === 'initiative' && (
            <InitiativePanel
              placedTokens={placedTokens}
              initiative={initiative}
              onRollInitiative={onRollInitiative}
              onCancelRoll={onCancelRoll}
              onUpdateBaseRoll={onUpdateBaseRoll}
              onToggleEntryLock={onToggleEntryLock}
              onStartEncounter={onStartEncounter}
              onNextTurn={onNextTurn}
              onEndEncounter={onEndEncounter}
              onUpdateToken={onUpdateToken}
              selectedTokenIds={selectedTokenIds}
              onTokenSelect={onTokenSelect}
              onTokenStatsRequest={onTokenStatsRequest}
              onEditToken={openTokenOnMap}
              shortcutOverrides={shortcutOverrides}
            />
          )}
          {/* The Play page's Items window, on the map (checklist E13). Same store, its own
              'map' surface, so what the DM pins here does not disturb either Play pane. */}
          {section === 'reference' && (
            <Box sx={{ height: '100%', display: 'flex' }}>
              <ItemsWindow worldId={worldId} campaignId={campaignId} slot="map" />
            </Box>
          )}
        </Paper>
      )}

      <Stack
        sx={{
          width: RAIL_WIDTH,
          flexShrink: 0,
          borderLeft: 1,
          borderColor: 'divider',
          alignItems: 'center',
          py: 1.5,
        }}
        spacing={1}
      >
        <Tooltip title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (${toggleCombo})`} placement="left">
          <IconButton size="small" onClick={toggleCollapsed}>
            {collapsed ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Box sx={{ width: '70%', borderTop: 1, borderColor: 'divider', my: 0.5 }} />

        <Tooltip title="Floors" placement="left">
          <IconButton
            size="small"
            color={!collapsed && section === 'floors' ? 'primary' : 'default'}
            onClick={() => handleSectionClick('floors')}
          >
            <LayersIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Tokens - on this map, library, encounters" placement="left">
          <IconButton
            size="small"
            color={!collapsed && section === 'tokens' ? 'primary' : 'default'}
            onClick={() => handleSectionClick('tokens')}
          >
            <PeopleAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Initiative" placement="left">
          <IconButton
            size="small"
            color={!collapsed && section === 'initiative' ? 'primary' : 'default'}
            onClick={() => handleSectionClick('initiative')}
          >
            <FormatListNumberedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Dice" placement="left">
          <IconButton
            size="small"
            color={!collapsed && section === 'dice' ? 'primary' : 'default'}
            onClick={() => handleSectionClick('dice')}
          >
            <CasinoIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Reference - stats, tables, encounters, places, factions" placement="left">
          <IconButton
            size="small"
            color={!collapsed && section === 'reference' ? 'primary' : 'default'}
            onClick={() => handleSectionClick('reference')}
          >
            <WidgetsOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
