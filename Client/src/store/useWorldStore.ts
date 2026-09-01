import { create } from 'zustand';
import type { Campaign } from '../types/campaign';
import type { World } from '../types/world';
import { apiWorldToWorld } from '../api/adapters';
import * as worldsApi from '../api/resources/worlds';

interface WorldStoreState {
  worlds: World[];
  worldsLoading: boolean;
  worldsLoaded: boolean;

  fetchWorlds: () => Promise<void>;
  addWorld: (name: string, description?: string, imageAssetId?: string) => Promise<World>;
  updateWorld: (id: string, patch: { name?: string; description?: string; imageAssetId?: string }) => Promise<void>;
  deleteWorld: (id: string) => Promise<void>;
}

export const useWorldStore = create<WorldStoreState>((set, get) => ({
  worlds: [],
  worldsLoading: false,
  worldsLoaded: false,

  fetchWorlds: async () => {
    if (get().worldsLoaded || get().worldsLoading) return;
    set({ worldsLoading: true });
    try {
      const page = await worldsApi.listWorlds();
      set({ worlds: page.items.map(apiWorldToWorld), worldsLoaded: true });
    } catch (err) {
      console.error('Failed to load worlds', err);
    } finally {
      set({ worldsLoading: false });
    }
  },

  addWorld: async (name, description, imageAssetId) => {
    const apiWorld = await worldsApi.createWorld({ name, description: description ?? null, image_asset_id: imageAssetId ?? null });
    const world = apiWorldToWorld(apiWorld);
    set((state) => ({ worlds: [...state.worlds, world] }));
    return world;
  },

  updateWorld: async (id, patch) => {
    const apiWorld = await worldsApi.updateWorld(id, {
      name: patch.name,
      description: patch.description,
      ...(patch.imageAssetId ? { image_asset_id: patch.imageAssetId } : {}),
    });
    const world = apiWorldToWorld(apiWorld);
    set((state) => ({ worlds: state.worlds.map((w) => (w.id === id ? world : w)) }));
  },

  deleteWorld: async (id) => {
    await worldsApi.deleteWorld(id);
    set((state) => ({ worlds: state.worlds.filter((w) => w.id !== id) }));
  },
}));

export function getWorldById(worlds: World[], worldId: string | undefined): World | undefined {
  return worlds.find((w) => w.id === worldId);
}

export function getCampaignsForWorld(campaigns: Campaign[], worldId: string | undefined): Campaign[] {
  if (!worldId) return [];
  return campaigns.filter((c) => c.worldId === worldId);
}

/** World-level pages (World Manager, Compendium) operate on real Campaign-scoped
 * data (NPCs/Factions/etc. haven't moved to World scope yet - see plan). This
 * picks the world's oldest campaign as the one they read/write against. */
export function getPrimaryCampaignForWorld(campaigns: Campaign[], worldId: string | undefined): Campaign | undefined {
  const worldCampaigns = getCampaignsForWorld(campaigns, worldId);
  if (worldCampaigns.length === 0) return undefined;
  return [...worldCampaigns].sort((a, b) => a.createdAt - b.createdAt)[0];
}
