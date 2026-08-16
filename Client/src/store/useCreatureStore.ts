import { create } from 'zustand';
import type { Creature, CreatureCategory } from '../types/creature';
import { apiCreatureToCreature, creatureToApiPayload } from '../api/adapters';
import * as creaturesApi from '../api/resources/creatures';

/** 'own' = just this campaign's homebrew (legacy behavior). 'own_or_global' = this campaign's
 * homebrew plus the shared/global reference library (campaign_id IS NULL server-side).
 * 'all' = every campaign's homebrew plus the global library, no campaign filtering at all. */
export type CreatureScope = 'own' | 'own_or_global' | 'all';

export interface CreatureBrowseParams {
  campaignId: string;
  /** Omit to include every category (monsters + NPCs). */
  category?: CreatureCategory;
  scope: CreatureScope;
  /** 1-indexed page number */
  page: number;
  pageSize: number;
  search?: string;
  relation?: string[];
  importance?: string[];
  /** monster-only filters */
  alignment?: string[];
  creatureType?: string[];
  acMin?: number;
  acMax?: number;
  crMin?: number;
  crMax?: number;
}

interface CreatureBrowseResult {
  items: Creature[];
  total: number;
}

interface CreatureStoreState {
  creaturesByCampaignId: Record<string, Creature[]>;
  loadedByCampaignId: Record<string, boolean>;
  fetchCreaturesForCampaign: (campaignId: string) => Promise<void>;
  addCreatureToCampaign: (campaignId: string, creature: Creature) => void;
  updateCreatureInCampaign: (campaignId: string, creature: Creature) => void;
  deleteCreatureFromCampaign: (campaignId: string, creatureId: string) => void;

  /** Paginated/searchable view backing the Monsters & NPCs tables - independent of
   * creaturesByCampaignId (which stays a full, campaign-only list for map/encounter lookups). */
  creatureBrowse: CreatureBrowseResult | null;
  creatureBrowseLoading: boolean;
  fetchCreatureBrowse: (params: CreatureBrowseParams) => Promise<void>;
}

// Module-level (not store state) so setting it doesn't trigger a re-render - it only guards
// against a slow, stale request overwriting a newer one's result.
let browseRequestId = 0;

export const useCreatureStore = create<CreatureStoreState>((set, get) => ({
  creaturesByCampaignId: {},
  loadedByCampaignId: {},

  fetchCreaturesForCampaign: async (campaignId) => {
    if (get().loadedByCampaignId[campaignId]) return;
    try {
      const page = await creaturesApi.listCreatures({ campaign_id: campaignId, limit: 200 });
      set((state) => ({
        creaturesByCampaignId: { ...state.creaturesByCampaignId, [campaignId]: page.items.map(apiCreatureToCreature) },
        loadedByCampaignId: { ...state.loadedByCampaignId, [campaignId]: true },
      }));
    } catch (err) {
      console.error(`Failed to load creatures for campaign ${campaignId}`, err);
    }
  },

  addCreatureToCampaign: (campaignId, creature) => {
    set((state) => ({
      creaturesByCampaignId: {
        ...state.creaturesByCampaignId,
        [campaignId]: [...(state.creaturesByCampaignId[campaignId] ?? []), creature],
      },
      creatureBrowse: state.creatureBrowse
        ? { items: [creature, ...state.creatureBrowse.items], total: state.creatureBrowse.total + 1 }
        : state.creatureBrowse,
    }));
    creatureToApiPayload(creature, campaignId, creature.category as CreatureCategory)
      .then((payload) => creaturesApi.createCreature({ id: creature.id, ...payload }))
      .catch((err) => console.error('Failed to persist new creature', err));
  },

  updateCreatureInCampaign: (campaignId, creature) => {
    set((state) => ({
      creaturesByCampaignId: {
        ...state.creaturesByCampaignId,
        [campaignId]: (state.creaturesByCampaignId[campaignId] ?? []).map((existing) =>
          existing.id === creature.id ? creature : existing,
        ),
      },
      creatureBrowse: state.creatureBrowse
        ? { ...state.creatureBrowse, items: state.creatureBrowse.items.map((c) => (c.id === creature.id ? creature : c)) }
        : state.creatureBrowse,
    }));
    creatureToApiPayload(creature, campaignId, creature.category as CreatureCategory)
      .then((payload) => creaturesApi.updateCreature(creature.id, payload))
      .catch((err) => console.error('Failed to persist creature update', err));
  },

  deleteCreatureFromCampaign: (campaignId, creatureId) => {
    set((state) => ({
      creaturesByCampaignId: {
        ...state.creaturesByCampaignId,
        [campaignId]: (state.creaturesByCampaignId[campaignId] ?? []).filter(
          (existing) => existing.id !== creatureId,
        ),
      },
      creatureBrowse: state.creatureBrowse
        ? {
            items: state.creatureBrowse.items.filter((c) => c.id !== creatureId),
            total: state.creatureBrowse.items.some((c) => c.id === creatureId)
              ? state.creatureBrowse.total - 1
              : state.creatureBrowse.total,
          }
        : state.creatureBrowse,
    }));
    creaturesApi.deleteCreature(creatureId).catch((err) => console.error('Failed to delete creature', err));
  },

  creatureBrowse: null,
  creatureBrowseLoading: false,

  fetchCreatureBrowse: async (params) => {
    const requestId = ++browseRequestId;
    set({ creatureBrowseLoading: true });
    try {
      const page = await creaturesApi.listCreatures({
        campaign_id: params.campaignId,
        scope: params.scope,
        category: params.category,
        q: params.search || undefined,
        relation: params.relation?.length ? params.relation.join(',') : undefined,
        importance: params.importance?.length ? params.importance.join(',') : undefined,
        alignment: params.alignment?.length ? params.alignment.join(',') : undefined,
        creature_type: params.creatureType?.length ? params.creatureType.join(',') : undefined,
        ac_min: params.acMin,
        ac_max: params.acMax,
        cr_min: params.crMin,
        cr_max: params.crMax,
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
      });
      if (requestId !== browseRequestId) return; // a newer request already landed
      set({
        creatureBrowse: { items: page.items.map(apiCreatureToCreature), total: page.meta.total },
        creatureBrowseLoading: false,
      });
    } catch (err) {
      if (requestId !== browseRequestId) return;
      console.error('Failed to load creatures page', err);
      set({ creatureBrowseLoading: false });
    }
  },
}));

export function getCreaturesForCampaign(
  creaturesByCampaignId: Record<string, Creature[]>,
  campaignId: string | undefined,
): Creature[] {
  if (!campaignId) return [];
  return creaturesByCampaignId[campaignId] ?? [];
}
