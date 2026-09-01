import { apiDelete, apiGet, apiPatch, apiPost, type Page } from '../client';
import type { ApiNote, ApiNoteFolder } from '../types';

export const listNotes = (campaignId: string) => apiGet<Page<ApiNote>>('/notes', { campaign_id: campaignId, limit: 500 });
export const createNote = (body: Record<string, unknown>) => apiPost<ApiNote>('/notes', body);
export const updateNote = (id: string, body: Record<string, unknown>) => apiPatch<ApiNote>(`/notes/${id}`, body);
export const deleteNote = (id: string) => apiDelete(`/notes/${id}`);

export const listNoteFolders = (campaignId: string) =>
  apiGet<Page<ApiNoteFolder>>('/note-folders', { campaign_id: campaignId, limit: 500 });
export const createNoteFolder = (body: Record<string, unknown>) => apiPost<ApiNoteFolder>('/note-folders', body);
export const updateNoteFolder = (id: string, body: Record<string, unknown>) =>
  apiPatch<ApiNoteFolder>(`/note-folders/${id}`, body);
export const deleteNoteFolder = (id: string) => apiDelete(`/note-folders/${id}`);
