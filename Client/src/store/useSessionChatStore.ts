import { create } from 'zustand';
import type { ChatMessage, SessionChat } from '../types/sessionChat';
import { apiSessionChatToSessionChat, sessionChatToApiPayload } from '../api/adapters';
import * as sessionChatApi from '../api/resources/sessionChat';

/** Campaign+note-scoped sibling of useNoteStore - same optimistic-update convention (local
 * state updates immediately, the API call fires in the background). See
 * Server session_chats model / /api/session-chats. */
interface SessionChatStoreState {
  chats: SessionChat[];
  loadedNoteKeys: string[];

  fetchChatsForNote: (campaignId: string, noteId: string) => Promise<void>;
  addChat: (chat: SessionChat) => void;
  appendMessage: (chatId: string, text: string) => void;
  renameChat: (id: string, name: string) => void;
  deleteChat: (id: string) => void;
}

// Keyed by `${campaignId}:${noteId}` - tracks an in-flight fetchChatsForNote() call so
// concurrent invocations (e.g. React StrictMode's double effect-invoke, or multiple mounted
// components) await the same fetch instead of each racing past the `loadedNoteKeys` guard
// below and issuing duplicate requests. Kept outside reactive state since it's a concurrency
// guard, not data.
const inFlightFetches = new Map<string, Promise<void>>();

export const useSessionChatStore = create<SessionChatStoreState>((set, get) => ({
  chats: [],
  loadedNoteKeys: [],

  fetchChatsForNote: (campaignId, noteId) => {
    const key = `${campaignId}:${noteId}`;
    if (get().loadedNoteKeys.includes(key)) return Promise.resolve();
    const existing = inFlightFetches.get(key);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const page = await sessionChatApi.listSessionChats(campaignId, noteId);
        const fetched = page.items.map(apiSessionChatToSessionChat);
        set((state) => ({
          chats: [...state.chats.filter((c) => c.noteId !== noteId), ...fetched],
          loadedNoteKeys: [...state.loadedNoteKeys, key],
        }));
      } catch (err) {
        console.error(`Failed to load session chats for note ${noteId}`, err);
      } finally {
        inFlightFetches.delete(key);
      }
    })();
    inFlightFetches.set(key, promise);
    return promise;
  },

  addChat: (chat) => {
    set((state) => ({ chats: [...state.chats, chat] }));
    sessionChatApi
      .createSessionChat(sessionChatToApiPayload(chat))
      .catch((err) => console.error('Failed to persist new session chat', err));
  },

  appendMessage: (chatId, text) => {
    let merged: SessionChat | undefined;
    set((state) => ({
      chats: state.chats.map((c) => {
        if (c.id !== chatId) return c;
        const message: ChatMessage = { id: crypto.randomUUID(), text, createdAt: Date.now() };
        merged = { ...c, messages: [...c.messages, message], updatedAt: Date.now() };
        return merged;
      }),
    }));
    if (merged) {
      sessionChatApi
        .updateSessionChat(chatId, sessionChatToApiPayload(merged))
        .catch((err) => console.error('Failed to persist session chat message', err));
    }
  },

  renameChat: (id, name) => {
    let merged: SessionChat | undefined;
    set((state) => ({
      chats: state.chats.map((c) => {
        if (c.id !== id) return c;
        merged = { ...c, name, updatedAt: Date.now() };
        return merged;
      }),
    }));
    if (merged) {
      sessionChatApi
        .updateSessionChat(id, sessionChatToApiPayload(merged))
        .catch((err) => console.error('Failed to persist session chat rename', err));
    }
  },

  deleteChat: (id) => {
    set((state) => ({ chats: state.chats.filter((c) => c.id !== id) }));
    sessionChatApi.deleteSessionChat(id).catch((err) => console.error('Failed to delete session chat', err));
  },
}));

export function getChatsForNote(chats: SessionChat[], noteId: string | undefined): SessionChat[] {
  if (!noteId) return [];
  return chats.filter((c) => c.noteId === noteId).sort((a, b) => b.updatedAt - a.updatedAt);
}
