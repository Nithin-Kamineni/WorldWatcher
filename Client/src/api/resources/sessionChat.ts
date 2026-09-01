import { apiDelete, apiGet, apiPatch, apiPost, type Page } from '../client';
import type { ApiSessionChat } from '../types';

export const listSessionChats = (campaignId: string, noteId?: string) =>
  apiGet<Page<ApiSessionChat>>('/session-chats', { campaign_id: campaignId, note_id: noteId, limit: 500 });
export const createSessionChat = (body: Record<string, unknown>) => apiPost<ApiSessionChat>('/session-chats', body);
export const updateSessionChat = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiSessionChat>(`/session-chats/${id}`, body);
export const deleteSessionChat = (id: string) => apiDelete(`/session-chats/${id}`);
