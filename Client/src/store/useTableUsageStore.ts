import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** What this campaign has actually done with one random table. */
export interface TableUsage {
  /** Times the DM rolled it - the strongest "this table is useful to me" signal there is. */
  rolls: number;
  /** Times it was opened/expanded without necessarily being rolled. */
  opens: number;
  lastUsedAt: number;
}

export type TableUsageMap = Record<string, TableUsage>;

const EMPTY: TableUsageMap = {};

interface TableUsageStoreState {
  byCampaignId: Record<string, TableUsageMap>;
  recordRoll: (campaignId: string, tableId: string) => void;
  recordOpen: (campaignId: string, tableId: string) => void;
  clearCampaign: (campaignId: string) => void;
}

function bump(map: TableUsageMap, tableId: string, field: 'rolls' | 'opens'): TableUsageMap {
  const current = map[tableId] ?? { rolls: 0, opens: 0, lastUsedAt: 0 };
  return { ...map, [tableId]: { ...current, [field]: current[field] + 1, lastUsedAt: Date.now() } };
}

/** Per-campaign usage counters for the random table library, persisted locally.
 *
 * The library runs to thousands of tables, and alphabetical order says nothing about which of
 * them a given DM reaches for - so search and browse rank on relevance blended with this
 * (see rankTablesByUsefulness in tableSearch.ts). It is deliberately campaign-scoped: the
 * tables that matter in a nautical campaign are not the ones that matter in an urban one. */
export const useTableUsageStore = create<TableUsageStoreState>()(
  persist(
    (set) => ({
      byCampaignId: {},

      recordRoll: (campaignId, tableId) =>
        set((state) => ({
          byCampaignId: { ...state.byCampaignId, [campaignId]: bump(state.byCampaignId[campaignId] ?? EMPTY, tableId, 'rolls') },
        })),

      recordOpen: (campaignId, tableId) =>
        set((state) => ({
          byCampaignId: { ...state.byCampaignId, [campaignId]: bump(state.byCampaignId[campaignId] ?? EMPTY, tableId, 'opens') },
        })),

      clearCampaign: (campaignId) =>
        set((state) => ({ byCampaignId: { ...state.byCampaignId, [campaignId]: {} } })),
    }),
    { name: 'worldwatcher-table-usage' },
  ),
);

export function getTableUsage(byCampaignId: Record<string, TableUsageMap>, campaignId: string | undefined): TableUsageMap {
  if (!campaignId) return EMPTY;
  return byCampaignId[campaignId] ?? EMPTY;
}
