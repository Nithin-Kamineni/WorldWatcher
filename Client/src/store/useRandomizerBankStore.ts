import { create } from 'zustand';
import * as randomBankApi from '../api/resources/randomBank';

/** NPC-creation randomizer reference banks (Bugs.txt) - small, static, global reference
 * data. Fetched once per session and cached; callers pick randomly client-side for
 * zero-latency per-field re-rolls rather than round-tripping to the API on every dice
 * click. */
interface RandomizerBankState {
  firstNames: string[];
  lastNames: string[];
  professions: string[];
  motivations: string[];
  pitfalls: string[];
  appearances: string[];
  secrets: string[];
  personalities: string[];
  relationships: string[];
  loaded: boolean;
  loading: boolean;
  fetchBanks: () => Promise<void>;
}

function pickRandom(arr: string[]): string {
  if (arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

export const useRandomizerBankStore = create<RandomizerBankState>((set, get) => ({
  firstNames: [],
  lastNames: [],
  professions: [],
  motivations: [],
  pitfalls: [],
  appearances: [],
  secrets: [],
  personalities: [],
  relationships: [],
  loaded: false,
  loading: false,

  fetchBanks: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const [names, professions, motivations, pitfalls, appearances, secrets, personalities, relationships] =
        await Promise.all([
          randomBankApi.listRandomNames(),
          randomBankApi.listRandomProfessions(),
          randomBankApi.listRandomMotivations(),
          randomBankApi.listRandomPitfalls(),
          randomBankApi.listRandomAppearances(),
          randomBankApi.listRandomSecrets(),
          randomBankApi.listRandomPersonalities(),
          randomBankApi.listRandomRelationships(),
        ]);
      set({
        firstNames: names.filter((n) => n.name_type === 'first').map((n) => n.name),
        lastNames: names.filter((n) => n.name_type === 'last').map((n) => n.name),
        professions: professions.map((p) => p.name),
        motivations: motivations.map((m) => m.text),
        pitfalls: pitfalls.map((p) => p.text),
        appearances: appearances.map((a) => a.text),
        secrets: secrets.map((s) => s.text),
        personalities: personalities.map((p) => p.text),
        relationships: relationships.map((r) => r.text),
        loaded: true,
        loading: false,
      });
    } catch (err) {
      console.error('Failed to load randomizer banks', err);
      set({ loading: false });
    }
  },
}));

export function randomFullName(state: Pick<RandomizerBankState, 'firstNames' | 'lastNames'>): string {
  const first = pickRandom(state.firstNames);
  const last = pickRandom(state.lastNames);
  return [first, last].filter(Boolean).join(' ');
}

export function randomProfession(state: Pick<RandomizerBankState, 'professions'>): string {
  return pickRandom(state.professions);
}

export function randomMotivation(state: Pick<RandomizerBankState, 'motivations'>): string {
  return pickRandom(state.motivations);
}

export function randomPitfall(state: Pick<RandomizerBankState, 'pitfalls'>): string {
  return pickRandom(state.pitfalls);
}

export function randomAppearance(state: Pick<RandomizerBankState, 'appearances'>): string {
  return pickRandom(state.appearances);
}

export function randomSecret(state: Pick<RandomizerBankState, 'secrets'>): string {
  return pickRandom(state.secrets);
}

export function randomPersonality(state: Pick<RandomizerBankState, 'personalities'>): string {
  return pickRandom(state.personalities);
}

export function randomRelationship(state: Pick<RandomizerBankState, 'relationships'>): string {
  return pickRandom(state.relationships);
}
