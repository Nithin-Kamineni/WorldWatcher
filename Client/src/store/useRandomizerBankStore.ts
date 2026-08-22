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
  loaded: false,
  loading: false,

  fetchBanks: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const [names, professions, motivations, pitfalls] = await Promise.all([
        randomBankApi.listRandomNames(),
        randomBankApi.listRandomProfessions(),
        randomBankApi.listRandomMotivations(),
        randomBankApi.listRandomPitfalls(),
      ]);
      set({
        firstNames: names.filter((n) => n.name_type === 'first').map((n) => n.name),
        lastNames: names.filter((n) => n.name_type === 'last').map((n) => n.name),
        professions: professions.map((p) => p.name),
        motivations: motivations.map((m) => m.text),
        pitfalls: pitfalls.map((p) => p.text),
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
