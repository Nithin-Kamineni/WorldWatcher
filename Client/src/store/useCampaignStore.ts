import { create } from 'zustand';
import type { Campaign } from '../types/campaign';
import type { GridType, MapData, MapFloor, MapKind, MapSetting } from '../types/map';
import { apiCampaignToCampaign, assembleMapFloor } from '../api/adapters';
import * as campaignsApi from '../api/resources/campaigns';
import * as mapsApi from '../api/resources/maps';
import * as tokensApi from '../api/resources/mapTokens';
import type { ApiMap } from '../api/types';
import {
  createMapOnBackend,
  customDetailsFromSettings,
  deleteMapOnBackend,
  syncFloorContentChange,
  updateMapOnBackend,
} from './sync/mapSync';

interface CampaignStoreState {
  campaigns: Campaign[];
  campaignsLoading: boolean;
  campaignsLoaded: boolean;
  mapsByCampaignId: Record<string, MapData[]>;
  mapsLoadedByCampaignId: Record<string, boolean>;
  activeCampaignId: string | null;
  activeMapId: string | null;

  fetchCampaigns: () => Promise<void>;
  fetchMapsForCampaign: (campaignId: string) => Promise<void>;
  addMapToCampaign: (campaignId: string, map: MapData) => void;
  updateMapInCampaign: (campaignId: string, map: MapData) => void;
  deleteMapFromCampaign: (campaignId: string, mapId: string) => void;
  updateFloorInMap: (
    campaignId: string,
    mapId: string,
    floorId: string,
    updater: (floor: MapFloor) => MapFloor,
  ) => void;
  applyRemoteFloorPatch: (
    campaignId: string,
    mapId: string,
    floorId: string,
    updater: (floor: MapFloor) => MapFloor,
  ) => void;
  setActiveCampaign: (campaignId: string | null) => void;
  setActiveMap: (mapId: string | null) => void;
}

async function assembleMapData(apiMap: ApiMap): Promise<MapData> {
  const apiFloors = await mapsApi.listMapFloors(apiMap.id);
  const floors: MapFloor[] = [];
  for (const apiFloor of apiFloors) {
    const [tokens, shapes] = await Promise.all([
      tokensApi.listMapTokens(apiFloor.id),
      tokensApi.listMapShapes(apiFloor.id),
    ]);
    floors.push(assembleMapFloor(apiFloor, tokens, shapes));
  }
  return {
    id: apiMap.id,
    name: apiMap.name,
    description: apiMap.description ?? '',
    kinds: apiMap.map_kinds as MapKind[],
    floors,
    primaryFloorId: apiMap.primary_floor_id ?? floors[0]?.id ?? '',
    gridEnabled: apiMap.grid_enabled,
    gridSize: apiMap.grid_size,
    gridColor: apiMap.grid_color,
    gridThickness: apiMap.grid_thickness,
    gridType: apiMap.grid_type as GridType,
    location: apiMap.map_location_text ?? undefined,
    setting: (apiMap.setting as MapSetting | null) ?? undefined,
    activity: apiMap.activity ?? undefined,
    customDetails: customDetailsFromSettings(apiMap.settings),
    createdAt: Date.parse(apiMap.created_at) || Date.now(),
    updatedAt: Date.parse(apiMap.updated_at) || Date.now(),
  };
}

export const useCampaignStore = create<CampaignStoreState>((set, get) => ({
  campaigns: [],
  campaignsLoading: false,
  campaignsLoaded: false,
  mapsByCampaignId: {},
  mapsLoadedByCampaignId: {},
  activeCampaignId: null,
  activeMapId: null,

  fetchCampaigns: async () => {
    if (get().campaignsLoaded || get().campaignsLoading) return;
    set({ campaignsLoading: true });
    try {
      const page = await campaignsApi.listCampaigns();
      set({ campaigns: page.items.map(apiCampaignToCampaign), campaignsLoaded: true });
    } catch (err) {
      console.error('Failed to load campaigns', err);
    } finally {
      set({ campaignsLoading: false });
    }
  },

  fetchMapsForCampaign: async (campaignId) => {
    if (get().mapsLoadedByCampaignId[campaignId]) return;
    try {
      const page = await mapsApi.listMaps({ campaign_id: campaignId, limit: 100 });
      const maps = await Promise.all(page.items.map(assembleMapData));
      set((state) => ({
        mapsByCampaignId: { ...state.mapsByCampaignId, [campaignId]: maps },
        mapsLoadedByCampaignId: { ...state.mapsLoadedByCampaignId, [campaignId]: true },
      }));
    } catch (err) {
      console.error(`Failed to load maps for campaign ${campaignId}`, err);
    }
  },

  addMapToCampaign: (campaignId, map) => {
    set((state) => ({
      mapsByCampaignId: {
        ...state.mapsByCampaignId,
        [campaignId]: [...(state.mapsByCampaignId[campaignId] ?? []), map],
      },
    }));
    createMapOnBackend(campaignId, map).catch((err) => console.error('Failed to persist new map', err));
  },

  updateMapInCampaign: (campaignId, map) => {
    const oldMap = get().mapsByCampaignId[campaignId]?.find((m) => m.id === map.id);
    set((state) => ({
      mapsByCampaignId: {
        ...state.mapsByCampaignId,
        [campaignId]: (state.mapsByCampaignId[campaignId] ?? []).map((existing) =>
          existing.id === map.id ? map : existing,
        ),
      },
    }));
    if (oldMap) {
      updateMapOnBackend(map.id, oldMap, map).catch((err) => console.error('Failed to persist map update', err));
    }
  },

  deleteMapFromCampaign: (campaignId, mapId) => {
    set((state) => ({
      mapsByCampaignId: {
        ...state.mapsByCampaignId,
        [campaignId]: (state.mapsByCampaignId[campaignId] ?? []).filter((existing) => existing.id !== mapId),
      },
    }));
    deleteMapOnBackend(mapId).catch((err) => console.error('Failed to delete map', err));
  },

  updateFloorInMap: (campaignId, mapId, floorId, updater) => {
    const map = get().mapsByCampaignId[campaignId]?.find((m) => m.id === mapId);
    const oldFloor = map?.floors.find((f) => f.id === floorId);

    set((state) => ({
      mapsByCampaignId: {
        ...state.mapsByCampaignId,
        [campaignId]: (state.mapsByCampaignId[campaignId] ?? []).map((m) =>
          m.id !== mapId
            ? m
            : {
                ...m,
                updatedAt: Date.now(),
                floors: m.floors.map((floor) => (floor.id === floorId ? updater(floor) : floor)),
              },
        ),
      },
    }));

    if (oldFloor) {
      const newFloor = get()
        .mapsByCampaignId[campaignId]?.find((m) => m.id === mapId)
        ?.floors.find((f) => f.id === floorId);
      if (newFloor) {
        syncFloorContentChange(floorId, oldFloor, newFloor).catch((err) =>
          console.error('Failed to persist floor change', err),
        );
      }
    }
  },

  /** Applies a floor patch that originated on the backend (WebSocket
   * broadcast from another client, or an echo of our own REST call) -
   * local state only, never re-triggers syncFloorContentChange, so it
   * can't loop back into another network round-trip. */
  applyRemoteFloorPatch: (campaignId, mapId, floorId, updater) => {
    set((state) => ({
      mapsByCampaignId: {
        ...state.mapsByCampaignId,
        [campaignId]: (state.mapsByCampaignId[campaignId] ?? []).map((m) =>
          m.id !== mapId
            ? m
            : { ...m, floors: m.floors.map((floor) => (floor.id === floorId ? updater(floor) : floor)) },
        ),
      },
    }));
  },

  setActiveCampaign: (campaignId) => set({ activeCampaignId: campaignId }),
  setActiveMap: (mapId) => set({ activeMapId: mapId }),
}));

export function getCampaignById(campaigns: Campaign[], campaignId: string | undefined): Campaign | undefined {
  return campaigns.find((c) => c.id === campaignId);
}

export function getMapsForCampaign(
  mapsByCampaignId: Record<string, MapData[]>,
  campaignId: string | undefined,
): MapData[] {
  if (!campaignId) return [];
  return mapsByCampaignId[campaignId] ?? [];
}
