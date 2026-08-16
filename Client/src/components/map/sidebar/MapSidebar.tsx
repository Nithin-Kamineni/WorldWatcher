import { useState } from 'react';
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
import { TokenLibraryPanel } from './TokenLibraryPanel';
import { FloorSwitcherPanel } from './FloorSwitcherPanel';
import { InitiativePanel } from './InitiativePanel';
import type { MapFloor } from '../../../types/map';
import type { InitiativeState } from '../../../types/initiative';
import type { PlacedToken } from '../../../types/token';

type SidebarSection = 'tokens' | 'floors' | 'initiative';

interface MapSidebarProps {
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
}

const RAIL_WIDTH = 56;
const PANEL_WIDTH = 300;

export function MapSidebar({
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
}: MapSidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [section, setSection] = useState<SidebarSection>('tokens');

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
            width: PANEL_WIDTH,
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
            />
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
      </Stack>
    </Stack>
  );
}
