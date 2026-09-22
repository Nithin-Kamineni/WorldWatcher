import { useEffect, useState } from 'react';
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
import { TokenLibraryPanel } from './TokenLibraryPanel';
import { FloorSwitcherPanel } from './FloorSwitcherPanel';
import { InitiativePanel } from './InitiativePanel';
import { ItemsWindow } from '../../play/items/ItemsWindow';
import type { MapFloor } from '../../../types/map';
import type { InitiativeState } from '../../../types/initiative';
import type { PlacedToken } from '../../../types/token';
import type { ShortcutOverride } from '../../../store/useShortcutStore';
import { MAP_RAIL_WIDTH, MAP_PANEL_WIDTH, MAP_WIDE_PANEL_WIDTH } from '../../../theme/layout';

export type SidebarSection = 'tokens' | 'floors' | 'initiative' | 'reference';

/** A request from the page to open the sidebar on a given section. `nonce` is what makes a
 * repeat of the same request register - double-clicking the same token twice must reopen the
 * Reference panel the second time too. */
export interface SidebarOpenRequest {
  section: SidebarSection;
  nonce: number;
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
  onUpdateToken: (
    tokenId: string,
    changes: Partial<Pick<PlacedToken, 'hp' | 'concentrating' | 'deathSaves' | 'notes' | 'effects'>>,
  ) => void;
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
  selectedTokenIds,
  onTokenSelect,
  onTokenStatsRequest,
  shortcutOverrides,
  openRequest,
}: MapSidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [section, setSection] = useState<SidebarSection>('tokens');

  useEffect(() => {
    if (!openRequest) return;
    setSection(openRequest.section);
    setCollapsed(false);
  }, [openRequest]);

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
        <Paper
          elevation={0}
          sx={{
            width: section === 'reference' ? WIDE_PANEL_WIDTH : PANEL_WIDTH,
            borderRight: 1,
            borderColor: 'divider',
            borderRadius: 0,
            overflow: 'hidden',
          }}
        >
          {section === 'tokens' && <TokenLibraryPanel campaignId={campaignId} />}
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
        <Tooltip title="Collapse sidebar" placement="left">
          <IconButton size="small" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Box sx={{ width: '70%', borderTop: 1, borderColor: 'divider', my: 0.5 }} />

        <Tooltip title="Tokens" placement="left">
          <IconButton
            size="small"
            color={!collapsed && section === 'tokens' ? 'primary' : 'default'}
            onClick={() => handleSectionClick('tokens')}
          >
            <PeopleAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Floors" placement="left">
          <IconButton
            size="small"
            color={!collapsed && section === 'floors' ? 'primary' : 'default'}
            onClick={() => handleSectionClick('floors')}
          >
            <LayersIcon fontSize="small" />
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
