import { apiDelete, apiGet, apiPatch, apiPost, type Page, type QueryParams } from '../client';
import type { ApiFaction, ApiFactionRelation } from '../types';

export const listFactions = (params: QueryParams) => apiGet<Page<ApiFaction>>('/factions', params);
export const getFaction = (id: string) => apiGet<ApiFaction>(`/factions/${id}`);
export const createFaction = (body: Record<string, unknown>) => apiPost<ApiFaction>('/factions', body);
export const updateFaction = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiFaction>(`/factions/${id}`, body);
export const deleteFaction = (id: string) => apiDelete(`/factions/${id}`);

export const listFactionRelations = (campaignId: string) =>
  apiGet<ApiFactionRelation[]>('/factions/relations', { campaign_id: campaignId });
export const createFactionRelation = (body: Record<string, unknown>) =>
  apiPost<ApiFactionRelation>('/factions/relations', body);
export const updateFactionRelation = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiFactionRelation>(`/factions/relations/${id}`, body);
export const deleteFactionRelation = (id: string) => apiDelete(`/factions/relations/${id}`);
