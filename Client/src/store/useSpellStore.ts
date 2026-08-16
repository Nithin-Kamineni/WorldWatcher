import { create } from 'zustand';
import type { Spell } from '../types/spell';
import { apiSpellToSpell, spellToApiPayload } from '../api/adapters';
import * as spellsApi from '../api/resources/spells';
import type { CreatureScope } from './useCreatureStore';

export interface SpellBrowseParams {
  campaignId: string;
  scope: CreatureScope;
  /** 1-indexed page number */
  page: number;
  pageSize: number;
  search?: string;
  school?: string[];
  level?: number[];
  classes?: string[];
}

interface SpellBrowseResult {
  items: Spell[];
  total: number;
}

interface SpellStoreState {
  spellsByCampaignId: Record<string, Spell[]>;
  loadedByCampaignId: Record<string, boolean>;
  fetchSpellsForCampaign: (campaignId: string) => Promise<void>;
  addSpellToCampaign: (campaignId: string, spell: Spell) => void;
  updateSpellInCampaign: (campaignId: string, spell: Spell) => void;
  deleteSpellFromCampaign: (campaignId: string, spellId: string) => void;

  spellBrowse: SpellBrowseResult | null;
  spellBrowseLoading: boolean;
  fetchSpellBrowse: (params: SpellBrowseParams) => Promise<void>;
}

let browseRequestId = 0;

export const useSpellStore = create<SpellStoreState>((set, get) => ({
  spellsByCampaignId: {},
  loadedByCampaignId: {},

  fetchSpellsForCampaign: async (campaignId) => {
    if (get().loadedByCampaignId[campaignId]) return;
    try {
      const page = await spellsApi.listSpells({ campaign_id: campaignId, limit: 200 });
      set((state) => ({
        spellsByCampaignId: { ...state.spellsByCampaignId, [campaignId]: page.items.map(apiSpellToSpell) },
        loadedByCampaignId: { ...state.loadedByCampaignId, [campaignId]: true },
      }));
    } catch (err) {
      console.error(`Failed to load spells for campaign ${campaignId}`, err);
    }
  },

  addSpellToCampaign: (campaignId, spell) => {
    set((state) => ({
      spellsByCampaignId: {
        ...state.spellsByCampaignId,
        [campaignId]: [...(state.spellsByCampaignId[campaignId] ?? []), spell],
      },
      spellBrowse: state.spellBrowse
        ? { items: [spell, ...state.spellBrowse.items], total: state.spellBrowse.total + 1 }
        : state.spellBrowse,
    }));
    spellToApiPayload(spell, campaignId)
      .then((payload) => spellsApi.createSpell({ id: spell.id, ...payload }))
      .catch((err) => console.error('Failed to persist new spell', err));
  },

  updateSpellInCampaign: (campaignId, spell) => {
    set((state) => ({
      spellsByCampaignId: {
        ...state.spellsByCampaignId,
        [campaignId]: (state.spellsByCampaignId[campaignId] ?? []).map((existing) =>
          existing.id === spell.id ? spell : existing,
        ),
      },
      spellBrowse: state.spellBrowse
        ? { ...state.spellBrowse, items: state.spellBrowse.items.map((s) => (s.id === spell.id ? spell : s)) }
        : state.spellBrowse,
    }));
    spellToApiPayload(spell, campaignId)
      .then((payload) => spellsApi.updateSpell(spell.id, payload))
      .catch((err) => console.error('Failed to persist spell update', err));
  },

  deleteSpellFromCampaign: (campaignId, spellId) => {
    set((state) => ({
      spellsByCampaignId: {
        ...state.spellsByCampaignId,
        [campaignId]: (state.spellsByCampaignId[campaignId] ?? []).filter((existing) => existing.id !== spellId),
      },
      spellBrowse: state.spellBrowse
        ? {
            items: state.spellBrowse.items.filter((s) => s.id !== spellId),
            total: state.spellBrowse.items.some((s) => s.id === spellId) ? state.spellBrowse.total - 1 : state.spellBrowse.total,
          }
        : state.spellBrowse,
    }));
    spellsApi.deleteSpell(spellId).catch((err) => console.error('Failed to delete spell', err));
  },

  spellBrowse: null,
  spellBrowseLoading: false,

  fetchSpellBrowse: async (params) => {
    const requestId = ++browseRequestId;
    set({ spellBrowseLoading: true });
    try {
      const page = await spellsApi.listSpells({
        campaign_id: params.campaignId,
        scope: params.scope,
        q: params.search || undefined,
        school: params.school?.length ? params.school.join(',') : undefined,
        level: params.level?.length ? params.level.join(',') : undefined,
        class: params.classes?.length ? params.classes.join(',') : undefined,
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
      });
      if (requestId !== browseRequestId) return;
      set({
        spellBrowse: { items: page.items.map(apiSpellToSpell), total: page.meta.total },
        spellBrowseLoading: false,
      });
    } catch (err) {
      if (requestId !== browseRequestId) return;
      console.error('Failed to load spells page', err);
      set({ spellBrowseLoading: false });
    }
  },
}));

export function getSpellsForCampaign(spellsByCampaignId: Record<string, Spell[]>, campaignId: string | undefined): Spell[] {
  if (!campaignId) return [];
  return spellsByCampaignId[campaignId] ?? [];
}
