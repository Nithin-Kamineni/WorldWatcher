import { create } from 'zustand';
import type { MagicItem } from '../types/magicItem';
import { apiItemToMagicItem, magicItemToApiPayload } from '../api/adapters';
import * as itemsApi from '../api/resources/items';
import type { CreatureScope } from './useCreatureStore';

export interface MagicItemBrowseParams {
  campaignId: string;
  scope: CreatureScope;
  /** 1-indexed page number */
  page: number;
  pageSize: number;
  search?: string;
  rarity?: string[];
  requiresAttunement?: boolean;
}

interface MagicItemBrowseResult {
  items: MagicItem[];
  total: number;
}

interface MagicItemStoreState {
  magicItemsByCampaignId: Record<string, MagicItem[]>;
  loadedByCampaignId: Record<string, boolean>;
  fetchMagicItemsForCampaign: (campaignId: string) => Promise<void>;
  addMagicItemToCampaign: (campaignId: string, item: MagicItem) => void;
  updateMagicItemInCampaign: (campaignId: string, item: MagicItem) => void;
  deleteMagicItemFromCampaign: (campaignId: string, itemId: string) => void;

  magicItemBrowse: MagicItemBrowseResult | null;
  magicItemBrowseLoading: boolean;
  fetchMagicItemBrowse: (params: MagicItemBrowseParams) => Promise<void>;
}

let browseRequestId = 0;

export const useMagicItemStore = create<MagicItemStoreState>((set, get) => ({
  magicItemsByCampaignId: {},
  loadedByCampaignId: {},

  fetchMagicItemsForCampaign: async (campaignId) => {
    if (get().loadedByCampaignId[campaignId]) return;
    try {
      const page = await itemsApi.listItems({ campaign_id: campaignId, limit: 200 });
      set((state) => ({
        magicItemsByCampaignId: { ...state.magicItemsByCampaignId, [campaignId]: page.items.map(apiItemToMagicItem) },
        loadedByCampaignId: { ...state.loadedByCampaignId, [campaignId]: true },
      }));
    } catch (err) {
      console.error(`Failed to load magic items for campaign ${campaignId}`, err);
    }
  },

  addMagicItemToCampaign: (campaignId, item) => {
    set((state) => ({
      magicItemsByCampaignId: {
        ...state.magicItemsByCampaignId,
        [campaignId]: [...(state.magicItemsByCampaignId[campaignId] ?? []), item],
      },
      magicItemBrowse: state.magicItemBrowse
        ? { items: [item, ...state.magicItemBrowse.items], total: state.magicItemBrowse.total + 1 }
        : state.magicItemBrowse,
    }));
    magicItemToApiPayload(item, campaignId)
      .then((payload) => itemsApi.createItem({ id: item.id, ...payload }))
      .catch((err) => console.error('Failed to persist new magic item', err));
  },

  updateMagicItemInCampaign: (campaignId, item) => {
    set((state) => ({
      magicItemsByCampaignId: {
        ...state.magicItemsByCampaignId,
        [campaignId]: (state.magicItemsByCampaignId[campaignId] ?? []).map((existing) =>
          existing.id === item.id ? item : existing,
        ),
      },
      magicItemBrowse: state.magicItemBrowse
        ? { ...state.magicItemBrowse, items: state.magicItemBrowse.items.map((i) => (i.id === item.id ? item : i)) }
        : state.magicItemBrowse,
    }));
    magicItemToApiPayload(item, campaignId)
      .then((payload) => itemsApi.updateItem(item.id, payload))
      .catch((err) => console.error('Failed to persist magic item update', err));
  },

  deleteMagicItemFromCampaign: (campaignId, itemId) => {
    set((state) => ({
      magicItemsByCampaignId: {
        ...state.magicItemsByCampaignId,
        [campaignId]: (state.magicItemsByCampaignId[campaignId] ?? []).filter((existing) => existing.id !== itemId),
      },
      magicItemBrowse: state.magicItemBrowse
        ? {
            items: state.magicItemBrowse.items.filter((i) => i.id !== itemId),
            total: state.magicItemBrowse.items.some((i) => i.id === itemId)
              ? state.magicItemBrowse.total - 1
              : state.magicItemBrowse.total,
          }
        : state.magicItemBrowse,
    }));
    itemsApi.deleteItem(itemId).catch((err) => console.error('Failed to delete magic item', err));
  },

  magicItemBrowse: null,
  magicItemBrowseLoading: false,

  fetchMagicItemBrowse: async (params) => {
    const requestId = ++browseRequestId;
    set({ magicItemBrowseLoading: true });
    try {
      const page = await itemsApi.listItems({
        campaign_id: params.campaignId,
        scope: params.scope,
        q: params.search || undefined,
        rarity: params.rarity?.length ? params.rarity.join(',') : undefined,
        requires_attunement: params.requiresAttunement,
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
      });
      if (requestId !== browseRequestId) return;
      set({
        magicItemBrowse: { items: page.items.map(apiItemToMagicItem), total: page.meta.total },
        magicItemBrowseLoading: false,
      });
    } catch (err) {
      if (requestId !== browseRequestId) return;
      console.error('Failed to load magic items page', err);
      set({ magicItemBrowseLoading: false });
    }
  },
}));

export function getMagicItemsForCampaign(
  magicItemsByCampaignId: Record<string, MagicItem[]>,
  campaignId: string | undefined,
): MagicItem[] {
  if (!campaignId) return [];
  return magicItemsByCampaignId[campaignId] ?? [];
}
