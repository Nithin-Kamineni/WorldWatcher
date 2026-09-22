import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearItemUsage, listItemUsage, recordItemUsage } from '../api/resources/itemUsage';
import { ITEMS_TAB_KINDS, type ItemsTabKind } from './usePlayItemsStore';

/** What this campaign has actually done with one item - a random table, an encounter, a stat
 * block, a place, a faction. */
export interface ItemUsage {
  /** Times the DM put it to work - rolled the table, ran the encounter, opened the stat block
   * up to read it. The strongest "this is useful to me" signal there is. */
  rolls: number;
  /** Times it was merely opened into the pane without being used. */
  opens: number;
  lastUsedAt: number;
}

export type ItemUsageMap = Record<string, ItemUsage>;

const EMPTY: ItemUsageMap = {};

type CampaignUsage = Partial<Record<ItemsTabKind, ItemUsageMap>>;

interface ItemUsageStoreState {
  byCampaignId: Record<string, CampaignUsage>;
  /** Campaigns already pulled from the server this session - the fetch is idempotent, so this
   * is only here to stop every Items sub-window mount re-requesting the same rows. */
  loadedCampaignIds: string[];
  recordUse: (campaignId: string, kind: ItemsTabKind, itemId: string) => void;
  recordOpen: (campaignId: string, kind: ItemsTabKind, itemId: string) => void;
  clearCampaign: (campaignId: string) => void;
  /** Merges the server's counters into the local ones. Called once per campaign on mount. */
  syncFromServer: (campaignId: string) => Promise<void>;
}

function bump(map: ItemUsageMap, itemId: string, field: 'rolls' | 'opens'): ItemUsageMap {
  const current = map[itemId] ?? { rolls: 0, opens: 0, lastUsedAt: 0 };
  return { ...map, [itemId]: { ...current, [field]: current[field] + 1, lastUsedAt: Date.now() } };
}

function record(state: ItemUsageStoreState, campaignId: string, kind: ItemsTabKind, itemId: string, field: 'rolls' | 'opens') {
  const campaign = state.byCampaignId[campaignId] ?? {};
  return {
    byCampaignId: {
      ...state.byCampaignId,
      [campaignId]: { ...campaign, [kind]: bump(campaign[kind] ?? EMPTY, itemId, field) },
    },
  };
}

/** Per-campaign, per-kind usage counters for everything the Items window browses, persisted
 * locally.
 *
 * Alphabetical order says nothing about which of a campaign's tables, encounters, NPCs, places
 * or factions a given DM reaches for - so every Items sub-window ranks on relevance blended
 * with this (see rankByUsefulness / rankTablesByUsefulness in tableSearch.ts). It is
 * deliberately campaign-scoped: the tables that matter in a nautical campaign are not the ones
 * that matter in an urban one.
 *
 * This started life as useTableUsageStore, random-tables only (the one sub-window that had
 * ranking - checklist I-P8). The persist key keeps its old name so a DM's accumulated signal
 * survives the generalisation; `migrate` files the flat v0 map under the 'random-tables' kind
 * it always meant.
 *
 * IT IS NO LONGER LOCALSTORAGE-ONLY (checklist I-P9). Every signal is written locally first and
 * posted to /api/item-usage second, and syncFromServer folds the server's counters back in on
 * mount - so rankings now follow the DM to a new browser or machine. localStorage stays as the
 * write-through cache rather than the source of truth: it is what makes recording a signal
 * instant on the click that opens a stat block mid-combat, and what keeps the ranking working
 * at a table with no internet. */
function isItemsTabKind(value: string): value is ItemsTabKind {
  return (ITEMS_TAB_KINDS as string[]).includes(value);
}

/** Fire-and-forget write-through. Failing to record a signal is not worth surfacing to a DM
 * mid-session - the local counter already took it, and the next event will try again. */
async function push(campaignId: string, kind: ItemsTabKind, itemId: string, event: 'use' | 'open'): Promise<void> {
  try {
    await recordItemUsage({ campaign_id: campaignId, kind, item_id: itemId, event });
  } catch (err) {
    console.error('Failed to record item usage', err);
  }
}

export const useItemUsageStore = create<ItemUsageStoreState>()(
  persist(
    (set, get) => ({
      byCampaignId: {},

      loadedCampaignIds: [],

      // Local first, server second, and the local write is never awaited: this runs on the
      // click that opens a stat block mid-combat, so it must not wait on a round trip, and a
      // failed post must not lose the signal or throw into a render path. The server increments
      // rather than being handed totals, so the two can never disagree about a count.
      recordUse: (campaignId, kind, itemId) => {
        set((state) => record(state, campaignId, kind, itemId, 'rolls'));
        void push(campaignId, kind, itemId, 'use');
      },
      recordOpen: (campaignId, kind, itemId) => {
        set((state) => record(state, campaignId, kind, itemId, 'opens'));
        void push(campaignId, kind, itemId, 'open');
      },

      clearCampaign: (campaignId) => {
        set((state) => ({ byCampaignId: { ...state.byCampaignId, [campaignId]: {} } }));
        void clearItemUsage(campaignId).catch((err) => console.error('Failed to clear item usage', err));
      },

      syncFromServer: async (campaignId) => {
        if (!campaignId || get().loadedCampaignIds.includes(campaignId)) return;
        set((state) => ({ loadedCampaignIds: [...state.loadedCampaignIds, campaignId] }));
        try {
          const rows = await listItemUsage(campaignId);
          set((state) => {
            const campaign: CampaignUsage = { ...(state.byCampaignId[campaignId] ?? {}) };
            rows.forEach((row) => {
              if (!isItemsTabKind(row.kind)) return;
              const map = { ...(campaign[row.kind] ?? EMPTY) };
              const local = map[row.item_id];
              const serverAt = new Date(row.last_used_at).getTime();
              // MAX, not sum: the local counters already include everything this browser
              // posted, so adding them would double-count its own history. Taking the larger of
              // the two folds in whatever ANOTHER machine contributed without inflating this
              // one - which is the whole point of promoting these to the server.
              map[row.item_id] = {
                rolls: Math.max(local?.rolls ?? 0, row.rolls),
                opens: Math.max(local?.opens ?? 0, row.opens),
                lastUsedAt: Math.max(local?.lastUsedAt ?? 0, Number.isNaN(serverAt) ? 0 : serverAt),
              };
              campaign[row.kind] = map;
            });
            return { byCampaignId: { ...state.byCampaignId, [campaignId]: campaign } };
          });
        } catch (err) {
          // Offline or the endpoint is down: the local counters still rank perfectly well, so
          // this is a soft failure by design. Drop the "loaded" mark so a later mount retries.
          console.error('Failed to load item usage', err);
          set((state) => ({ loadedCampaignIds: state.loadedCampaignIds.filter((id) => id !== campaignId) }));
        }
      },
    }),
    {
      name: 'worldwatcher-table-usage',
      version: 1,
      migrate: (persisted, version) => {
        if (version >= 1) return persisted as ItemUsageStoreState;
        // v0: byCampaignId[campaignId] was the random-table usage map itself.
        const state = persisted as { byCampaignId?: Record<string, ItemUsageMap> };
        const byCampaignId: Record<string, CampaignUsage> = {};
        Object.entries(state?.byCampaignId ?? {}).forEach(([campaignId, map]) => {
          byCampaignId[campaignId] = { 'random-tables': map };
        });
        return { ...(persisted as object), byCampaignId } as ItemUsageStoreState;
      },
    },
  ),
);

/** This campaign's usage map for one kind, as a stable reference - it is fed straight into
 * useMemo dependency lists that guard ranking passes over thousands of rows, so it must not be
 * a freshly-built object on every render. */
export function getItemUsage(byCampaignId: Record<string, CampaignUsage>, campaignId: string | undefined, kind: ItemsTabKind): ItemUsageMap {
  if (!campaignId) return EMPTY;
  return byCampaignId[campaignId]?.[kind] ?? EMPTY;
}
