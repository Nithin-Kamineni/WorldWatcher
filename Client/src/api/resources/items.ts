import { apiDelete, apiGet, apiPatch, apiPost, type Page, type QueryParams } from '../client';
import type { ApiItem } from '../types';

export const listItems = (params: QueryParams) => apiGet<Page<ApiItem>>('/items', params);
export const getItem = (id: string) => apiGet<ApiItem>(`/items/${id}`);
export const createItem = (body: Record<string, unknown>) => apiPost<ApiItem>('/items', body);
export const updateItem = (id: string, body: Record<string, unknown>) => apiPatch<ApiItem>(`/items/${id}`, body);
export const deleteItem = (id: string) => apiDelete(`/items/${id}`);
