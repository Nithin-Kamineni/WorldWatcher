import type { NoteCanvas, NoteDocType } from './noteCanvas';

export type NoteKind = 'session_prep' | 'narrative';

/** The protected folders every campaign gets. 'dm_notes' is a CHILD of the 'session' folder
 * and holds the DM's chat threads (SessionChat) rather than Notes - see NotesFolderExplorer,
 * which renders chat rows when it is the open folder. */
export type NoteFolderDefaultKind = 'session' | 'narrative' | 'dm_notes';

export interface Note {
  id: string;
  campaignId: string;
  folderId: string | null;
  name: string;
  kind: NoteKind | null;
  /** Which editor this file opens in: 'text' (body), 'whiteboard' or 'tree' (canvas).
   * Every note written before the canvas types existed reads back as 'text'. */
  docType: NoteDocType;
  /** HTML - the document itself for a 'text' note, unused by the canvas types. */
  body: string;
  /** The whiteboard/tree document, normalized on the way in (see noteCanvas.ts). null for a
   * text note. */
  canvas: NoteCanvas | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface NoteFolder {
  id: string;
  campaignId: string;
  parentId: string | null;
  name: string;
  isDefault: boolean;
  defaultKind: NoteFolderDefaultKind | null;
  createdAt: number;
  updatedAt: number;
}
