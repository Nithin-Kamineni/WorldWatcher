/** Domain shapes for the World Manager's edit history.
 *
 * The server writes one row per change to world content (Server/app/models/entity_revision.py)
 * and hands back a display-level diff; the full "before" snapshot stays server-side, because
 * it is a whole entity per row and Restore runs there. So there is nothing here for it. */

/** What happened. `restore` is what a restore itself records - it is an ordinary change with
 * its own earlier version behind it, which is what makes an undo undoable in turn. */
export type RevisionAction = 'create' | 'update' | 'delete' | 'restore';

/** Which kind of world content moved. NPCs and homebrew monsters are both creatures on the
 * server; they are separated here because the World Manager lists them as different things. */
export type RevisionEntityType = 'article' | 'npc' | 'creature' | 'faction';

/** Which layout a change row gets: `long` for prose (a character delta rather than a
 * before/after pair), `list` for arrays (counts), `text`/`value` for everything else. */
export type RevisionChangeKind = 'text' | 'long' | 'list' | 'value';

export interface RevisionChange {
  field: string;
  label: string;
  kind: RevisionChangeKind;
  /** Previews, not full values - long text is truncated and HTML is stripped server-side. */
  before: string;
  after: string;
  /** Characters gained or lost. Present on `long` only. */
  delta?: number;
  /** Present on `list` only. */
  beforeCount?: number;
  afterCount?: number;
}

export interface EntityRevision {
  id: string;
  worldId: string;
  entityType: RevisionEntityType;
  entityId: string;
  /** The name as it stood at the time, so a rename does not rewrite its own history. */
  entityName: string;
  action: RevisionAction;
  /** The one-line "how it was edited" shown under the title. */
  summary: string;
  changes: RevisionChange[];
  createdAt: number;
  /** False only when nothing came before this change - i.e. it is the row that created the
   * entry. The Restore button is absent on those rather than disabled-and-lying. */
  canRestore: boolean;
}

export interface RevisionRestoreResult {
  entityType: string;
  entityId: string;
  entityName: string;
  /** True when the entity had been deleted and was brought back at its original id. */
  recreated: boolean;
  /** The change the restore itself recorded, or null when the restore was a no-op because
   * the entity already matched the target version. */
  revision: EntityRevision | null;
}

/** Read from the server rather than hardcoded, so the UI cannot state a retention rule the
 * server has stopped honouring. */
export interface RevisionRetentionPolicy {
  windowHours: number;
  minRows: number;
}
