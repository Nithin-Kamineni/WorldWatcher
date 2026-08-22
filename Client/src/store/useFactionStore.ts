import { create } from 'zustand';
import type { Faction } from '../types/faction';
import type { FactionRelation } from '../types/factionRelation';
import {
  apiFactionRelationToFactionRelation,
  apiFactionToFaction,
  factionRelationToApiPayload,
  factionToApiPayload,
} from '../api/adapters';
import * as factionsApi from '../api/resources/factions';

interface FactionStoreState {
  factionsByCampaignId: Record<string, Faction[]>;
  loadedByCampaignId: Record<string, boolean>;
  relationsByCampaignId: Record<string, FactionRelation[]>;
  relationsLoadedByCampaignId: Record<string, boolean>;
  fetchFactionsForCampaign: (campaignId: string) => Promise<void>;
  addFactionToCampaign: (campaignId: string, faction: Faction) => void;
  updateFactionInCampaign: (campaignId: string, faction: Faction) => void;
  deleteFactionFromCampaign: (campaignId: string, factionId: string) => void;
  fetchRelationsForCampaign: (campaignId: string) => Promise<void>;
  addRelation: (relation: FactionRelation) => void;
  updateRelation: (relation: FactionRelation) => void;
  deleteRelation: (campaignId: string, relationId: string) => void;
}

export const useFactionStore = create<FactionStoreState>((set, get) => ({
  factionsByCampaignId: {},
  loadedByCampaignId: {},
  relationsByCampaignId: {},
  relationsLoadedByCampaignId: {},

  fetchFactionsForCampaign: async (campaignId) => {
    if (get().loadedByCampaignId[campaignId]) return;
    try {
      const page = await factionsApi.listFactions({ campaign_id: campaignId, limit: 200 });
      set((state) => ({
        factionsByCampaignId: { ...state.factionsByCampaignId, [campaignId]: page.items.map(apiFactionToFaction) },
        loadedByCampaignId: { ...state.loadedByCampaignId, [campaignId]: true },
      }));
    } catch (err) {
      console.error(`Failed to load factions for campaign ${campaignId}`, err);
    }
  },

  addFactionToCampaign: (campaignId, faction) => {
    set((state) => ({
      factionsByCampaignId: {
        ...state.factionsByCampaignId,
        [campaignId]: [...(state.factionsByCampaignId[campaignId] ?? []), faction],
      },
    }));
    factionToApiPayload(faction, campaignId)
      .then((payload) => factionsApi.createFaction({ id: faction.id, ...payload }))
      .catch((err) => console.error('Failed to persist new faction', err));
  },

  updateFactionInCampaign: (campaignId, faction) => {
    set((state) => ({
      factionsByCampaignId: {
        ...state.factionsByCampaignId,
        [campaignId]: (state.factionsByCampaignId[campaignId] ?? []).map((existing) =>
          existing.id === faction.id ? faction : existing,
        ),
      },
    }));
    factionToApiPayload(faction, campaignId)
      .then((payload) => factionsApi.updateFaction(faction.id, payload))
      .catch((err) => console.error('Failed to persist faction update', err));
  },

  deleteFactionFromCampaign: (campaignId, factionId) => {
    set((state) => ({
      factionsByCampaignId: {
        ...state.factionsByCampaignId,
        [campaignId]: (state.factionsByCampaignId[campaignId] ?? []).filter((existing) => existing.id !== factionId),
      },
      // The backend cascades relation rows on faction delete - mirror that locally too.
      relationsByCampaignId: {
        ...state.relationsByCampaignId,
        [campaignId]: (state.relationsByCampaignId[campaignId] ?? []).filter(
          (r) => r.factionAId !== factionId && r.factionBId !== factionId,
        ),
      },
    }));
    factionsApi.deleteFaction(factionId).catch((err) => console.error('Failed to delete faction', err));
  },

  fetchRelationsForCampaign: async (campaignId) => {
    if (get().relationsLoadedByCampaignId[campaignId]) return;
    try {
      const apiRelations = await factionsApi.listFactionRelations(campaignId);
      set((state) => ({
        relationsByCampaignId: {
          ...state.relationsByCampaignId,
          [campaignId]: apiRelations.map(apiFactionRelationToFactionRelation),
        },
        relationsLoadedByCampaignId: { ...state.relationsLoadedByCampaignId, [campaignId]: true },
      }));
    } catch (err) {
      console.error(`Failed to load faction relations for campaign ${campaignId}`, err);
    }
  },

  addRelation: (relation) => {
    set((state) => ({
      relationsByCampaignId: {
        ...state.relationsByCampaignId,
        [relation.campaignId]: [...(state.relationsByCampaignId[relation.campaignId] ?? []), relation],
      },
    }));
    factionsApi
      .createFactionRelation(factionRelationToApiPayload(relation, relation.campaignId))
      .catch((err) => console.error('Failed to persist new faction relation', err));
  },

  updateRelation: (relation) => {
    set((state) => ({
      relationsByCampaignId: {
        ...state.relationsByCampaignId,
        [relation.campaignId]: (state.relationsByCampaignId[relation.campaignId] ?? []).map((existing) =>
          existing.id === relation.id ? relation : existing,
        ),
      },
    }));
    factionsApi
      .updateFactionRelation(relation.id, factionRelationToApiPayload(relation, relation.campaignId))
      .catch((err) => console.error('Failed to persist faction relation update', err));
  },

  deleteRelation: (campaignId, relationId) => {
    set((state) => ({
      relationsByCampaignId: {
        ...state.relationsByCampaignId,
        [campaignId]: (state.relationsByCampaignId[campaignId] ?? []).filter((r) => r.id !== relationId),
      },
    }));
    factionsApi.deleteFactionRelation(relationId).catch((err) => console.error('Failed to delete faction relation', err));
  },
}));

export function getFactionsForCampaign(
  factionsByCampaignId: Record<string, Faction[]>,
  campaignId: string | undefined,
): Faction[] {
  if (!campaignId) return [];
  return factionsByCampaignId[campaignId] ?? [];
}

export function getFactionRelationsForCampaign(
  relationsByCampaignId: Record<string, FactionRelation[]>,
  campaignId: string | undefined,
): FactionRelation[] {
  if (!campaignId) return [];
  return relationsByCampaignId[campaignId] ?? [];
}
