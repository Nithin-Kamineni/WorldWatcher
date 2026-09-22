import { create } from 'zustand';
import type { EntityRevision, RevisionRestoreResult, RevisionRetentionPolicy } from '../types/revision';
import {
  apiEntityRevisionToRevision,
  apiRestoreResultToResult,
  apiRetentionPolicyToPolicy,
} from '../api/adapters';
import * as revisionsApi from '../api/resources/entityRevisions';

/** The World Manager's edit history, per world.
 *
 * Unlike every other store here this one does NOT cache-and-skip. The others load a world's
 * content once because the content only changes through them, so the cache cannot go stale
 * behind their back. History is the opposite: it is written by the server as a side effect of
 * every other store's writes, so the copy held here is out of date the moment anything else
 * saves. `fetchRevisions` therefore always refetches, and the timeline refetches on mount.
 *
 * There is no optimistic update for the same reason - the summary and the field-level diff
 * are computed server-side from the row as it actually landed, and guessing them here would
 * be inventing history rather than reporting it. */
interface RevisionStoreState {
  revisionsByWorldId: Record<string, EntityRevision[]>;
  loadingWorldIds: Record<string, boolean>;
  /** Set once per session: the server's retention rule, so the UI can state it accurately. */
  policy: RevisionRetentionPolicy | null;
  /** The revision currently being restored, so its row can show progress without a flag of
   * its own and the rest of the list can stay interactive. */
  restoringId: string | null;

  fetchRevisions: (worldId: string) => Promise<void>;
  fetchPolicy: () => Promise<void>;
  restoreRevision: (worldId: string, revisionId: string) => Promise<RevisionRestoreResult | null>;
  clearHistory: (worldId: string) => Promise<void>;
}

export const useRevisionStore = create<RevisionStoreState>((set, get) => ({
  revisionsByWorldId: {},
  loadingWorldIds: {},
  policy: null,
  restoringId: null,

  fetchRevisions: async (worldId) => {
    set((state) => ({ loadingWorldIds: { ...state.loadingWorldIds, [worldId]: true } }));
    try {
      const rows = await revisionsApi.listEntityRevisions(worldId, { limit: 500 });
      set((state) => ({
        revisionsByWorldId: { ...state.revisionsByWorldId, [worldId]: rows.map(apiEntityRevisionToRevision) },
      }));
    } catch (err) {
      console.error(`Failed to load edit history for world ${worldId}`, err);
    } finally {
      set((state) => ({ loadingWorldIds: { ...state.loadingWorldIds, [worldId]: false } }));
    }
  },

  fetchPolicy: async () => {
    if (get().policy) return;
    try {
      set({ policy: apiRetentionPolicyToPolicy(await revisionsApi.getRetentionPolicy()) });
    } catch (err) {
      console.error('Failed to load the edit-history retention policy', err);
    }
  },

  restoreRevision: async (worldId, revisionId) => {
    set({ restoringId: revisionId });
    try {
      const result = apiRestoreResultToResult(await revisionsApi.restoreEntityRevision(revisionId));
      // Refetched rather than prepended: the restore wrote a row of its own, and the caller
      // needs it in the list to be able to undo the undo.
      await get().fetchRevisions(worldId);
      return result;
    } catch (err) {
      console.error(`Failed to restore revision ${revisionId}`, err);
      return null;
    } finally {
      set({ restoringId: null });
    }
  },

  clearHistory: async (worldId) => {
    try {
      await revisionsApi.clearEntityRevisions(worldId);
      set((state) => ({ revisionsByWorldId: { ...state.revisionsByWorldId, [worldId]: [] } }));
    } catch (err) {
      console.error(`Failed to clear edit history for world ${worldId}`, err);
    }
  },
}));

export function getRevisionsForWorld(
  revisionsByWorldId: Record<string, EntityRevision[]>,
  worldId: string | undefined,
): EntityRevision[] {
  if (!worldId) return [];
  return revisionsByWorldId[worldId] ?? [];
}
