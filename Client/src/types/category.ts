export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  isSystem: boolean;
  icon: string | null;
  sortOrder: number;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}
