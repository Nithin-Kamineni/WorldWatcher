export interface GeneratorParameter {
  key: string;
  label: string;
  type: string;
  allowedTags: string[];
  required: boolean;
  default: string | null;
}

export interface GeneratorComponent {
  id: string;
  generatorId: string;
  tableId: string;
  outputSlot: string;
  filterParamKey: string | null;
  rollCount: number;
  optional: boolean;
  sortOrder: number;
}

export interface Generator {
  id: string;
  campaignId: string | null;
  slug: string;
  name: string;
  categoryId: string | null;
  description: string | null;
  combineTemplate: string;
  parameters: GeneratorParameter[];
  isSystem: boolean;
  createdAt: number;
  updatedAt: number;
  tagIds: string[];
}

export interface GeneratorDetail extends Generator {
  components: GeneratorComponent[];
}

export interface GeneratorRollSlotResult {
  slot: string;
  tableId: string;
  tableName: string;
  result: import('./randomTable').RollResultItem | null;
  skipped: boolean;
}

export interface GeneratorRollResult {
  generatorId: string;
  slots: GeneratorRollSlotResult[];
  combinedText: string;
}
