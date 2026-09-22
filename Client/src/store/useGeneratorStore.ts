import { create } from 'zustand';
import type { Generator, GeneratorComponent, GeneratorDetail, GeneratorRollResult } from '../types/generator';
import {
  apiGeneratorDetailToDetail,
  apiGeneratorRollResultToResult,
  apiGeneratorToGenerator,
  generatorComponentToApiPayload,
} from '../api/adapters';
import * as generatorsApi from '../api/resources/generators';
import type { PageMeta } from '../api/client';

export interface GeneratorSearchParams {
  q?: string;
  categoryId?: string;
  campaignId?: string;
  scope?: 'own' | 'own_or_global' | 'all';
  sort?: string;
}

interface GeneratorState {
  results: Generator[];
  resultsMeta: PageMeta | null;
  searching: boolean;
  detailById: Record<string, GeneratorDetail>;
  search: (params: GeneratorSearchParams) => Promise<void>;
  fetchDetail: (id: string) => Promise<GeneratorDetail | null>;
  createGenerator: (payload: Record<string, unknown>) => Promise<GeneratorDetail | null>;
  updateGenerator: (id: string, payload: Record<string, unknown>) => Promise<GeneratorDetail | null>;
  replaceComponents: (id: string, components: GeneratorComponent[]) => Promise<GeneratorDetail | null>;
  /** Task 11.4: clone-to-edit for curated generators - see cloneTable on useRandomTableStore. */
  cloneGenerator: (id: string, campaignId?: string | null) => Promise<GeneratorDetail | null>;
  deleteGenerator: (id: string) => Promise<void>;
  roll: (id: string, params?: Record<string, string>) => Promise<GeneratorRollResult | null>;
}

export const useGeneratorStore = create<GeneratorState>((set, get) => ({
  results: [],
  resultsMeta: null,
  searching: false,
  detailById: {},

  search: async (params) => {
    set({ searching: true });
    try {
      const page = await generatorsApi.listGenerators({
        q: params.q,
        category_id: params.categoryId,
        campaign_id: params.campaignId,
        scope: params.scope ?? 'own_or_global',
        sort: params.sort,
        limit: 100,
      });
      set({ results: page.items.map(apiGeneratorToGenerator), resultsMeta: page.meta, searching: false });
    } catch (err) {
      console.error('Failed to search generators', err);
      set({ searching: false });
    }
  },

  fetchDetail: async (id) => {
    const cached = get().detailById[id];
    if (cached) return cached;
    try {
      const detail = apiGeneratorDetailToDetail(await generatorsApi.getGenerator(id));
      set((state) => ({ detailById: { ...state.detailById, [id]: detail } }));
      return detail;
    } catch (err) {
      console.error(`Failed to load generator ${id}`, err);
      return null;
    }
  },

  createGenerator: async (payload) => {
    try {
      const detail = apiGeneratorDetailToDetail(await generatorsApi.createGenerator(payload));
      set((state) => ({ detailById: { ...state.detailById, [detail.id]: detail } }));
      return detail;
    } catch (err) {
      console.error('Failed to create generator', err);
      return null;
    }
  },

  updateGenerator: async (id, payload) => {
    try {
      const detail = apiGeneratorDetailToDetail(await generatorsApi.updateGenerator(id, payload));
      set((state) => ({ detailById: { ...state.detailById, [id]: detail } }));
      return detail;
    } catch (err) {
      console.error(`Failed to update generator ${id}`, err);
      return null;
    }
  },

  replaceComponents: async (id, components) => {
    try {
      const detail = apiGeneratorDetailToDetail(
        await generatorsApi.replaceGeneratorComponents(id, { components: components.map(generatorComponentToApiPayload) }),
      );
      set((state) => ({ detailById: { ...state.detailById, [id]: detail } }));
      return detail;
    } catch (err) {
      console.error(`Failed to replace components for generator ${id}`, err);
      return null;
    }
  },

  cloneGenerator: async (id, campaignId) => {
    try {
      const detail = apiGeneratorDetailToDetail(await generatorsApi.cloneGenerator(id, campaignId));
      set((state) => ({ detailById: { ...state.detailById, [detail.id]: detail } }));
      return detail;
    } catch (err) {
      console.error(`Failed to clone generator ${id}`, err);
      return null;
    }
  },

  deleteGenerator: async (id) => {
    try {
      await generatorsApi.deleteGenerator(id);
      set((state) => {
        const { [id]: _removed, ...rest } = state.detailById;
        return { detailById: rest, results: state.results.filter((g) => g.id !== id) };
      });
    } catch (err) {
      console.error(`Failed to delete generator ${id}`, err);
    }
  },

  roll: async (id, params = {}) => {
    try {
      return apiGeneratorRollResultToResult(await generatorsApi.rollGenerator(id, params));
    } catch (err) {
      console.error(`Failed to roll generator ${id}`, err);
      return null;
    }
  },
}));
