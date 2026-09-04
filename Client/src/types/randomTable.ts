export type TableEntryKind = 'text' | 'encounter_ref' | 'table_ref' | 'creature_ref' | 'npc_ref' | 'item_ref';

export interface TableEntry {
  id: string;
  columnId: string;
  min: number | null;
  max: number | null;
  secondaryMin: number | null;
  secondaryMax: number | null;
  weight: number | null;
  kind: TableEntryKind;
  text: string | null;
  encounterId: string | null;
  targetTableId: string | null;
  creatureId: string | null;
  npcId: string | null;
  itemId: string | null;
  bundle: unknown;
  notes: string | null;
  sortOrder: number;
  tagIds: string[];
  refHydrated: { id: string; name: string; [key: string]: unknown } | null;
}

export interface TableColumn {
  id: string;
  tableId: string;
  name: string;
  dieCount: number;
  dieSides: number;
  dieModifier: number;
  sortOrder: number;
  entries: TableEntry[];
}

export interface RandomTable {
  id: string;
  campaignId: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  formatId: string;
  triggerSituation: string | null;
  imageUrl: string | null;
  combineTemplate: string | null;
  sourceBook: string | null;
  formatConfig: Record<string, unknown> | null;
  isSystem: boolean;
  createdAt: number;
  updatedAt: number;
  tagIds: string[];
}

export interface RandomTableDetail extends RandomTable {
  columns: TableColumn[];
}

export interface RolledDie {
  sides: number;
  result: number;
}

export interface RollResultItem {
  columnName: string | null;
  dice: RolledDie[];
  total: number;
  entryId: string | null;
  tagIds: string[];
  kind: string;
  text: string | null;
  resolvedText: string | null;
  refId: string | null;
  refHydrated: { id: string; name: string; [key: string]: unknown } | null;
  extra: Record<string, unknown>;
  nested: RollResult | null;
}

export interface RollResult {
  tableId: string;
  tableName: string;
  formatSlug: string;
  items: RollResultItem[];
  combinedText: string | null;
  gatePassed: boolean | null;
}
