import { create } from 'zustand';
import type { Note, NoteFolder } from '../types/note';
import { apiNoteFolderToNoteFolder, apiNoteToNote, noteFolderToApiPayload, noteToApiPayload } from '../api/adapters';
import * as notesApi from '../api/resources/notes';

/** Campaign-scoped sibling of useArticleStore - same optimistic-update convention (local
 * state updates immediately, the API call fires in the background). See
 * Server/app/models/note.py / /api/notes + /api/note-folders. */
interface NoteStoreState {
  notes: Note[];
  folders: NoteFolder[];
  loadedCampaignIds: string[];

  ensureSeeded: (campaignId: string) => Promise<void>;
  addNote: (note: Note) => void;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;

  addFolder: (folder: NoteFolder) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
}

// Keyed by campaignId - tracks an in-flight ensureSeeded() call so concurrent invocations
// (e.g. React StrictMode's double effect-invoke, or multiple mounted components) await the
// same fetch/seed instead of each racing past the `loadedCampaignIds` guard below and
// double-creating the default Sessions/Narratives folders. Kept outside reactive state since
// it's a concurrency guard, not data.
const inFlightSeeds = new Map<string, Promise<void>>();

export const useNoteStore = create<NoteStoreState>((set, get) => ({
  notes: [],
  folders: [],
  loadedCampaignIds: [],

  ensureSeeded: (campaignId) => {
    if (get().loadedCampaignIds.includes(campaignId)) return Promise.resolve();
    const existing = inFlightSeeds.get(campaignId);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const [notesPage, foldersPage] = await Promise.all([
          notesApi.listNotes(campaignId),
          notesApi.listNoteFolders(campaignId),
        ]);
        let fetchedNotes = notesPage.items.map(apiNoteToNote);
        let fetchedFolders = foldersPage.items.map(apiNoteFolderToNoteFolder);

        // First time this campaign is opened (no folders at all yet) - seed the two protected
        // root folders every campaign needs (Sessions/Narratives), persisted for real so they
        // only get created once, server-side.
        if (fetchedFolders.length === 0) {
          const [sessionsFolder, narrativesFolder] = await Promise.all([
            notesApi.createNoteFolder(
              noteFolderToApiPayload({
                id: crypto.randomUUID(),
                campaignId,
                parentId: null,
                name: 'Sessions',
                isDefault: true,
                defaultKind: 'session',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }),
            ),
            notesApi.createNoteFolder(
              noteFolderToApiPayload({
                id: crypto.randomUUID(),
                campaignId,
                parentId: null,
                name: 'Narratives',
                isDefault: true,
                defaultKind: 'narrative',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }),
            ),
          ]);
          fetchedFolders = [apiNoteFolderToNoteFolder(sessionsFolder), apiNoteFolderToNoteFolder(narrativesFolder)];
        }

        set((state) => ({
          notes: [...state.notes.filter((n) => n.campaignId !== campaignId), ...fetchedNotes],
          folders: [...state.folders.filter((f) => f.campaignId !== campaignId), ...fetchedFolders],
          loadedCampaignIds: [...state.loadedCampaignIds, campaignId],
        }));
      } catch (err) {
        console.error(`Failed to load notes for campaign ${campaignId}`, err);
      } finally {
        inFlightSeeds.delete(campaignId);
      }
    })();
    inFlightSeeds.set(campaignId, promise);
    return promise;
  },

  addNote: (note) => {
    set((state) => ({ notes: [...state.notes, note] }));
    notesApi.createNote(noteToApiPayload(note)).catch((err) => console.error('Failed to persist new note', err));
  },

  updateNote: (id, patch) => {
    let merged: Note | undefined;
    set((state) => ({
      notes: state.notes.map((n) => {
        if (n.id !== id) return n;
        merged = { ...n, ...patch, updatedAt: Date.now() };
        return merged;
      }),
    }));
    if (merged) {
      notesApi.updateNote(id, noteToApiPayload(merged)).catch((err) => console.error('Failed to persist note update', err));
    }
  },

  deleteNote: (id) => {
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
    notesApi.deleteNote(id).catch((err) => console.error('Failed to delete note', err));
  },

  addFolder: (folder) => {
    set((state) => ({ folders: [...state.folders, folder] }));
    notesApi.createNoteFolder(noteFolderToApiPayload(folder)).catch((err) => console.error('Failed to persist new folder', err));
  },

  renameFolder: (id, name) => {
    const folder = get().folders.find((f) => f.id === id);
    if (folder?.isDefault) {
      console.warn(`Refusing to rename default note folder "${folder.name}"`);
      return;
    }
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, name, updatedAt: Date.now() } : f)),
    }));
    notesApi.updateNoteFolder(id, { name }).catch((err) => console.error('Failed to persist folder rename', err));
  },

  deleteFolder: (id) => {
    const folder = get().folders.find((f) => f.id === id);
    if (folder?.isDefault) {
      console.warn(`Refusing to delete default note folder "${folder.name}"`);
      return;
    }
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id && f.parentId !== id),
      notes: state.notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)),
    }));
    // Server cascades child folder rows and SET NULLs notes.folder_id on delete - matches
    // the local state update above.
    notesApi.deleteNoteFolder(id).catch((err) => console.error('Failed to delete folder', err));
  },
}));

export function getNotesForCampaign(notes: Note[], campaignId: string | undefined): Note[] {
  if (!campaignId) return [];
  return notes.filter((n) => n.campaignId === campaignId);
}

export function getFoldersForCampaign(folders: NoteFolder[], campaignId: string | undefined): NoteFolder[] {
  if (!campaignId) return [];
  return folders.filter((f) => f.campaignId === campaignId);
}

export function getNoteById(notes: Note[], id: string | undefined): Note | undefined {
  return notes.find((n) => n.id === id);
}
