import { apiGet, apiPost, type QueryParams } from '../client';
import type { ApiTag } from '../types';

export const listTags = (params: QueryParams = {}) => apiGet<ApiTag[]>('/tags', params);
export const listTagNamespaces = () => apiGet<string[]>('/tags/namespaces');
export const createTag = (body: { namespace: string; value: string; label: string }) => apiPost<ApiTag>('/tags', body);
