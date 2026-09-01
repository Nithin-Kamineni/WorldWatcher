import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Tooltip from '@mui/material/Tooltip';
import Popper from '@mui/material/Popper';
import Grow from '@mui/material/Grow';
import AddIcon from '@mui/icons-material/Add';
import HomeIcon from '@mui/icons-material/Home';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import PublicIcon from '@mui/icons-material/Public';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import BuildIcon from '@mui/icons-material/Build';
import MapIcon from '@mui/icons-material/Map';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ShieldIcon from '@mui/icons-material/Shield';
import RouteIcon from '@mui/icons-material/Route';
import SettingsIcon from '@mui/icons-material/Settings';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';

export const ICON_RAIL_WIDTH = 64;

interface HoverCreateAction {
  label: string;
  icon: ReactNode;
  to: (worldId: string, campaignId?: string) => string;
}

interface RailItem {
  key: string;
  label: string;
  icon: ReactNode;
  to: (worldId: string, campaignId?: string) => string;
  requiresCampaign?: boolean;
  isActive: (pathname: string) => boolean;
  /** Hovering the rail button flies out one or more small pill affordances to the right (e.g.
   * the World icon's single shortcut into "Create new - pick a type", or Notes' 3-way
   * Folders/Plots/Quests shortcut); a plain click still goes to `to()`, so hover is always a
   * shortcut, never required. */
  hoverCreate?: HoverCreateAction[];
}

const WORLD_ITEMS: RailItem[] = [
  {
    key: 'home',
    label: 'Home',
    icon: <HomeIcon fontSize="small" />,
    to: (w) => `/w/${w}/home`,
    isActive: (p) => /\/w\/[^/]+\/home$/.test(p),
  },
  {
    key: 'manager',
    label: 'World',
    icon: <TravelExploreIcon fontSize="small" />,
    to: (w) => `/w/${w}/manager?mode=hybrid`,
    isActive: (p) => p.includes('/manager'),
    hoverCreate: [{ label: 'Create new entry', icon: <AddIcon sx={{ fontSize: 18 }} />, to: (w) => `/w/${w}/manager/entry/new` }],
  },
  {
    key: 'atlas',
    label: 'Atlas',
    icon: <PublicIcon fontSize="small" />,
    to: (w) => `/w/${w}/atlas`,
    isActive: (p) => p.includes('/atlas'),
  },
  {
    key: 'timeline',
    label: 'Time',
    icon: <CalendarMonthIcon fontSize="small" />,
    to: (w) => `/w/${w}/timeline`,
    isActive: (p) => p.includes('/timeline'),
  },
  {
    key: 'compendium',
    label: 'Lore',
    icon: <MenuBookIcon fontSize="small" />,
    to: (w) => `/w/${w}/compendium`,
    isActive: (p) => p.includes('/compendium'),
  },
  {
    key: 'tools',
    label: 'Tools',
    icon: <BuildIcon fontSize="small" />,
    to: (w) => `/w/${w}/tools`,
    isActive: (p) => p.includes('/tools'),
  },
];

const CAMPAIGN_ITEMS: RailItem[] = [
  {
    key: 'play',
    label: 'Play',
    icon: <SportsEsportsIcon fontSize="small" />,
    to: (w, c) => `/w/${w}/c/${c}/play`,
    requiresCampaign: true,
    isActive: (p) => p.includes('/play'),
  },
  {
    key: 'notes',
    label: 'Notes',
    icon: <AssignmentIcon fontSize="small" />,
    to: (w, c) => `/w/${w}/c/${c}/notes`,
    requiresCampaign: true,
    isActive: (p) => p.includes('/notes'),
    hoverCreate: [
      { label: 'Folders', icon: <CreateNewFolderIcon sx={{ fontSize: 18 }} />, to: (w, c) => `/w/${w}/c/${c}/notes?tab=folders` },
      { label: 'Plots', icon: <RouteIcon sx={{ fontSize: 18 }} />, to: (w, c) => `/w/${w}/c/${c}/notes?tab=plots` },
      { label: 'Quests', icon: <PlaylistAddCheckIcon sx={{ fontSize: 18 }} />, to: (w, c) => `/w/${w}/c/${c}/notes?tab=quests` },
    ],
  },
  {
    key: 'encounters',
    label: 'Encounters',
    icon: <ShieldIcon fontSize="small" />,
    to: (w, c) => `/w/${w}/c/${c}/encounters`,
    requiresCampaign: true,
    isActive: (p) => p.includes('/encounters'),
  },
  {
    key: 'maps',
    label: 'Maps',
    icon: <MapIcon fontSize="small" />,
    to: (w, c) => `/w/${w}/c/${c}/maps`,
    requiresCampaign: true,
    isActive: (p) => p.includes('/maps'),
  },
];

interface IconRailProps {
  worldId: string;
  campaignId?: string;
}

function RailButton({ item, worldId, campaignId, active }: { item: RailItem; worldId: string; campaignId?: string; active: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const disabled = item.requiresCampaign && !campaignId;
  // The World rail item's hover-create flyout is orange only while actually on a create/
  // article page (a new entry, or an existing one) - white the rest of the time.
  const createActive = location.pathname.includes('/manager/entry/');
  const [hovering, setHovering] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  const startHover = () => {
    if (!item.hoverCreate) return;
    hoverTimer.current = setTimeout(() => setHovering(true), 250);
  };
  const endHover = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHovering(false);
  };

  const button = (
    <ButtonBase
      ref={item.hoverCreate ? anchorRef : undefined}
      disabled={disabled}
      onClick={() => navigate(item.to(worldId, campaignId))}
      onMouseEnter={() => item.hoverCreate && startHover()}
      onMouseLeave={endHover}
      sx={{
        minWidth: 48,
        maxWidth: '100%',
        py: 0.75,
        px: 0.5,
        borderRadius: 1.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.25,
        color: active ? 'primary.main' : 'text.secondary',
        bgcolor: active ? 'action.selected' : 'transparent',
        opacity: disabled ? 0.4 : 1,
        '&:hover': { bgcolor: disabled ? 'transparent' : 'action.hover' },
      }}
    >
      {item.icon}
      <Typography variant="caption" sx={{ fontSize: 10, lineHeight: 1.15, textAlign: 'center' }}>
        {item.label}
      </Typography>
    </ButtonBase>
  );

  const wrapped = disabled ? (
    <Tooltip title="Create a campaign in this world first" placement="right">
      <span>{button}</span>
    </Tooltip>
  ) : (
    button
  );

  if (!item.hoverCreate) return wrapped;

  const actions = item.hoverCreate;
  const singleAction = actions.length === 1;

  // Rendered through a Popper (portaled to <body>, like Tooltip) rather than as a normal
  // in-flow sibling: the icon rail scrolls vertically (overflowY: auto), and per the CSS
  // overflow spec that forces the used value of overflowX to 'auto' too even when it's
  // declared 'visible' - any absolutely-positioned child poking out past the rail's right
  // edge gets silently clipped no matter what. Popper sidesteps that entirely.
  return (
    <>
      {wrapped}
      <Popper
        open={hovering}
        anchorEl={anchorRef.current}
        placement="right"
        transition
        modifiers={[{ name: 'offset', options: { offset: [0, 0] } }]}
        sx={{ zIndex: (theme) => theme.zIndex.tooltip }}
      >
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} timeout={180} style={{ transformOrigin: 'left center' }}>
            <Box
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={endHover}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.paper',
                border: 1,
                borderLeft: 0,
                borderColor: 'divider',
                borderTopRightRadius: '6px',
                borderBottomRightRadius: '6px',
                boxShadow: 3,
                overflow: 'hidden',
              }}
            >
              {actions.map((action, i) => (
                <ButtonBase
                  key={action.label}
                  title={action.label}
                  onClick={() => navigate(action.to(worldId, campaignId))}
                  sx={{
                    width: 48,
                    py: 0.75,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.25,
                    color: singleAction && createActive ? 'primary.main' : 'common.white',
                    borderTop: i > 0 ? 1 : 0,
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {action.icon}
                  <Typography variant="caption" sx={{ fontSize: 10, lineHeight: 1 }}>
                    {singleAction ? 'Create' : action.label}
                  </Typography>
                </ButtonBase>
              ))}
            </Box>
          </Grow>
        )}
      </Popper>
    </>
  );
}

/** Looks up the rail label for a path, so Resume cards can show "which section you were last
 * in" without duplicating the rail's own active-path matching. */
export function getSectionLabel(pathname: string): string {
  const match = [...WORLD_ITEMS, ...CAMPAIGN_ITEMS].find((item) => item.isActive(pathname));
  return match?.label ?? 'Home';
}

export function IconRail({ worldId, campaignId }: IconRailProps) {
  const location = useLocation();

  return (
    <Box
      sx={{
        width: ICON_RAIL_WIDTH,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 1,
        gap: 0.25,
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, letterSpacing: 0.6, mb: 0.25 }}>
        WORLD
      </Typography>
      {WORLD_ITEMS.map((item) => (
        <RailButton key={item.key} item={item} worldId={worldId} campaignId={campaignId} active={item.isActive(location.pathname)} />
      ))}

      <Box sx={{ width: 32, height: '1px', bgcolor: 'divider', my: 1 }} />
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, letterSpacing: 0.6, mb: 0.25 }}>
        CAMPAIGN
      </Typography>
      {CAMPAIGN_ITEMS.map((item) => (
        <RailButton key={item.key} item={item} worldId={worldId} campaignId={campaignId} active={item.isActive(location.pathname)} />
      ))}

      <Box sx={{ flexGrow: 1 }} />
      <RailButton
        item={{
          key: 'settings',
          label: 'Settings',
          icon: <SettingsIcon fontSize="small" />,
          to: (w, c) => (c ? `/w/${w}/c/${c}/settings` : `/w/${w}/settings`),
          isActive: (p) => p.includes('/settings'),
        }}
        worldId={worldId}
        campaignId={campaignId}
        active={location.pathname.includes('/settings')}
      />
    </Box>
  );
}
