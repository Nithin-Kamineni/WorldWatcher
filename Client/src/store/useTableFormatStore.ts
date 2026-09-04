import { create } from 'zustand';
import type { TableFormat } from '../types/tableFormat';
import { apiTableFormatToTableFormat } from '../api/adapters';
import * as tableFormatsApi from '../api/resources/tableFormats';

interface TableFormatState {
  formats: TableFormat[];
  loaded: boolean;
  loading: boolean;
  fetchFormats: () => Promise<void>;
  createFormat: (payload: { name: string; slug: string; description?: string; tier?: 'core' | 'advanced' }) => Promise<TableFormat | null>;
  deleteFormat: (id: string) => Promise<void>;
}

export const useTableFormatStore = create<TableFormatState>((set, get) => ({
  formats: [],
  loaded: false,
  loading: false,

  fetchFormats: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const formats = (await tableFormatsApi.listTableFormats()).map(apiTableFormatToTableFormat);
      set({ formats, loaded: true, loading: false });
    } catch (err) {
      console.error('Failed to load table formats', err);
      set({ loading: false });
    }
  },
  createFormat: async (payload) => {
    try {
      const created = apiTableFormatToTableFormat(await tableFormatsApi.createTableFormat(payload));
      set((state) => ({ formats: [...state.formats, created] }));
      return created;
    } catch (err) {
      console.error('Failed to create table format', err);
      return null;
    }
  },
  deleteFormat: async (id) => {
    await tableFormatsApi.deleteTableFormat(id);
    set((state) => ({ formats: state.formats.filter((format) => format.id !== id) }));
  },
}));

export function findFormat(formats: TableFormat[], id: string | null | undefined): TableFormat | undefined {
  if (!id) return undefined;
  return formats.find((f) => f.id === id);
}

export function findFormatBySlug(formats: TableFormat[], slug: string): TableFormat | undefined {
  return formats.find((f) => f.slug === slug);
}
