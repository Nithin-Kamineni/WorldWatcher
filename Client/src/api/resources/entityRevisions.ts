import { apiDelete, apiGet, apiPost } from '../client';
import type { ApiEntityRevision, ApiRestoreResult, ApiRetentionPolicy } from '../types';

/** The World Manager's edit history (Server/app/api/routers/entity_revisions.py).
 *
 * Deliberately NOT paginated the way the entity endpoints are: this is a timeline that is
 * read from the top and then stopped reading, and the server's retention rule already bounds
 * how much of it can exist, so a limit is the whole of what a caller needs. */
export const listEntityRevisions = (worldId: string, params: { entityId?: string; limit?: number } = {}) =>
  apiGet<ApiEntityRevision[]>('/entity-revisions', {
    world_id: worldId,
    entity_id: params.entityId,
    limit: params.limit,
  });

/** Puts the entity back the way it was immediately before that change. The restore is itself
 * recorded, so the result's `revision` is the new history row - and undoing the undo is just
 * another restore. */
export const restoreEntityRevision = (revisionId: string) =>
  apiPost<ApiRestoreResult>(`/entity-revisions/${revisionId}/restore`);

export const getRetentionPolicy = () => apiGet<ApiRetentionPolicy>('/entity-revisions/policy');

export const clearEntityRevisions = (worldId: string) =>
  apiDelete(`/entity-revisions?world_id=${encodeURIComponent(worldId)}`);
