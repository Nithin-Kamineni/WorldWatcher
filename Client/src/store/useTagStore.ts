import { create } from 'zustand';
import type { Tag } from '../types/tag';
import { apiTagToTag } from '../api/adapters';
import * as tagsApi from '../api/resources/tags';

interface TagState {
  tags: Tag[];
  namespaces: string[];
  loaded: boolean;
  loading: boolean;
  fetchTags: () => Promise<void>;
  createTag: (namespace: string, value: string, label: string) => Promise<Tag | null>;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  namespaces: [],
  loaded: false,
  loading: false,

  fetchTags: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const [tags, namespaces] = await Promise.all([tagsApi.listTags(), tagsApi.listTagNamespaces()]);
      set({ tags: tags.map(apiTagToTag), namespaces, loaded: true, loading: false });
    } catch (err) {
      console.error('Failed to load tags', err);
      set({ loading: false });
    }
  },

  createTag: async (namespace, value, label) => {
    try {
      const created = apiTagToTag(await tagsApi.createTag({ namespace, value, label }));
      set((state) => ({
        tags: [...state.tags, created],
        namespaces: state.namespaces.includes(namespace) ? state.namespaces : [...state.namespaces, namespace].sort(),
      }));
      return created;
    } catch (err) {
      console.error('Failed to create tag', err);
      return null;
    }
  },
}));

export function tagsByIds(tags: Tag[], ids: string[]): Tag[] {
  const idSet = new Set(ids);
  return tags.filter((t) => idSet.has(t.id));
}

export function groupTagsByNamespace(tags: Tag[]): Map<string, Tag[]> {
  const map = new Map<string, Tag[]>();
  for (const tag of tags) {
    const list = map.get(tag.namespace) ?? [];
    list.push(tag);
    map.set(tag.namespace, list);
  }
  return map;
}
