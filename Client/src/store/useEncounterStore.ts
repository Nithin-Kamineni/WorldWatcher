import { create } from 'zustand';
import type { Encounter, EncounterCreatureEntry } from '../types/encounter';
import { apiEncounterToEncounter, encounterEntryToApiPayload, encounterToApiPayload } from '../api/adapters';
import { assetFileUrl } from '../api/client';
import * as creaturesApi from '../api/resources/creatures';
import * as encountersApi from '../api/resources/encounters';

/** 'own_or_global' (default) = this campaign's own encounters plus the shared/global reference
 * library (campaign_id IS NULL - imported random-table encounters live here). 'all' = every
 * campaign's encounters plus the global library, no campaign filtering at all - the "All
 * campaigns" toggle in EncountersSection. */
export type EncounterScope = 'own_or_global' | 'all';

interface EncounterStoreState {
  encountersByCampaignId: Record<string, Encounter[]>;
  /** keyed `${campaignId}:${scope}` so switching the "All campaigns" toggle always triggers a
   * fresh fetch instead of reusing a narrower scope's cached (and now stale) result. */
  loadedKeys: Record<string, boolean>;
  fetchEncountersForCampaign: (campaignId: string, scope?: EncounterScope) => Promise<void>;
  addEncounterToCampaign: (campaignId: string, encounter: Encounter) => void;
  updateEncounterInCampaign: (campaignId: string, encounter: Encounter) => void;
  deleteEncounterFromCampaign: (campaignId: string, encounterId: string) => void;
}

async function buildCreatureLookup(campaignId: string): Promise<Map<string, { name: string; tokenImage: string }>> {
  const page = await creaturesApi.listCreatures({ campaign_id: campaignId, limit: 200 });
  return new Map(
    page.items.map((c) => [
      c.id,
      { name: c.name, tokenImage: assetFileUrl(c.token_asset_id ?? c.portrait_asset_id) },
    ]),
  );
}

async function syncEncounterEntries(
  encounterId: string,
  oldEntries: EncounterCreatureEntry[],
  newEntries: EncounterCreatureEntry[],
): Promise<void> {
  const oldById = new Map(oldEntries.map((e) => [e.id, e]));
  const newById = new Map(newEntries.map((e) => [e.id, e]));

  for (const entry of newEntries) {
    const old = oldById.get(entry.id);
    if (!old) {
      await encountersApi.addEncounterCreature(encounterId, { id: entry.id, ...encounterEntryToApiPayload(entry) });
    } else if (old.quantity !== entry.quantity || old.creatureId !== entry.creatureId || old.name !== entry.name) {
      await encountersApi.updateEncounterCreature(entry.id, encounterEntryToApiPayload(entry));
    }
  }

  for (const entry of oldEntries) {
    if (!newById.has(entry.id)) {
      await encountersApi.removeEncounterCreature(entry.id);
    }
  }
}

export const useEncounterStore = create<EncounterStoreState>((set, get) => ({
  encountersByCampaignId: {},
  loadedKeys: {},

  fetchEncountersForCampaign: async (campaignId, scope = 'own_or_global') => {
    const key = `${campaignId}:${scope}`;
    if (get().loadedKeys[key]) return;
    try {
      const [page, lookup] = await Promise.all([
        // 'own_or_global' (default) so imported random-table reference encounters
        // (campaign_id IS NULL, source_id set - see the importer's projectors/encounter.py)
        // show up here too, alongside this campaign's own hand-authored encounters. 'all' (the
        // "All campaigns" toggle) drops the campaign filter entirely.
        encountersApi.listEncounters({ campaign_id: campaignId, scope, limit: 200 }),
        buildCreatureLookup(campaignId),
      ]);
      const encounters = await Promise.all(
        page.items.map(async (e) => apiEncounterToEncounter(await encountersApi.getEncounter(e.id), lookup)),
      );
      set((state) => ({
        encountersByCampaignId: { ...state.encountersByCampaignId, [campaignId]: encounters },
        loadedKeys: { ...state.loadedKeys, [key]: true },
      }));
    } catch (err) {
      console.error(`Failed to load encounters for campaign ${campaignId}`, err);
    }
  },

  addEncounterToCampaign: (campaignId, encounter) => {
    set((state) => ({
      encountersByCampaignId: {
        ...state.encountersByCampaignId,
        [campaignId]: [...(state.encountersByCampaignId[campaignId] ?? []), encounter],
      },
    }));
    (async () => {
      await encountersApi.createEncounter({ id: encounter.id, ...encounterToApiPayload(encounter, campaignId) });
      await syncEncounterEntries(encounter.id, [], encounter.creatures);
    })().catch((err) => console.error('Failed to persist new encounter', err));
  },

  updateEncounterInCampaign: (campaignId, encounter) => {
    const oldEncounter = get().encountersByCampaignId[campaignId]?.find((e) => e.id === encounter.id);
    set((state) => ({
      encountersByCampaignId: {
        ...state.encountersByCampaignId,
        [campaignId]: (state.encountersByCampaignId[campaignId] ?? []).map((existing) =>
          existing.id === encounter.id ? encounter : existing,
        ),
      },
    }));
    (async () => {
      await encountersApi.updateEncounter(encounter.id, encounterToApiPayload(encounter, campaignId));
      await syncEncounterEntries(encounter.id, oldEncounter?.creatures ?? [], encounter.creatures);
    })().catch((err) => console.error('Failed to persist encounter update', err));
  },

  deleteEncounterFromCampaign: (campaignId, encounterId) => {
    set((state) => ({
      encountersByCampaignId: {
        ...state.encountersByCampaignId,
        [campaignId]: (state.encountersByCampaignId[campaignId] ?? []).filter(
          (existing) => existing.id !== encounterId,
        ),
      },
    }));
    encountersApi.deleteEncounter(encounterId).catch((err) => console.error('Failed to delete encounter', err));
  },
}));

export function getEncountersForCampaign(
  encountersByCampaignId: Record<string, Encounter[]>,
  campaignId: string | undefined,
): Encounter[] {
  if (!campaignId) return [];
  return encountersByCampaignId[campaignId] ?? [];
}
