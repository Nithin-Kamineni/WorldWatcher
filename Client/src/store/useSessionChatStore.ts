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
  /** Every chat in the campaign, whichever note it hangs off - what the "DM Notes" folder
   * lists (issues.txt 10.b.3). Kept separate from fetchChatsForNote so the per-note guard
   * above still short-circuits the Play page's own load. */
  fetchChatsForCampaign: (campaignId: string) => Promise<void>;
  addChat: (chat: SessionChat) => void;
  appendMessage: (chatId: string, text: string) => void;
  /** Rewrite one message in place, stamping editedAt (ChatDetailPage's message editing).
   * Messages are a whole-array-replace JSONB column server-side, so this persists the same
   * way appendMessage does - there are no per-message endpoints. */
  updateMessage: (chatId: string, messageId: string, text: string) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
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

  fetchChatsForCampaign: (campaignId) => {
    const key = `campaign:${campaignId}`;
    if (get().loadedNoteKeys.includes(key)) return Promise.resolve();
    const existing = inFlightFetches.get(key);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const page = await sessionChatApi.listSessionChats(campaignId);
        const fetched = page.items.map(apiSessionChatToSessionChat);
        // Replaces this campaign's chats wholesale - a campaign-wide fetch is authoritative
        // for it, unlike the per-note fetch which only knows about one note's threads.
        set((state) => ({
          chats: [...state.chats.filter((c) => c.campaignId !== campaignId), ...fetched],
          loadedNoteKeys: [...state.loadedNoteKeys, key],
        }));
      } catch (err) {
        console.error(`Failed to load session chats for campaign ${campaignId}`, err);
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

  updateMessage: (chatId, messageId, text) => {
    let merged: SessionChat | undefined;
    set((state) => ({
      chats: state.chats.map((c) => {
        if (c.id !== chatId) return c;
        merged = {
          ...c,
          messages: c.messages.map((m) => (m.id === messageId ? { ...m, text, editedAt: Date.now() } : m)),
          updatedAt: Date.now(),
        };
        return merged;
      }),
    }));
    if (merged) {
      sessionChatApi
        .updateSessionChat(chatId, sessionChatToApiPayload(merged))
        .catch((err) => console.error('Failed to persist session chat message edit', err));
    }
  },

  deleteMessage: (chatId, messageId) => {
    let merged: SessionChat | undefined;
    set((state) => ({
      chats: state.chats.map((c) => {
        if (c.id !== chatId) return c;
        merged = { ...c, messages: c.messages.filter((m) => m.id !== messageId), updatedAt: Date.now() };
        return merged;
      }),
    }));
    if (merged) {
      sessionChatApi
        .updateSessionChat(chatId, sessionChatToApiPayload(merged))
        .catch((err) => console.error('Failed to persist session chat message deletion', err));
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

/** Most recently touched first - the DM Notes folder's ordering, matching getChatsForNote. */
export function getChatsForCampaign(chats: SessionChat[], campaignId: string | undefined): SessionChat[] {
  if (!campaignId) return [];
  return chats.filter((c) => c.campaignId === campaignId).sort((a, b) => b.updatedAt - a.updatedAt);
}
