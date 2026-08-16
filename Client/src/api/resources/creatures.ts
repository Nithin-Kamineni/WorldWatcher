import { apiDelete, apiGet, apiPatch, apiPost, type Page, type QueryParams } from '../client';
import type { ApiCreature, ApiCreatureDetail } from '../types';

export const listCreatures = (params: QueryParams) => apiGet<Page<ApiCreature>>('/creatures', params);
export const getCreature = (id: string) => apiGet<ApiCreatureDetail>(`/creatures/${id}`);
export const createCreature = (body: Record<string, unknown>) => apiPost<ApiCreature>('/creatures', body);
export const updateCreature = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiCreature>(`/creatures/${id}`, body);
export const deleteCreature = (id: string) => apiDelete(`/creatures/${id}`);
