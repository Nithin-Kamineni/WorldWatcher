import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NpcCardReturnState {
  worldId: string;
  campaignId: string;
  creatureId: string;
  search: string;
  relationFilter: string[];
  importanceFilter: string[];
  allCampaigns: boolean;
  setAt: number;
}

/** Pure client-side navigation convenience - which NPC card (and NpcsSection filters) to
 * reopen when the user backs out of an article they jumped to from that card - not domain
 * data, so this stays localStorage-only, mirroring useNavMemoryStore's reasoning. Consumed
 * once by NpcsSection on mount (matching worldId/campaignId, not stale) and cleared. */
interface NpcCardReturnStoreState {
  pending: NpcCardReturnState | null;
  setPending: (entry: NpcCardReturnState) => void;
  clearPending: () => void;
}

export const useNpcCardReturnStore = create<NpcCardReturnStoreState>()(
  persist(
    (set) => ({
      pending: null,
      setPending: (entry) => set({ pending: entry }),
      clearPending: () => set({ pending: null }),
    }),
    { name: 'worldwatcher-npc-card-return' },
  ),
);
