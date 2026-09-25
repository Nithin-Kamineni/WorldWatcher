import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** The sidebar Tokens panel's tabs. `library` was `favorites` before the panel moved out of
 * the toolbar popover into the sidebar - the merge below maps a persisted `favorites` onto it. */
export type TokenManagerTab = 'floor' | 'library' | 'encounters';
export const TOKEN_MANAGER_TABS: TokenManagerTab[] = ['floor', 'library', 'encounters'];

/** Pure client-side UI convenience (which Tokens tab/random-table the DM was last on) - not
 * domain data, so this stays localStorage-only rather than a DB table, mirroring why
 * useRandomEncounterTableStore originally chose localStorage before it was promoted. */
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
    {
      name: 'worldwatcher-token-manager-ui',
      // A record saved while the tabs were This Floor / Favorites / Encounters says
      // `favorites`, which no longer exists; anything else unrecognised falls back to 'floor'.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as { lastTab?: unknown; lastEncounterTableIdByCampaignId?: unknown };
        const tab = saved.lastTab === 'favorites' ? 'library' : saved.lastTab;
        const byCampaign = saved.lastEncounterTableIdByCampaignId;
        return {
          ...current,
          lastTab: TOKEN_MANAGER_TABS.includes(tab as TokenManagerTab) ? (tab as TokenManagerTab) : 'floor',
          lastEncounterTableIdByCampaignId:
            byCampaign && typeof byCampaign === 'object'
              ? (byCampaign as Record<string, string>)
              : current.lastEncounterTableIdByCampaignId,
        };
      },
    },
  ),
);
