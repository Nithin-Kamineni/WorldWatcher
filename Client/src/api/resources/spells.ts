import { apiDelete, apiGet, apiPatch, apiPost, type Page, type QueryParams } from '../client';
import type { ApiSpell } from '../types';

export const listSpells = (params: QueryParams) => apiGet<Page<ApiSpell>>('/spells', params);
export const getSpell = (id: string) => apiGet<ApiSpell>(`/spells/${id}`);
export const createSpell = (body: Record<string, unknown>) => apiPost<ApiSpell>('/spells', body);
export const updateSpell = (id: string, body: Record<string, unknown>) => apiPatch<ApiSpell>(`/spells/${id}`, body);
export const deleteSpell = (id: string) => apiDelete(`/spells/${id}`);
