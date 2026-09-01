import { create } from 'zustand';
import * as randomBankApi from '../api/resources/randomBank';
import type { ArticleRandomBankKey } from '../types/article';

/** Places-tab randomizer reference banks (Countries/Settlements/Buildings/Dungeons) - same
 * fetch-once-per-session cache pattern as useRandomizerBankStore.ts's NPC banks, kept
 * separate since these back a different set of forms (ArticleForm, not NpcFormDialog). */
interface ArticleRandomBankState {
  dungeonStatesOfRuin: string[];
  dungeonQuirks: string[];
  shopTypes: string[];
  tavernFirstParts: string[];
  tavernSecondParts: string[];
  settlementDefiningTraits: string[];
  settlementClaimsToFame: string[];
  settlementCalamities: string[];
  settlementLocalLeaders: string[];
  settlementEconomicSources: string[];
  settlementRumorsHooks: string[];
  loaded: boolean;
  loading: boolean;
  fetchBanks: () => Promise<void>;
}

function pickRandom(arr: string[]): string {
  if (arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

export const useArticleRandomBankStore = create<ArticleRandomBankState>((set, get) => ({
  dungeonStatesOfRuin: [],
  dungeonQuirks: [],
  shopTypes: [],
  tavernFirstParts: [],
  tavernSecondParts: [],
  settlementDefiningTraits: [],
  settlementClaimsToFame: [],
  settlementCalamities: [],
  settlementLocalLeaders: [],
  settlementEconomicSources: [],
  settlementRumorsHooks: [],
  loaded: false,
  loading: false,

  fetchBanks: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const [
        statesOfRuin,
        quirks,
        shopTypes,
        tavernParts,
        definingTraits,
        claimsToFame,
        calamities,
        localLeaders,
        economicSources,
        rumorsHooks,
      ] = await Promise.all([
        randomBankApi.listRandomDungeonStatesOfRuin(),
        randomBankApi.listRandomDungeonQuirks(),
        randomBankApi.listRandomShopTypes(),
        randomBankApi.listRandomTavernNameParts(),
        randomBankApi.listRandomSettlementDefiningTraits(),
        randomBankApi.listRandomSettlementClaimsToFame(),
        randomBankApi.listRandomSettlementCalamities(),
        randomBankApi.listRandomSettlementLocalLeaders(),
        randomBankApi.listRandomSettlementEconomicSources(),
        randomBankApi.listRandomSettlementRumorsHooks(),
      ]);
      set({
        dungeonStatesOfRuin: statesOfRuin.map((r) => r.text),
        dungeonQuirks: quirks.map((r) => r.text),
        shopTypes: shopTypes.map((r) => r.text),
        tavernFirstParts: tavernParts.filter((p) => p.part_type === 'first').map((p) => p.text),
        tavernSecondParts: tavernParts.filter((p) => p.part_type === 'second').map((p) => p.text),
        settlementDefiningTraits: definingTraits.map((r) => r.text),
        settlementClaimsToFame: claimsToFame.map((r) => r.text),
        settlementCalamities: calamities.map((r) => r.text),
        settlementLocalLeaders: localLeaders.map((r) => r.text),
        settlementEconomicSources: economicSources.map((r) => r.text),
        settlementRumorsHooks: rumorsHooks.map((r) => r.text),
        loaded: true,
        loading: false,
      });
    } catch (err) {
      console.error('Failed to load Places randomizer banks', err);
      set({ loading: false });
    }
  },
}));

const BANK_KEY_TO_STATE_KEY: Record<ArticleRandomBankKey, keyof ArticleRandomBankState> = {
  dungeonStatesOfRuin: 'dungeonStatesOfRuin',
  dungeonQuirks: 'dungeonQuirks',
  shopTypes: 'shopTypes',
  settlementDefiningTraits: 'settlementDefiningTraits',
  settlementClaimsToFame: 'settlementClaimsToFame',
  settlementCalamities: 'settlementCalamities',
  settlementLocalLeaders: 'settlementLocalLeaders',
  settlementEconomicSources: 'settlementEconomicSources',
  settlementRumorsHooks: 'settlementRumorsHooks',
};

/** ItemListField's onPickRandom callback for any 'itemlist' ArticleFieldDef - reads the
 * bank straight off the store's current state (called from a React event handler, not
 * render, so a plain getState() read is safe/cheap). */
export function pickRandomFromBank(bankKey: ArticleRandomBankKey): string {
  const state = useArticleRandomBankStore.getState();
  const stateKey = BANK_KEY_TO_STATE_KEY[bankKey];
  return pickRandom(state[stateKey] as string[]);
}

/** Combines one random first-part + second-part pick for the Tavern name generator button. */
export function randomTavernName(): string {
  const state = useArticleRandomBankStore.getState();
  const first = pickRandom(state.tavernFirstParts);
  const second = pickRandom(state.tavernSecondParts);
  return [first, second].filter(Boolean).join(' ');
}
