import { create } from 'zustand';
import type { RandomEncounterTable } from '../types/randomEncounterTable';
import { apiRandomEncounterTableToRandomEncounterTable, randomEncounterTableToApiPayload } from '../api/adapters';
import * as randomEncounterTablesApi from '../api/resources/randomEncounterTables';

const LEGACY_LOCALSTORAGE_KEY = 'worldwatcher-random-encounter-tables';

/** This store used to be zustand/persist->localStorage only (no backend). Promoting it to a
 * real DB-backed resource would silently drop any tables a DM already built in the browser,
 * so on first load for a campaign, migrate whatever's still sitting in the old localStorage
 * blob up to the API once, then strip those entries out of it. */
async function migrateLegacyLocalStorageTables(campaignId: string): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { state?: { tables?: RandomEncounterTable[] } };
    const allTables = parsed.state?.tables ?? [];
    const toMigrate = allTables.filter((t) => t.campaignId === campaignId);
    if (toMigrate.length === 0) return;

    for (const table of toMigrate) {
      await randomEncounterTablesApi.createRandomEncounterTable(randomEncounterTableToApiPayload(table, campaignId));
    }

    const remaining = allTables.filter((t) => t.campaignId !== campaignId);
    if (remaining.length === 0) {
      localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    } else {
      localStorage.setItem(LEGACY_LOCALSTORAGE_KEY, JSON.stringify({ ...parsed, state: { ...parsed.state, tables: remaining } }));
    }
  } catch (err) {
    console.error('Failed to migrate legacy localStorage random encounter tables', err);
  }
}

interface RandomEncounterTableState {
  tablesByCampaignId: Record<string, RandomEncounterTable[]>;
  loadedByCampaignId: Record<string, boolean>;
  fetchTablesForCampaign: (campaignId: string) => Promise<void>;
  addTable: (campaignId: string, table: RandomEncounterTable) => void;
  updateTable: (campaignId: string, table: RandomEncounterTable) => void;
  deleteTable: (campaignId: string, tableId: string) => void;
}

export const useRandomEncounterTableStore = create<RandomEncounterTableState>((set, get) => ({
  tablesByCampaignId: {},
  loadedByCampaignId: {},

  fetchTablesForCampaign: async (campaignId) => {
    if (get().loadedByCampaignId[campaignId]) return;
    try {
      await migrateLegacyLocalStorageTables(campaignId);
      const page = await randomEncounterTablesApi.listRandomEncounterTables({ campaign_id: campaignId, limit: 200 });
      set((state) => ({
        tablesByCampaignId: {
          ...state.tablesByCampaignId,
          [campaignId]: page.items.map(apiRandomEncounterTableToRandomEncounterTable),
        },
        loadedByCampaignId: { ...state.loadedByCampaignId, [campaignId]: true },
      }));
    } catch (err) {
      console.error(`Failed to load random encounter tables for campaign ${campaignId}`, err);
    }
  },

  addTable: (campaignId, table) => {
    set((state) => ({
      tablesByCampaignId: {
        ...state.tablesByCampaignId,
        [campaignId]: [...(state.tablesByCampaignId[campaignId] ?? []), table],
      },
    }));
    randomEncounterTablesApi
      .createRandomEncounterTable(randomEncounterTableToApiPayload(table, campaignId))
      .catch((err) => console.error('Failed to persist new random encounter table', err));
  },

  updateTable: (campaignId, table) => {
    set((state) => ({
      tablesByCampaignId: {
        ...state.tablesByCampaignId,
        [campaignId]: (state.tablesByCampaignId[campaignId] ?? []).map((existing) =>
          existing.id === table.id ? table : existing,
        ),
      },
    }));
    randomEncounterTablesApi
      .updateRandomEncounterTable(table.id, randomEncounterTableToApiPayload(table, campaignId))
      .catch((err) => console.error('Failed to persist random encounter table update', err));
  },

  deleteTable: (campaignId, tableId) => {
    set((state) => ({
      tablesByCampaignId: {
        ...state.tablesByCampaignId,
        [campaignId]: (state.tablesByCampaignId[campaignId] ?? []).filter((existing) => existing.id !== tableId),
      },
    }));
    randomEncounterTablesApi
      .deleteRandomEncounterTable(tableId)
      .catch((err) => console.error('Failed to delete random encounter table', err));
  },
}));

export function getRandomEncounterTablesForCampaign(
  tablesByCampaignId: Record<string, RandomEncounterTable[]>,
  campaignId: string | undefined,
): RandomEncounterTable[] {
  if (!campaignId) return [];
  return tablesByCampaignId[campaignId] ?? [];
}
