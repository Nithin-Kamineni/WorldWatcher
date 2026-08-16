import { apiGet, apiPost, type Page, type QueryParams } from '../client';
import type { ApiEffect } from '../types';

export const listEffects = (params: QueryParams = {}) => apiGet<Page<ApiEffect>>('/effects', { limit: 200, ...params });
export const createEffect = (body: Record<string, unknown>) => apiPost<ApiEffect>('/effects', body);
