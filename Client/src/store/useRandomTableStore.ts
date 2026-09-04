import { create } from 'zustand';
import type { RandomTable, RandomTableDetail, RollResult, TableColumn } from '../types/randomTable';
import {
  apiRandomTableDetailToDetail,
  apiRandomTableToTable,
  apiRollResultToResult,
  tableColumnToApiPayload,
} from '../api/adapters';
import * as randomTablesApi from '../api/resources/randomTables';
import type { PageMeta } from '../api/client';

/** Random-table summaries have a larger endpoint-specific cap because the category
 * browser needs the complete library to calculate branch counts. */
const SERVER_PAGE_LIMIT = 5000;

export const EMPTY_RANDOM_TABLE_RESULTS: RandomTable[] = [];

interface RandomTableResultSet {
  results: RandomTable[];
  resultsMeta: PageMeta | null;
  searching: boolean;
  /** Identifies the newest in-flight request for this consumer. */
  requestId?: string;
}

export interface RandomTableSearchParams {
  q?: string;
  categoryId?: string;
  formatId?: string;
  formatSlug?: string;
  tagIds?: string[];
  campaignId?: string;
  scope?: 'own' | 'own_or_global' | 'all';
  sort?: string;
  limit?: number;
  offset?: number;
}

interface RandomTableState {
  results: RandomTable[];
  resultsMeta: PageMeta | null;
  searching: boolean;
  resultSets: Record<string, RandomTableResultSet>;
  detailById: Record<string, RandomTableDetail>;
  search: (params: RandomTableSearchParams, resultKey?: string) => Promise<void>;
  fetchDetail: (id: string) => Promise<RandomTableDetail | null>;
  createTable: (payload: Record<string, unknown>) => Promise<RandomTableDetail | null>;
  updateTable: (id: string, payload: Record<string, unknown>) => Promise<RandomTableDetail | null>;
  replaceStructure: (id: string, columns: TableColumn[]) => Promise<RandomTableDetail | null>;
  replaceTags: (id: string, tagIds: string[]) => Promise<RandomTableDetail | null>;
  deleteTable: (id: string) => Promise<void>;
  cloneTable: (id: string, campaignId?: string | null) => Promise<RandomTableDetail | null>;
  roll: (id: string, body?: Record<string, unknown>) => Promise<RollResult | null>;
}

function toParams(params: RandomTableSearchParams): Record<string, string | number | boolean | undefined> {
  return {
    q: params.q,
    category_id: params.categoryId,
    format_id: params.formatId,
    format_slug: params.formatSlug,
    tag_ids: params.tagIds && params.tagIds.length > 0 ? params.tagIds.join(',') : undefined,
    campaign_id: params.campaignId,
    scope: params.scope ?? 'own_or_global',
    sort: params.sort,
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
  };
}

export const useRandomTableStore = create<RandomTableState>((set, get) => ({
  results: [],
  resultsMeta: null,
  searching: false,
  resultSets: {},
  detailById: {},

  search: async (params, resultKey = 'default') => {
    const requestId = crypto.randomUUID();
    set((state) => ({
      ...(resultKey === 'default' ? { searching: true } : {}),
      resultSets: {
        ...state.resultSets,
        [resultKey]: {
          results: state.resultSets[resultKey]?.results ?? [],
          resultsMeta: state.resultSets[resultKey]?.resultsMeta ?? null,
          searching: true,
          requestId,
        },
      },
    }));
    const publish = (results: RandomTable[], resultsMeta: PageMeta | null) => set((state) => {
      const current = state.resultSets[resultKey];
      if (current?.requestId !== requestId) return state;
      const resultSet = { results, resultsMeta, searching: false };
      return {
        ...(resultKey === 'default' ? { results, resultsMeta, searching: false } : {}),
        resultSets: { ...state.resultSets, [resultKey]: resultSet },
      };
    });
    try {
      const wantLimit = params.limit ?? 100;
      const baseParams = toParams(params);
      if (wantLimit <= SERVER_PAGE_LIMIT) {
        const page = await randomTablesApi.listRandomTables(baseParams);
        publish(page.items.map(apiRandomTableToTable), page.meta);
        return;
      }
      // The server caps a single request's `limit` at SERVER_PAGE_LIMIT, so a caller
      // asking for more (e.g. RandomTablesBrowseView wanting "the whole library" to
      // compute category counts/browsing) would otherwise be silently truncated to
      // whatever the first page's sort order happens to include - transparently page
      // through instead so growing the library never hides tables from that view.
      let offset = params.offset ?? 0;
      const items: RandomTable[] = [];
      let meta: PageMeta | null = null;
      for (let i = 0; i < 40 && items.length < wantLimit; i++) {
        const page = await randomTablesApi.listRandomTables({ ...baseParams, limit: SERVER_PAGE_LIMIT, offset });
        meta = page.meta;
        items.push(...page.items.map(apiRandomTableToTable));
        if (page.items.length < SERVER_PAGE_LIMIT) break;
        offset += SERVER_PAGE_LIMIT;
      }
      publish(items, meta ? { ...meta, count: items.length } : null);
    } catch (err) {
      console.error('Failed to search random tables', err);
      set((state) => {
        const current = state.resultSets[resultKey];
        if (current?.requestId !== requestId) return state;
        return {
          ...(resultKey === 'default' ? { searching: false } : {}),
          resultSets: {
            ...state.resultSets,
            [resultKey]: { results: current.results, resultsMeta: current.resultsMeta, searching: false },
          },
        };
      });
    }
  },

  fetchDetail: async (id) => {
    const cached = get().detailById[id];
    if (cached) return cached;
    try {
      const detail = apiRandomTableDetailToDetail(await randomTablesApi.getRandomTable(id));
      set((state) => ({ detailById: { ...state.detailById, [id]: detail } }));
      return detail;
    } catch (err) {
      console.error(`Failed to load random table ${id}`, err);
      return null;
    }
  },

  createTable: async (payload) => {
    try {
      const detail = apiRandomTableDetailToDetail(await randomTablesApi.createRandomTable(payload));
      set((state) => ({ detailById: { ...state.detailById, [detail.id]: detail } }));
      return detail;
    } catch (err) {
      console.error('Failed to create random table', err);
      return null;
    }
  },

  updateTable: async (id, payload) => {
    try {
      const detail = apiRandomTableDetailToDetail(await randomTablesApi.updateRandomTable(id, payload));
      set((state) => ({ detailById: { ...state.detailById, [id]: detail } }));
      return detail;
    } catch (err) {
      console.error(`Failed to update random table ${id}`, err);
      return null;
    }
  },

  replaceStructure: async (id, columns) => {
    try {
      const detail = apiRandomTableDetailToDetail(
        await randomTablesApi.replaceRandomTableStructure(id, { columns: columns.map(tableColumnToApiPayload) }),
      );
      set((state) => ({ detailById: { ...state.detailById, [id]: detail } }));
      return detail;
    } catch (err) {
      console.error(`Failed to replace structure for random table ${id}`, err);
      throw err;
    }
  },

  replaceTags: async (id, tagIds) => {
    try {
      const detail = apiRandomTableDetailToDetail(await randomTablesApi.replaceRandomTableTags(id, tagIds));
      set((state) => ({ detailById: { ...state.detailById, [id]: detail } }));
      return detail;
    } catch (err) {
      console.error(`Failed to replace tags for random table ${id}`, err);
      return null;
    }
  },

  deleteTable: async (id) => {
    try {
      await randomTablesApi.deleteRandomTable(id);
      set((state) => {
        const { [id]: _removed, ...rest } = state.detailById;
        return { detailById: rest, results: state.results.filter((t) => t.id !== id) };
      });
    } catch (err) {
      console.error(`Failed to delete random table ${id}`, err);
    }
  },

  cloneTable: async (id, campaignId) => {
    try {
      const detail = apiRandomTableDetailToDetail(await randomTablesApi.cloneRandomTable(id, campaignId));
      set((state) => ({ detailById: { ...state.detailById, [detail.id]: detail } }));
      return detail;
    } catch (err) {
      console.error(`Failed to clone random table ${id}`, err);
      return null;
    }
  },

  roll: async (id, body = {}) => {
    try {
      return apiRollResultToResult(await randomTablesApi.rollRandomTable(id, body));
    } catch (err) {
      console.error(`Failed to roll random table ${id}`, err);
      return null;
    }
  },
}));
