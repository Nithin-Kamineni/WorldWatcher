import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TokenManagerTab } from '../components/map/toolbar/TokenManagerPopover';

/** Pure client-side UI convenience (which Manage Tokens tab/random-table the DM was last
 * on) - not domain data, so this stays localStorage-only rather than a DB table, mirroring
 * why useRandomEncounterTableStore originally chose localStorage before it was promoted. */
interface TokenManagerUiState {
  lastTab: TokenManagerTab;
  lastEncounterTableIdByCampaignId: Record<string, string>;
  setLastTab: (tab: TokenManagerTab) => void;
  setLastEncounterTableId: (campaignId: string, tableId: string) => void;
}

export const useTokenManagerUiStore = create<TokenManagerUiState>()(
  persist(
    (set) => ({
      lastTab: 'floor',
      lastEncounterTableIdByCampaignId: {},
      setLastTab: (tab) => set({ lastTab: tab }),
      setLastEncounterTableId: (campaignId, tableId) =>
        set((state) => ({
          lastEncounterTableIdByCampaignId: { ...state.lastEncounterTableIdByCampaignId, [campaignId]: tableId },
        })),
    }),
    { name: 'worldwatcher-token-manager-ui' },
  ),
);
