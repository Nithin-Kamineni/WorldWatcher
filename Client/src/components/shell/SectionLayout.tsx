import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import { TopBar } from './TopBar';
import { IconRail, getSectionLabel } from './IconRail';
import { RightPanel } from './RightPanel';
import { CommandPalette } from './CommandPalette';
import { useNavMemoryStore } from '../../store/useNavMemoryStore';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';

interface SectionLayoutProps {
  worldId: string;
  campaignId?: string;
  sidebar?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  /** Drops the main content area's default padding/scroll so a page can fill the viewport and
   * manage its own scrolling - used by the Play workspace, which needs real pixel height for
   * its resizable split panes rather than the shell's own overflow:auto container. */
  disableContentPadding?: boolean;
}

/** The shared four-pane shell: icon rail -> context sidebar -> main -> right
 * panel, under the top bar. See Prompt Images/WorldWatcher UI redisgn.md
 * section 3 for the layout this implements.
 *
 * Also the single injection point for two pieces of cross-page nav memory
 * (see useNavMemoryStore): which campaign is "active" for this world (so
 * world-scoped pages that don't carry :campaignId in the URL - Home, World
 * Manager, Atlas... - don't lose it and disable the Campaign rail group),
 * and the last location visited at all (drives the generalized Resume
 * card). Every world/campaign page renders through here, so this is the one
 * place that needs to know about either. */
export function SectionLayout({ worldId, campaignId, sidebar, right, children, disableContentPadding }: SectionLayoutProps) {
  const location = useLocation();
  const activeCampaignByWorldId = useNavMemoryStore((s) => s.activeCampaignByWorldId);
  const setActiveCampaign = useNavMemoryStore((s) => s.setActiveCampaign);
  const setLastLocation = useNavMemoryStore((s) => s.setLastLocation);
  const worlds = useWorldStore((s) => s.worlds);
  const campaigns = useCampaignStore((s) => s.campaigns);

  const effectiveCampaignId = campaignId ?? activeCampaignByWorldId[worldId];

  useEffect(() => {
    if (campaignId) setActiveCampaign(worldId, campaignId);
  }, [worldId, campaignId, setActiveCampaign]);

  useEffect(() => {
    // Home pages (World Home, Campaign Home) are landing pages that themselves show a
    // Resume card - recording them as the resume target would make Resume point at
    // whichever Home page you're currently looking at instead of where you left off.
    if (location.pathname.endsWith('/home')) return;
    const world = getWorldById(worlds, worldId);
    if (!world) return;
    const campaign = getCampaignById(campaigns, effectiveCampaignId);
    setLastLocation({
      worldId,
      worldName: world.name,
      campaignId: campaign?.id,
      campaignName: campaign?.name,
      path: location.pathname,
      sectionLabel: getSectionLabel(location.pathname),
      visitedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId, effectiveCampaignId, location.pathname, worlds, campaigns]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar worldId={worldId} campaignId={effectiveCampaignId} />
      <Box sx={{ flexGrow: 1, display: 'flex', minHeight: 0 }}>
        <IconRail worldId={worldId} campaignId={effectiveCampaignId} />
        {sidebar && (
          <Box
            sx={{
              width: 220,
              flexShrink: 0,
              borderRight: 1,
              borderColor: 'divider',
              overflowY: 'auto',
              p: 1.5,
              display: { xs: 'none', sm: 'block' },
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {sidebar}
          </Box>
        )}
        <Box
          sx={
            disableContentPadding
              ? { flexGrow: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
              : { flexGrow: 1, overflowY: 'auto', p: 3, minWidth: 0 }
          }
        >
          {children}
        </Box>
        <RightPanel worldId={worldId}>{right}</RightPanel>
      </Box>
      <CommandPalette worldId={worldId} campaignId={campaignId} />
    </Box>
  );
}
