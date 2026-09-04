import { create } from 'zustand';
import type { Encounter, EncounterCreatureEntry, EncounterNpcEntry } from '../types/encounter';
import {
  apiEncounterToEncounter,
  combatBlockToApiPayload,
  encounterEntryToApiPayload,
  encounterNpcToApiPayload,
  encounterToApiPayload,
  explorationBlockToApiPayload,
  socialBlockToApiPayload,
} from '../api/adapters';
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
  fetchEncounterById: (campaignId: string, encounterId: string) => Promise<Encounter | null>;
  addEncounterToCampaign: (campaignId: string, encounter: Encounter) => void;
  updateEncounterInCampaign: (campaignId: string, encounter: Encounter) => void;
  deleteEncounterFromCampaign: (campaignId: string, encounterId: string) => void;
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
    } else if (
      old.quantity !== entry.quantity || old.creatureId !== entry.creatureId || old.name !== entry.name ||
      old.role !== entry.role || old.notes !== entry.notes
    ) {
      await encountersApi.updateEncounterCreature(entry.id, encounterEntryToApiPayload(entry));
    }
  }

  for (const entry of oldEntries) {
    if (!newById.has(entry.id)) {
      await encountersApi.removeEncounterCreature(entry.id);
    }
  }
}

async function syncEncounterNpcs(
  encounterId: string,
  oldNpcs: EncounterNpcEntry[],
  newNpcs: EncounterNpcEntry[],
): Promise<void> {
  const oldById = new Map(oldNpcs.map((n) => [n.id, n]));
  const newById = new Map(newNpcs.map((n) => [n.id, n]));

  for (const npc of newNpcs) {
    const old = oldById.get(npc.id);
    if (!old) {
      await encountersApi.addEncounterNpc(encounterId, { id: npc.id, ...encounterNpcToApiPayload(npc) });
    } else if (JSON.stringify(old) !== JSON.stringify(npc)) {
      await encountersApi.updateEncounterNpc(npc.id, encounterNpcToApiPayload(npc));
    }
  }

  for (const npc of oldNpcs) {
    if (!newById.has(npc.id)) {
      await encountersApi.removeEncounterNpc(npc.id);
    }
  }
}

async function syncEncounterBlocks(encounterId: string, oldEncounter: Encounter | undefined, encounter: Encounter): Promise<void> {
  if (encounter.combatBlock) {
    if (JSON.stringify(oldEncounter?.combatBlock) !== JSON.stringify(encounter.combatBlock)) {
      await encountersApi.upsertCombatBlock(encounterId, combatBlockToApiPayload(encounter.combatBlock));
    }
  } else if (oldEncounter?.combatBlock) {
    await encountersApi.deleteCombatBlock(encounterId);
  }

  if (encounter.socialBlock) {
    if (JSON.stringify(oldEncounter?.socialBlock) !== JSON.stringify(encounter.socialBlock)) {
      await encountersApi.upsertSocialBlock(encounterId, socialBlockToApiPayload(encounter.socialBlock));
    }
  } else if (oldEncounter?.socialBlock) {
    await encountersApi.deleteSocialBlock(encounterId);
  }

  if (encounter.explorationBlock) {
    if (JSON.stringify(oldEncounter?.explorationBlock) !== JSON.stringify(encounter.explorationBlock)) {
      await encountersApi.upsertExplorationBlock(encounterId, explorationBlockToApiPayload(encounter.explorationBlock));
    }
  } else if (oldEncounter?.explorationBlock) {
    await encountersApi.deleteExplorationBlock(encounterId);
  }

  if (JSON.stringify(oldEncounter?.tagIds ?? []) !== JSON.stringify(encounter.tagIds)) {
    await encountersApi.replaceEncounterTags(encounterId, encounter.tagIds);
  }
}

export const useEncounterStore = create<EncounterStoreState>((set, get) => ({
  encountersByCampaignId: {},
  loadedKeys: {},

  fetchEncountersForCampaign: async (campaignId, scope = 'own_or_global') => {
    const key = `${campaignId}:${scope}`;
    if (get().loadedKeys[key]) return;
    try {
      // 'own_or_global' (default) so imported random-table reference encounters
      // (campaign_id IS NULL, source_id set - see the importer's projectors/encounter.py)
      // show up here too, alongside this campaign's own hand-authored encounters. 'all' (the
      // "All campaigns" toggle) drops the campaign filter entirely.
      const page = await encountersApi.listEncounters({ campaign_id: campaignId, scope, limit: 200 });
      const encounters = await Promise.all(
        page.items.map(async (e) => apiEncounterToEncounter(await encountersApi.getEncounter(e.id))),
      );
      set((state) => ({
        encountersByCampaignId: { ...state.encountersByCampaignId, [campaignId]: encounters },
        loadedKeys: { ...state.loadedKeys, [key]: true },
      }));
    } catch (err) {
      console.error(`Failed to load encounters for campaign ${campaignId}`, err);
    }
  },

  fetchEncounterById: async (campaignId, encounterId) => {
    const cached = get().encountersByCampaignId[campaignId]?.find((encounter) => encounter.id === encounterId);
    if (cached) return cached;
    try {
      const detail = await encountersApi.getEncounter(encounterId);
      const encounter = apiEncounterToEncounter(detail);
      set((state) => ({
        encountersByCampaignId: {
          ...state.encountersByCampaignId,
          [campaignId]: [...(state.encountersByCampaignId[campaignId] ?? []), encounter],
        },
      }));
      return encounter;
    } catch (err) {
      console.error(`Failed to load encounter ${encounterId}`, err);
      return null;
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
      await syncEncounterNpcs(encounter.id, [], encounter.npcs);
      await syncEncounterBlocks(encounter.id, undefined, encounter);
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
      await syncEncounterNpcs(encounter.id, oldEncounter?.npcs ?? [], encounter.npcs);
      await syncEncounterBlocks(encounter.id, oldEncounter, encounter);
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
