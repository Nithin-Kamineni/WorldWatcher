import { apiDelete, apiGet, apiPatch, apiPost, apiPut, type Page, type QueryParams } from '../client';
import type { ApiRandomTable, ApiRandomTableDetail, ApiRollResult } from '../types';

export const listRandomTables = (params: QueryParams) => apiGet<Page<ApiRandomTable>>('/random-tables', params);
export const getRandomTable = (id: string) => apiGet<ApiRandomTableDetail>(`/random-tables/${id}`);
export const createRandomTable = (body: Record<string, unknown>) => apiPost<ApiRandomTableDetail>('/random-tables', body);
export const updateRandomTable = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiRandomTableDetail>(`/random-tables/${id}`, body);
export const replaceRandomTableStructure = (id: string, body: Record<string, unknown>) =>
  apiPut<ApiRandomTableDetail>(`/random-tables/${id}/structure`, body);
export const replaceRandomTableTags = (id: string, tagIds: string[]) =>
  apiPut<ApiRandomTableDetail>(`/random-tables/${id}/tags`, { tag_ids: tagIds });
export const deleteRandomTable = (id: string) => apiDelete(`/random-tables/${id}`);
export const cloneRandomTable = (id: string, campaignId?: string | null) =>
  apiPost<ApiRandomTableDetail>(`/random-tables/${id}/clone`, undefined, { campaign_id: campaignId ?? undefined });
export const rollRandomTable = (id: string, body: Record<string, unknown> = {}) =>
  apiPost<ApiRollResult>(`/random-tables/${id}/roll`, body);
