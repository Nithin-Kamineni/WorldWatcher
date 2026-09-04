import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** DM-adjustable "current party" assumption used to compute a live Easy/Medium/Hard/Deadly
 * badge per encounter (see computeEncounterDifficulty in utils/encounterCalculator.ts) -
 * localStorage-only, same reasoning as useQuickToolsStore: a per-DM display preference, not
 * shared data, scoped per campaign since different campaigns have different parties. Default
 * is a party of 4 players, all level 5. */
interface PartyComposition {
  partySize: number;
  partyLevel: number;
}

const DEFAULT_PARTY: PartyComposition = { partySize: 4, partyLevel: 5 };

interface EncounterDifficultySettingsState {
  partyByCampaignId: Record<string, PartyComposition>;
  getParty: (campaignId: string) => PartyComposition;
  setPartySize: (campaignId: string, partySize: number) => void;
  setPartyLevel: (campaignId: string, partyLevel: number) => void;
}

export const useEncounterDifficultySettingsStore = create<EncounterDifficultySettingsState>()(
  persist(
    (set, get) => ({
      partyByCampaignId: {},
      getParty: (campaignId) => get().partyByCampaignId[campaignId] ?? DEFAULT_PARTY,
      setPartySize: (campaignId, partySize) =>
        set((state) => ({
          partyByCampaignId: {
            ...state.partyByCampaignId,
            [campaignId]: { ...(state.partyByCampaignId[campaignId] ?? DEFAULT_PARTY), partySize: Math.max(1, Math.round(partySize)) },
          },
        })),
      setPartyLevel: (campaignId, partyLevel) =>
        set((state) => ({
          partyByCampaignId: {
            ...state.partyByCampaignId,
            [campaignId]: { ...(state.partyByCampaignId[campaignId] ?? DEFAULT_PARTY), partyLevel: Math.max(1, Math.min(20, Math.round(partyLevel))) },
          },
        })),
    }),
    { name: 'worldwatcher-encounter-difficulty-settings' },
  ),
);
