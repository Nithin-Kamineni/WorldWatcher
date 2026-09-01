import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    }),
    { name: 'worldwatcher-nav-memory' },
  ),
);
