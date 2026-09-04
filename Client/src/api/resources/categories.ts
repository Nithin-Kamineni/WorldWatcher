import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import type { ApiCategory, ApiCategoryNode } from '../types';

export const listCategories = () => apiGet<ApiCategory[]>('/categories');
export const getCategoryTree = () => apiGet<ApiCategoryNode[]>('/categories/tree');
export const getCategorySubtree = (id: string) => apiGet<ApiCategoryNode>(`/categories/${id}/subtree`);
export const createCategory = (body: Record<string, unknown>) => apiPost<ApiCategory>('/categories', body);
export const updateCategory = (id: string, body: Record<string, unknown>) => apiPatch<ApiCategory>(`/categories/${id}`, body);
export const deleteCategory = (id: string) => apiDelete(`/categories/${id}`);
