import { apiDelete, apiGet, apiPatch, apiPost, type QueryParams } from '../client';
import type { ApiTableFormat } from '../types';

export const listTableFormats = (params: QueryParams = {}) => apiGet<ApiTableFormat[]>('/table-formats', params);
export const createTableFormat = (body: Record<string, unknown>) => apiPost<ApiTableFormat>('/table-formats', body);
export const updateTableFormat = (id: string, body: Record<string, unknown>) => apiPatch<ApiTableFormat>(`/table-formats/${id}`, body);
export const deleteTableFormat = (id: string) => apiDelete(`/table-formats/${id}`);
