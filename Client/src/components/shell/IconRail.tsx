import type { ReactNode } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Tooltip from '@mui/material/Tooltip';
import HomeIcon from '@mui/icons-material/Home';
import PublicIcon from '@mui/icons-material/Public';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MapIcon from '@mui/icons-material/Map';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CasinoIcon from '@mui/icons-material/Casino';
import ShieldIcon from '@mui/icons-material/Shield';
import SettingsIcon from '@mui/icons-material/Settings';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import { useNavMemoryStore } from '../../store/useNavMemoryStore';
import { su } from '../../theme/uiScale';
import {
  ICON_RAIL_WIDTH,
  ICON_RAIL_WIDTH_COMPACT,
  RAIL_HEADING_FONT_SIZE,
  RAIL_HEADING_LETTER_SPACING,
  RAIL_ITEM_LABEL_FONT_SIZE,
} from '../../theme/layout';

/** Glyph size per mode. 20px ("small") is what fits above a 10px label; 28px is what reads as
 * a button in its own right once the label is gone. */
const ICON_SIZE_LABELLED = su(20);
const ICON_SIZE_COMPACT = su(28);

interface RailItem {
  key: string;
  /** The cramped name drawn under the icon when labels are on - one short word, ~56px of
   * room. Also what `getSectionLabel` reports for Resume cards. */
  label: string;
  /** The full name, shown as the hover tooltip in BOTH modes. Deliberately not `label`: the
   * tooltip has room to say what the section actually is ("Battle Maps", "DM Notes"), and
   * hover is the only way an icon names itself once labels are off. */
  tooltip: string;
  /** The component, not an element: RailButton sizes it per mode. */
  Icon: SvgIconComponent;
  to: (worldId: string, campaignId?: string) => string;
  requiresCampaign?: boolean;
  isActive: (pathname: string) => boolean;
}

const WORLD_ITEMS: RailItem[] = [
  {
    key: 'home',
    label: 'Home',
    tooltip: 'Home',
    Icon: HomeIcon,
    to: (w) => `/w/${w}/home`,
    isActive: (p) => /\/w\/[^/]+\/home$/.test(p),
  },
  {
    key: 'manager',
    label: 'World',
    tooltip: 'World Manager',
    // The book icon the Lore rail item used to carry: the Compendium's content (Monsters,
    // Spells, Magic Items) now lives inside the World manager, so World is the way in.
    Icon: MenuBookIcon,
    to: (w) => `/w/${w}/manager?mode=hybrid`,
    isActive: (p) => p.includes('/manager'),
  },
  {
    key: 'atlas',
    label: 'Atlas',
    tooltip: 'Atlas',
    Icon: PublicIcon,
    to: (w) => `/w/${w}/atlas`,
    isActive: (p) => p.includes('/atlas'),
  },
  {
    key: 'timeline',
    label: 'Time',
    tooltip: 'Calendar',
    Icon: CalendarMonthIcon,
    to: (w) => `/w/${w}/timeline`,
    isActive: (p) => p.includes('/timeline'),
  },
];

/** Sections that no longer have a rail button but whose routes still resolve. Listing them
 * here keeps `getSectionLabel` naming them (so Resume cards still read "Lore" / "Tools")
 * instead of falling back to "Home".
 *
 * - Lore: the Compendium page's content moved into the World manager's Codex and People
 *   groups, so the rail stopped advertising it - but `/w/:id/compendium` stays alive for
 *   existing deep links (the Play page's Items window, chat entity refs).
 * - Tools: dropped from the rail on request. `/w/:id/tools` still resolves and the command
 *   palette still offers it. */
const RETIRED_ITEMS: { label: string; isActive: (pathname: string) => boolean }[] = [
  { label: 'Lore', isActive: (p) => p.includes('/compendium') },
  { label: 'Tools', isActive: (p) => p.includes('/tools') },
];

const CAMPAIGN_ITEMS: RailItem[] = [
  {
    key: 'play',
    label: 'Play',
    tooltip: 'Play Session',
    Icon: SportsEsportsIcon,
    to: (w, c) => `/w/${w}/c/${c}/play`,
    requiresCampaign: true,
    isActive: (p) => p.includes('/play'),
  },
  {
    key: 'maps',
    label: 'Maps',
    tooltip: 'Battle Maps',
    Icon: MapIcon,
    to: (w, c) => `/w/${w}/c/${c}/maps`,
    requiresCampaign: true,
    isActive: (p) => p.includes('/maps'),
  },
  {
    key: 'notes',
    label: 'Notes',
    tooltip: 'DM Notes',
    Icon: AssignmentIcon,
    to: (w, c) => `/w/${w}/c/${c}/notes`,
    requiresCampaign: true,
    isActive: (p) => p.includes('/notes'),
  },
  // Tables and Encounters are two buttons, not one (checklist R4). They were one page with two
  // halves behind a single shield, which named the narrower half and left the random tables -
  // a whole feature - unnamed anywhere in the nav. They are also two different jobs: rolling
  // something arrives with no object in mind and wants output in seconds, while an encounter
  // arrives knowing exactly which one it wants. The Play page's Items window had already split
  // them into two tabs with these same two glyphs (usePlayItemsStore's ITEMS_TAB_KINDS), so the
  // rail was the last place telling the DM they were one thing.
  {
    key: 'tables',
    label: 'Tables',
    tooltip: 'Random Tables',
    Icon: CasinoIcon,
    to: (w, c) => `/w/${w}/c/${c}/tables`,
    requiresCampaign: true,
    isActive: (p) => p.includes('/tables'),
  },
  {
    key: 'encounters',
    label: 'Encounters',
    tooltip: 'Encounters',
    Icon: ShieldIcon,
    to: (w, c) => `/w/${w}/c/${c}/encounters`,
    requiresCampaign: true,
    isActive: (p) => p.includes('/encounters'),
  },
];

const SETTINGS_ITEM: RailItem = {
  key: 'settings',
  label: 'Settings',
  tooltip: 'Settings',
  Icon: SettingsIcon,
  to: (w, c) => (c ? `/w/${w}/c/${c}/settings` : `/w/${w}/settings`),
  isActive: (p) => p.includes('/settings'),
};

interface IconRailProps {
  worldId: string;
  campaignId?: string;
}

function RailButton({
  item,
  worldId,
  campaignId,
  active,
  showLabel,
}: {
  item: RailItem;
  worldId: string;
  campaignId?: string;
  active: boolean;
  showLabel: boolean;
}) {
  const navigate = useNavigate();
  const disabled = item.requiresCampaign && !campaignId;

  const button = (
    <ButtonBase
      disabled={disabled}
      aria-label={item.tooltip}
      onClick={() => navigate(item.to(worldId, campaignId))}
      sx={{
        minWidth: su(48),
        maxWidth: '100%',
        ...(showLabel ? { py: 0.75, px: 0.5 } : { width: su(48), height: su(48) }),
        borderRadius: showLabel ? 1.5 : 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.25,
        color: active ? 'primary.main' : 'text.secondary',
        bgcolor: active ? 'action.selected' : 'transparent',
        opacity: disabled ? 0.4 : 1,
        '&:hover': { bgcolor: disabled ? 'transparent' : 'action.hover' },
      }}
    >
      <item.Icon sx={{ fontSize: showLabel ? ICON_SIZE_LABELLED : ICON_SIZE_COMPACT }} />
      {showLabel && (
        <Typography
          variant="caption"
          noWrap
          sx={{ fontSize: RAIL_ITEM_LABEL_FONT_SIZE, lineHeight: 1.15, textAlign: 'center', maxWidth: '100%' }}
        >
          {item.label}
        </Typography>
      )}
    </ButtonBase>
  );

  // Hover names the icon, and that is all it does. The rail used to fly out "Create new
  // entry" (World) and Folders/Plots/Quests (Notes) pills on the same gesture, which fought
  // the tooltip for it and put a 250ms delay in front of plain navigation; both are gone and
  // those destinations live on the pages themselves.
  // The <span> is what lets a disabled button still raise a tooltip - a disabled element
  // fires no pointer events of its own.
  return (
    <Tooltip title={disabled ? 'Create a campaign in this world first' : item.tooltip} placement="right">
      <Box component="span" sx={{ display: 'flex', maxWidth: '100%' }}>
        {button}
      </Box>
    </Tooltip>
  );
}

/** Looks up the rail label for a path, so Resume cards can show "which section you were last
 * in" without duplicating the rail's own active-path matching. */
export function getSectionLabel(pathname: string): string {
  const match = [...WORLD_ITEMS, ...CAMPAIGN_ITEMS, ...RETIRED_ITEMS].find((item) => item.isActive(pathname));
  return match?.label ?? 'Home';
}

/** "WORLD" / "CAMPAIGN" over each group, in BOTH rail modes - they name what the icons under
 * them belong to, which the icon-only rail needs at least as much as the labelled one.
 *
 * Keeping them is what puts a floor under the rail's width: "CAMPAIGN" is eight letter-spaced
 * characters, it was being clipped to "AMPAIGN" at the default scale, and the type floor
 * (RAIL_HEADING_FONT_SIZE) stops it shrinking before the rail would. So both come from
 * theme/layout.ts and are floored together - the rail is never narrower than its own heading. */
function RailGroupHeading({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      noWrap
      sx={{
        fontSize: RAIL_HEADING_FONT_SIZE,
        letterSpacing: RAIL_HEADING_LETTER_SPACING,
        lineHeight: 1.2,
        mb: 0.25,
        maxWidth: '100%',
      }}
    >
      {children}
    </Typography>
  );
}

export function IconRail({ worldId, campaignId }: IconRailProps) {
  const location = useLocation();
  const showLabel = useNavMemoryStore((s) => s.railLabelsVisible);

  return (
    <Box
      sx={{
        width: showLabel ? ICON_RAIL_WIDTH : ICON_RAIL_WIDTH_COMPACT,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 1,
        gap: showLabel ? 0.25 : 0.5,
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <RailGroupHeading>WORLD</RailGroupHeading>
      {WORLD_ITEMS.map((item) => (
        <RailButton
          key={item.key}
          item={item}
          worldId={worldId}
          campaignId={campaignId}
          active={item.isActive(location.pathname)}
          showLabel={showLabel}
        />
      ))}

      <Box sx={{ width: su(32), height: '1px', bgcolor: 'divider', my: 1 }} />
      <RailGroupHeading>CAMPAIGN</RailGroupHeading>
      {CAMPAIGN_ITEMS.map((item) => (
        <RailButton
          key={item.key}
          item={item}
          worldId={worldId}
          campaignId={campaignId}
          active={item.isActive(location.pathname)}
          showLabel={showLabel}
        />
      ))}

      <Box sx={{ flexGrow: 1, minHeight: 8 }} />
      <RailButton
        item={SETTINGS_ITEM}
        worldId={worldId}
        campaignId={campaignId}
        active={location.pathname.includes('/settings')}
        showLabel={showLabel}
      />
    </Box>
  );
}
