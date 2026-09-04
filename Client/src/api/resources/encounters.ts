import { apiDelete, apiGet, apiPatch, apiPost, apiPut, type Page, type QueryParams } from '../client';
import type {
  ApiCombatDetail,
  ApiEncounter,
  ApiEncounterCombatBlock,
  ApiEncounterCreature,
  ApiEncounterDetail,
  ApiEncounterExplorationBlock,
  ApiEncounterNpc,
  ApiEncounterSocialBlock,
} from '../types';

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

export const addEncounterNpc = (encounterId: string, body: Record<string, unknown>) =>
  apiPost<ApiEncounterNpc>(`/encounters/${encounterId}/npcs`, body);
export const updateEncounterNpc = (entryId: string, body: Record<string, unknown>) =>
  apiPatch<ApiEncounterNpc>(`/encounters/npcs/${entryId}`, body);
export const removeEncounterNpc = (entryId: string) => apiDelete(`/encounters/npcs/${entryId}`);

export const upsertCombatBlock = (encounterId: string, body: Record<string, unknown>) =>
  apiPut<ApiEncounterCombatBlock>(`/encounters/${encounterId}/blocks/combat`, body);
export const deleteCombatBlock = (encounterId: string) => apiDelete(`/encounters/${encounterId}/blocks/combat`);
export const upsertSocialBlock = (encounterId: string, body: Record<string, unknown>) =>
  apiPut<ApiEncounterSocialBlock>(`/encounters/${encounterId}/blocks/social`, body);
export const deleteSocialBlock = (encounterId: string) => apiDelete(`/encounters/${encounterId}/blocks/social`);
export const upsertExplorationBlock = (encounterId: string, body: Record<string, unknown>) =>
  apiPut<ApiEncounterExplorationBlock>(`/encounters/${encounterId}/blocks/exploration`, body);
export const deleteExplorationBlock = (encounterId: string) => apiDelete(`/encounters/${encounterId}/blocks/exploration`);

export const replaceEncounterTags = (encounterId: string, tagIds: string[]) =>
  apiPut<string[]>(`/encounters/${encounterId}/tags`, { tag_ids: tagIds });

export const startCombat = (encounterId: string, mapFloorId?: string) =>
  apiPost<ApiCombatDetail>(`/encounters/${encounterId}/start-combat`, undefined, { map_floor_id: mapFloorId });
