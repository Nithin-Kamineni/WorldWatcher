import { apiDelete, apiGet, apiPatch, apiPost, type Page, type QueryParams } from '../client';
import type { ApiCombatDetail, ApiEncounter, ApiEncounterCreature, ApiEncounterDetail } from '../types';

export const listEncounters = (params: QueryParams) => apiGet<Page<ApiEncounter>>('/encounters', params);
export const getEncounter = (id: string) => apiGet<ApiEncounterDetail>(`/encounters/${id}`);
export const createEncounter = (body: Record<string, unknown>) => apiPost<ApiEncounter>('/encounters', body);
export const updateEncounter = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiEncounter>(`/encounters/${id}`, body);
export const deleteEncounter = (id: string) => apiDelete(`/encounters/${id}`);

export const addEncounterCreature = (encounterId: string, body: Record<string, unknown>) =>
  apiPost<ApiEncounterCreature>(`/encounters/${encounterId}/creatures`, body);
export const updateEncounterCreature = (entryId: string, body: Record<string, unknown>) =>
  apiPatch<ApiEncounterCreature>(`/encounters/creatures/${entryId}`, body);
export const removeEncounterCreature = (entryId: string) => apiDelete(`/encounters/creatures/${entryId}`);

export const startCombat = (encounterId: string, mapFloorId?: string) =>
  apiPost<ApiCombatDetail>(`/encounters/${encounterId}/start-combat`, undefined, { map_floor_id: mapFloorId });
