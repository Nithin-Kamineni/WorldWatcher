import { apiDelete, apiGet, apiPatch, apiPost, type Page } from '../client';
import type { ApiWorld } from '../types';

export const listWorlds = () => apiGet<Page<ApiWorld>>('/worlds', { limit: 100 });
export const getWorld = (id: string) => apiGet<ApiWorld>(`/worlds/${id}`);
export const createWorld = (body: Partial<ApiWorld>) => apiPost<ApiWorld>('/worlds', body);
export const updateWorld = (id: string, body: Partial<ApiWorld>) => apiPatch<ApiWorld>(`/worlds/${id}`, body);
export const deleteWorld = (id: string) => apiDelete(`/worlds/${id}`);
