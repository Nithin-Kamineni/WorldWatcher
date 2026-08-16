import { apiDelete, apiGet, apiPatch, apiPost, type Page, type QueryParams } from '../client';
import type { ApiRandomEncounterTable } from '../types';

export const listRandomEncounterTables = (params: QueryParams) =>
  apiGet<Page<ApiRandomEncounterTable>>('/random-encounter-tables', params);
export const getRandomEncounterTable = (id: string) => apiGet<ApiRandomEncounterTable>(`/random-encounter-tables/${id}`);
export const createRandomEncounterTable = (body: Record<string, unknown>) =>
  apiPost<ApiRandomEncounterTable>('/random-encounter-tables', body);
export const updateRandomEncounterTable = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiRandomEncounterTable>(`/random-encounter-tables/${id}`, body);
export const deleteRandomEncounterTable = (id: string) => apiDelete(`/random-encounter-tables/${id}`);
