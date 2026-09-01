import { create } from 'zustand';
import * as situationalTablesApi from '../api/resources/situationalTables';
import type { ApiSituationalTable } from '../api/types';
import type { SituationalTable } from '../types/situationalTable';

function apiToSituationalTable(t: ApiSituationalTable): SituationalTable {
  return {
    id: t.id,
    name: t.name,
    theme: t.theme,
    tags: t.tags,
    description: t.description,
    source: t.source,
    columns: t.columns,
  };
}

/** Curated, hand-authored roleplay/exploration random tables (Encounters -> "Roleplay &
 * Exploration" tab) - small, static, global reference data seeded once via
 * Database/Maintainance/scripts/seed_situational_tables.py. Fetched once per session and
 * cached, same "fetch-once" shape as useRandomizerBankStore - there is no write path, the
 * UI only ever reads these and rolls client-side. */
interface SituationalTableState {
  tables: SituationalTable[];
  loaded: boolean;
  loading: boolean;
  fetchTables: () => Promise<void>;
}

export const useSituationalTableStore = create<SituationalTableState>((set, get) => ({
  tables: [],
  loaded: false,
  loading: false,

  fetchTables: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const tables = await situationalTablesApi.listSituationalTables();
      set({ tables: tables.map(apiToSituationalTable), loaded: true, loading: false });
    } catch (err) {
      console.error('Failed to load situational tables', err);
      set({ loading: false });
    }
  },
}));
