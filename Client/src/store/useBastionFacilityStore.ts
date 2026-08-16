import { create } from 'zustand';
import type { BastionFacility } from '../types/bastion';
import { apiBastionFacilityToBastionFacility } from '../api/adapters';
import * as bastionsApi from '../api/resources/bastions';

export interface BastionFacilityBrowseParams {
  page: number;
  pageSize: number;
  search?: string;
  facilityType?: string[];
}

interface BastionFacilityBrowseResult {
  items: BastionFacility[];
  total: number;
}

interface BastionFacilityStoreState {
  facilityBrowse: BastionFacilityBrowseResult | null;
  facilityBrowseLoading: boolean;
  fetchFacilityBrowse: (params: BastionFacilityBrowseParams) => Promise<void>;
}

let browseRequestId = 0;

export const useBastionFacilityStore = create<BastionFacilityStoreState>((set) => ({
  facilityBrowse: null,
  facilityBrowseLoading: false,

  fetchFacilityBrowse: async (params) => {
    const requestId = ++browseRequestId;
    set({ facilityBrowseLoading: true });
    try {
      const page = await bastionsApi.listBastionFacilities({
        q: params.search || undefined,
        facility_type: params.facilityType?.length ? params.facilityType.join(',') : undefined,
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
      });
      if (requestId !== browseRequestId) return;
      set({
        facilityBrowse: { items: page.items.map(apiBastionFacilityToBastionFacility), total: page.meta.total },
        facilityBrowseLoading: false,
      });
    } catch (err) {
      if (requestId !== browseRequestId) return;
      console.error('Failed to load bastion facilities page', err);
      set({ facilityBrowseLoading: false });
    }
  },
}));
