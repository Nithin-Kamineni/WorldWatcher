import { apiDelete, apiGet, apiPatch, apiPost, apiPut, type Page, type QueryParams } from '../client';
import type { ApiGenerator, ApiGeneratorDetail, ApiGeneratorRollResult } from '../types';

export const listGenerators = (params: QueryParams) => apiGet<Page<ApiGenerator>>('/generators', params);
export const getGenerator = (id: string) => apiGet<ApiGeneratorDetail>(`/generators/${id}`);
export const createGenerator = (body: Record<string, unknown>) => apiPost<ApiGeneratorDetail>('/generators', body);
export const updateGenerator = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiGeneratorDetail>(`/generators/${id}`, body);
export const replaceGeneratorComponents = (id: string, body: Record<string, unknown>) =>
  apiPut<ApiGeneratorDetail>(`/generators/${id}/components`, body);
/** Task 11.4: forks a curated (is_system) generator into an editable copy the DM owns -
 * the escape hatch that makes the read-only rule on PATCH/DELETE liveable. Mirrors
 * cloneRandomTable. */
export const cloneGenerator = (id: string, campaignId?: string | null) =>
  apiPost<ApiGeneratorDetail>(`/generators/${id}/clone`, undefined, { campaign_id: campaignId ?? undefined });
export const deleteGenerator = (id: string) => apiDelete(`/generators/${id}`);
export const rollGenerator = (id: string, params: Record<string, string> = {}) =>
  apiPost<ApiGeneratorRollResult>(`/generators/${id}/roll`, { params });
