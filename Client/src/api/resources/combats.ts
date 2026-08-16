import { apiDelete, apiGet, apiPatch, apiPost, type Page, type QueryParams } from '../client';
import type { ApiCombat, ApiCombatDetail, ApiCombatant } from '../types';

export const listCombats = (params: QueryParams) => apiGet<Page<ApiCombat>>('/combats', params);
export const getCombat = (id: string) => apiGet<ApiCombatDetail>(`/combats/${id}`);
export const updateCombat = (id: string, body: Record<string, unknown>) => apiPatch<ApiCombat>(`/combats/${id}`, body);
export const deleteCombat = (id: string) => apiDelete(`/combats/${id}`);

export const addCombatant = (combatId: string, body: Record<string, unknown>) =>
  apiPost<ApiCombatant>(`/combats/${combatId}/combatants`, body);
export const updateCombatant = (combatantId: string, body: Record<string, unknown>) =>
  apiPatch<ApiCombatant>(`/combats/combatants/${combatantId}`, body);
export const removeCombatant = (combatantId: string) => apiDelete(`/combats/combatants/${combatantId}`);

export const advanceTurn = (combatId: string) => apiPost<ApiCombatDetail>(`/combats/${combatId}/advance-turn`);
