import { create } from 'zustand';
import type { Category, CategoryNode } from '../types/category';
import { apiCategoryNodeToNode, apiCategoryToCategory, categoryToApiPayload } from '../api/adapters';
import * as categoriesApi from '../api/resources/categories';

/** Global reference tree (curated + any user-added nodes) - fetched once and cached for the
 * whole session, same "fetch-once" precedent as useSituationalTableStore/useTableFormatStore. */
interface CategoryState {
  tree: CategoryNode[];
  flat: Category[];
  loaded: boolean;
  loading: boolean;
  fetchTree: () => Promise<void>;
  addCategory: (payload: { slug: string; name: string; parentId: string | null; icon?: string | null }) => Promise<Category | null>;
  moveCategory: (id: string, parentId: string | null) => Promise<Category | null>;
  removeCategory: (id: string) => Promise<void>;
}

function flatten(nodes: CategoryNode[]): Category[] {
  const out: Category[] = [];
  const walk = (n: CategoryNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  tree: [],
  flat: [],
  loaded: false,
  loading: false,

  fetchTree: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const nodes = (await categoriesApi.getCategoryTree()).map(apiCategoryNodeToNode);
      set({ tree: nodes, flat: flatten(nodes), loaded: true, loading: false });
    } catch (err) {
      console.error('Failed to load category tree', err);
      set({ loading: false });
    }
  },

  addCategory: async (payload) => {
    try {
      const created = apiCategoryToCategory(await categoriesApi.createCategory(categoryToApiPayload(payload)));
      set({ loaded: false });
      await get().fetchTree();
      return created;
    } catch (err) {
      console.error('Failed to create category', err);
      return null;
    }
  },

  moveCategory: async (id, parentId) => {
    try {
      const updated = apiCategoryToCategory(await categoriesApi.updateCategory(id, { parent_id: parentId }));
      set({ loaded: false });
      await get().fetchTree();
      return updated;
    } catch (err) {
      console.error('Failed to move category', err);
      return null;
    }
  },

  removeCategory: async (id) => {
    try {
      await categoriesApi.deleteCategory(id);
      set({ loaded: false });
      await get().fetchTree();
    } catch (err) {
      console.error('Failed to delete category', err);
    }
  },
}));

export function findCategory(flat: Category[], id: string | null | undefined): Category | undefined {
  if (!id) return undefined;
  return flat.find((c) => c.id === id);
}

/** Full "Parent > Child" breadcrumb label for a category id. */
export function categoryPath(flat: Category[], id: string | null | undefined): string {
  const byId = new Map(flat.map((c) => [c.id, c]));
  const parts: string[] = [];
  let current = id ? byId.get(id) : undefined;
  while (current) {
    parts.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return parts.join(' > ');
}
