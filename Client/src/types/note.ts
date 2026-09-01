export type NoteKind = 'session_prep' | 'narrative';

export type NoteFolderDefaultKind = 'session' | 'narrative';

export interface Note {
  id: string;
  campaignId: string;
  folderId: string | null;
  name: string;
  kind: NoteKind | null;
  body: string;
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
