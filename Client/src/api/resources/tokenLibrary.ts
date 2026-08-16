import { apiDelete, apiGet, apiPatch, apiPost, type Page, type QueryParams } from '../client';
import type { ApiTokenLibraryEntry } from '../types';

export const listTokenLibrary = (params: QueryParams = {}) =>
  apiGet<Page<ApiTokenLibraryEntry>>('/token-library', { limit: 200, ...params });
export const createTokenLibraryEntry = (body: Record<string, unknown>) =>
  apiPost<ApiTokenLibraryEntry>('/token-library', body);
export const updateTokenLibraryEntry = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiTokenLibraryEntry>(`/token-library/${id}`, body);
export const deleteTokenLibraryEntry = (id: string) => apiDelete(`/token-library/${id}`);
