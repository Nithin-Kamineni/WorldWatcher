import { apiDelete, apiGet, apiPatch, apiPost, type Page, type QueryParams } from '../client';
import type { ApiQuest } from '../types';

export const listQuests = (params: QueryParams) => apiGet<Page<ApiQuest>>('/quests', params);
export const getQuest = (id: string) => apiGet<ApiQuest>(`/quests/${id}`);
export const createQuest = (body: Record<string, unknown>) => apiPost<ApiQuest>('/quests', body);
export const updateQuest = (id: string, body: Record<string, unknown>) => apiPatch<ApiQuest>(`/quests/${id}`, body);
export const deleteQuest = (id: string) => apiDelete(`/quests/${id}`);
