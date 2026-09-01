import { apiDelete, apiGet, apiPatch, apiPost, type Page } from '../client';
import type { ApiArticle, ApiArticleFolder } from '../types';

export const listArticles = (worldId: string) => apiGet<Page<ApiArticle>>('/articles', { world_id: worldId, limit: 500 });
export const createArticle = (body: Record<string, unknown>) => apiPost<ApiArticle>('/articles', body);
export const updateArticle = (id: string, body: Record<string, unknown>) => apiPatch<ApiArticle>(`/articles/${id}`, body);
export const deleteArticle = (id: string) => apiDelete(`/articles/${id}`);

export const listArticleFolders = (worldId: string) =>
  apiGet<Page<ApiArticleFolder>>('/article-folders', { world_id: worldId, limit: 500 });
export const createArticleFolder = (body: Record<string, unknown>) => apiPost<ApiArticleFolder>('/article-folders', body);
export const updateArticleFolder = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiArticleFolder>(`/article-folders/${id}`, body);
export const deleteArticleFolder = (id: string) => apiDelete(`/article-folders/${id}`);
