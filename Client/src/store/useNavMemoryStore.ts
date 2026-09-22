import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_UI_SCALE } from '../theme/uiScale';

export interface LastVisitedMap {
  worldId: string;
  campaignId: string;
  mapId: string;
  mapName: string;
  campaignName: string;
  visitedAt: number;
}

export interface LastLocation {
  worldId: string;
  worldName: string;
  campaignId?: string;
  campaignName?: string;
  path: string;
  sectionLabel: string;
  visitedAt: number;
}

/** Pure client-side navigation convenience (which campaign you last picked per world, where
 * you last were, which map you last opened) - not domain data, so this stays localStorage-only
 * rather than a DB table, mirroring useTokenManagerUiStore's reasoning. Split out of
 * useShellStore because that store's dialogs/panel-toggle state is deliberately session-only
 * (shouldn't survive a reload), while this state should. */
interface NavMemoryState {
  activeCampaignByWorldId: Record<string, string>;
  setActiveCampaign: (worldId: string, campaignId: string) => void;

  lastLocation: LastLocation | null;
  setLastLocation: (entry: LastLocation) => void;

  lastVisitedMap: LastVisitedMap | null;
  setLastVisitedMap: (entry: LastVisitedMap) => void;

  /** Whether SectionLayout's context sidebar is collapsed to its thin strip. One flag for
   * every page that renders a sidebar, deliberately: collapsing it is a "give me back the
   * screen" preference about the shell, not about one section, and remembering it per page
   * would mean re-collapsing it four times as you move around. A record persisted before
   * this field existed simply lacks the key, and persist's shallow merge fills in `false`
   * from the initializer - no normalizer needed, unlike the Play stores' nested records. */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  /** Whether the icon rail draws each item's short name under its icon. OFF by default: the
   * rail is icon-only and every item names itself through a tooltip on hover instead, which
   * is why RAIL_ITEM_TOOLTIPS in IconRail.tsx spells the names out in full ("Battle Maps",
   * not "Maps") - the label under an icon has ~56px to live in, the tooltip has as much room
   * as it wants, so the two are deliberately different strings. Same shallow-merge note as
   * sidebarCollapsed: a record persisted before this field existed just lacks the key and
   * gets `false` from the initializer. */
  railLabelsVisible: boolean;
  setRailLabelsVisible: (visible: boolean) => void;

  /** How densely the whole app is drawn, as a multiplier - see theme/uiScale.ts, which is
   * where it is actually consumed. It lives in THIS store only so it persists next to the
   * other shell-chrome preferences; uiScale.ts reads this record's raw JSON at module load,
   * because layout constants have to know the scale before React exists. Changing it from
   * Settings reloads the page, so the two readers can never disagree. */
  uiScale: number;
  setUiScale: (scale: number) => void;
}

export const useNavMemoryStore = create<NavMemoryState>()(
  persist(
    (set) => ({
      activeCampaignByWorldId: {},
      setActiveCampaign: (worldId, campaignId) =>
        set((state) => ({
          activeCampaignByWorldId: { ...state.activeCampaignByWorldId, [worldId]: campaignId },
        })),

      lastLocation: null,
      setLastLocation: (entry) => set({ lastLocation: entry }),

      lastVisitedMap: null,
      setLastVisitedMap: (entry) => set({ lastVisitedMap: entry }),

      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      railLabelsVisible: false,
      setRailLabelsVisible: (visible) => set({ railLabelsVisible: visible }),

      uiScale: DEFAULT_UI_SCALE,
      setUiScale: (scale) => set({ uiScale: scale }),
    }),
    { name: 'worldwatcher-nav-memory' },
  ),
);
