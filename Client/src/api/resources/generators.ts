import { apiDelete, apiGet, apiPatch, apiPost, apiPut, type Page, type QueryParams } from '../client';
import type { ApiGenerator, ApiGeneratorDetail, ApiGeneratorRollResult } from '../types';

export const listGenerators = (params: QueryParams) => apiGet<Page<ApiGenerator>>('/generators', params);
export const getGenerator = (id: string) => apiGet<ApiGeneratorDetail>(`/generators/${id}`);
export const createGenerator = (body: Record<string, unknown>) => apiPost<ApiGeneratorDetail>('/generators', body);
export const updateGenerator = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiGeneratorDetail>(`/generators/${id}`, body);
export const replaceGeneratorComponents = (id: string, body: Record<string, unknown>) =>
  apiPut<ApiGeneratorDetail>(`/generators/${id}/components`, body);
export const deleteGenerator = (id: string) => apiDelete(`/generators/${id}`);
export const rollGenerator = (id: string, params: Record<string, string> = {}) =>
  apiPost<ApiGeneratorRollResult>(`/generators/${id}/roll`, { params });
