import { create } from 'zustand';
import type { Bastion, BastionFacilityInstance } from '../types/bastion';
import { apiBastionToBastion, bastionFacilityInstanceToApiPayload, bastionToApiPayload } from '../api/adapters';
import * as bastionsApi from '../api/resources/bastions';

interface BastionStoreState {
  bastionsByCampaignId: Record<string, Bastion[]>;
  loadedByCampaignId: Record<string, boolean>;
  fetchBastionsForCampaign: (campaignId: string) => Promise<void>;
  fetchBastionDetail: (campaignId: string, bastionId: string) => Promise<void>;
  addBastionToCampaign: (campaignId: string, bastion: Bastion) => void;
  updateBastionInCampaign: (campaignId: string, bastion: Bastion) => void;
  deleteBastionFromCampaign: (campaignId: string, bastionId: string) => void;

  addFacilityToBastion: (campaignId: string, bastionId: string, instance: BastionFacilityInstance) => void;
  updateFacilityInstance: (campaignId: string, bastionId: string, instance: BastionFacilityInstance) => void;
  removeFacilityInstance: (campaignId: string, bastionId: string, instanceId: string) => void;
}

function replaceBastion(
  state: BastionStoreState,
  campaignId: string,
  bastionId: string,
  updater: (bastion: Bastion) => Bastion,
) {
  return {
    bastionsByCampaignId: {
      ...state.bastionsByCampaignId,
      [campaignId]: (state.bastionsByCampaignId[campaignId] ?? []).map((b) => (b.id === bastionId ? updater(b) : b)),
    },
  };
}

export const useBastionStore = create<BastionStoreState>((set, get) => ({
  bastionsByCampaignId: {},
  loadedByCampaignId: {},

  fetchBastionsForCampaign: async (campaignId) => {
    if (get().loadedByCampaignId[campaignId]) return;
    try {
      const page = await bastionsApi.listBastions({ campaign_id: campaignId, limit: 200 });
      set((state) => ({
        bastionsByCampaignId: { ...state.bastionsByCampaignId, [campaignId]: page.items.map(apiBastionToBastion) },
        loadedByCampaignId: { ...state.loadedByCampaignId, [campaignId]: true },
      }));
    } catch (err) {
      console.error(`Failed to load bastions for campaign ${campaignId}`, err);
    }
  },

  fetchBastionDetail: async (campaignId, bastionId) => {
    try {
      const detail = await bastionsApi.getBastion(bastionId);
      const bastion = apiBastionToBastion(detail);
      set((state) => replaceBastion(state, campaignId, bastionId, () => bastion));
    } catch (err) {
      console.error(`Failed to load bastion ${bastionId}`, err);
    }
  },

  addBastionToCampaign: (campaignId, bastion) => {
    set((state) => ({
      bastionsByCampaignId: {
        ...state.bastionsByCampaignId,
        [campaignId]: [...(state.bastionsByCampaignId[campaignId] ?? []), bastion],
      },
    }));
    bastionsApi
      .createBastion({ id: bastion.id, ...bastionToApiPayload(bastion, campaignId) })
      .catch((err) => console.error('Failed to persist new bastion', err));
  },

  updateBastionInCampaign: (campaignId, bastion) => {
    set((state) => replaceBastion(state, campaignId, bastion.id, () => bastion));
    bastionsApi
      .updateBastion(bastion.id, bastionToApiPayload(bastion, campaignId))
      .catch((err) => console.error('Failed to persist bastion update', err));
  },

  deleteBastionFromCampaign: (campaignId, bastionId) => {
    set((state) => ({
      bastionsByCampaignId: {
        ...state.bastionsByCampaignId,
        [campaignId]: (state.bastionsByCampaignId[campaignId] ?? []).filter((b) => b.id !== bastionId),
      },
    }));
    bastionsApi.deleteBastion(bastionId).catch((err) => console.error('Failed to delete bastion', err));
  },

  addFacilityToBastion: (campaignId, bastionId, instance) => {
    set((state) => replaceBastion(state, campaignId, bastionId, (b) => ({ ...b, facilities: [...b.facilities, instance] })));
    bastionsApi
      .addBastionFacilityInstance(bastionId, { id: instance.id, ...bastionFacilityInstanceToApiPayload(instance) })
      .catch((err) => console.error('Failed to persist new bastion facility', err));
  },

  updateFacilityInstance: (campaignId, bastionId, instance) => {
    set((state) =>
      replaceBastion(state, campaignId, bastionId, (b) => ({
        ...b,
        facilities: b.facilities.map((f) => (f.id === instance.id ? instance : f)),
      })),
    );
    bastionsApi
      .updateBastionFacilityInstance(instance.id, bastionFacilityInstanceToApiPayload(instance))
      .catch((err) => console.error('Failed to persist bastion facility update', err));
  },

  removeFacilityInstance: (campaignId, bastionId, instanceId) => {
    set((state) =>
      replaceBastion(state, campaignId, bastionId, (b) => ({
        ...b,
        facilities: b.facilities.filter((f) => f.id !== instanceId),
      })),
    );
    bastionsApi.removeBastionFacilityInstance(instanceId).catch((err) => console.error('Failed to delete bastion facility', err));
  },
}));

export function getBastionsForCampaign(
  bastionsByCampaignId: Record<string, Bastion[]>,
  campaignId: string | undefined,
): Bastion[] {
  if (!campaignId) return [];
  return bastionsByCampaignId[campaignId] ?? [];
}
