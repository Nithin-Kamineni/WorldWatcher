import { create } from 'zustand';
import {
  CONDITION_FALLBACK_NAMES,
  CONDITION_TYPE_TO_GROUP,
  SPELL_STATUS_EFFECTS,
  type EffectCatalogEntry,
} from '../types/effect';
import * as conditionsApi from '../api/resources/conditions';
import * as effectsApi from '../api/resources/effects';

/**
 * The catalogue behind the token status picker (TokenEffectsEditor).
 *
 * Conditions come from the compendium's `conditions` rows rather than a hardcoded name list,
 * so the picker can show each one's rules text, and the source books' diseases and statuses
 * (Bloodied, Surprised) become reachable at all - they were simply missing before. Spell
 * markers stay curated (see types/effect.ts), and anything the DM types is persisted as an
 * Effect row.
 */
interface EffectCatalogState {
  entries: EffectCatalogEntry[];
  loaded: boolean;
  loading: boolean;
  /** true when /api/conditions could not be reached and the name-only fallback is in use */
  degraded: boolean;
  fetchCatalog: () => Promise<void>;
  addCustomEffect: (name: string) => void;
}

const spellEntries: EffectCatalogEntry[] = SPELL_STATUS_EFFECTS.map((name) => ({
  name,
  group: 'spell',
}));

const fallbackConditionEntries: EffectCatalogEntry[] = CONDITION_FALLBACK_NAMES.map((name) => ({
  name,
  group: 'condition',
}));

/** Collapses case/whitespace so "restrained" never lands beside "Restrained". */
const key = (name: string) => name.trim().toLowerCase();

/**
 * The conditions table carries each core condition twice - once per rules edition - so a plain
 * "first wins" would show whichever the server happened to order first, with the terser of the
 * two texts. Keep the entry whose description is longest instead: that is reliably the fuller
 * rules text, and it keeps the group ordering (condition before spell before custom) as the
 * tie-breaker for which *group* a repeated name belongs to.
 */
function dedupe(entries: EffectCatalogEntry[]): EffectCatalogEntry[] {
  const byKey = new Map<string, EffectCatalogEntry>();
  for (const entry of entries) {
    const k = key(entry.name);
    if (!k) continue;
    const existing = byKey.get(k);
    if (!existing) {
      byKey.set(k, entry);
      continue;
    }
    if ((entry.description?.length ?? 0) > (existing.description?.length ?? 0)) {
      // Richer text wins, but the first group seen still owns the name.
      byKey.set(k, { ...entry, group: existing.group });
    }
  }
  return [...byKey.values()];
}

export const useEffectCatalogStore = create<EffectCatalogState>((set, get) => ({
  entries: dedupe([...fallbackConditionEntries, ...spellEntries]),
  loaded: false,
  loading: false,
  degraded: false,

  fetchCatalog: async () => {
    const state = get();
    if (state.loaded || state.loading) return;
    set({ loading: true });

    // Conditions are the reference data; effects are the DM's own additions.
    // Either can fail on its own without emptying the picker.
    const [conditions, effects] = await Promise.all([
      conditionsApi
        .listConditions({ limit: 500 })
        .then((page) => page.items)
        .catch((err) => {
          console.error('Failed to load conditions', err);
          return null;
        }),
      effectsApi
        .listEffects()
        .then((page) => page.items)
        .catch((err) => {
          console.error('Failed to load custom effects', err);
          return [];
        }),
    ]);

    const conditionEntries: EffectCatalogEntry[] =
      conditions === null
        ? fallbackConditionEntries
        : conditions.map((condition) => ({
            name: condition.name,
            // An unrecognised condition_type is still a real thing to mark on a token -
            // file it under Conditions rather than dropping it.
            group: CONDITION_TYPE_TO_GROUP[condition.condition_type ?? ''] ?? 'condition',
            description: condition.description ?? undefined,
          }));

    // A saved Effect row that merely repeats a condition or a curated marker is not a third
    // entry - dedupe() keeps it under the group that claimed the name first.
    const customEntries: EffectCatalogEntry[] = effects.map((effect) => ({
      name: effect.name,
      group: 'custom' as const,
      description: effect.description ?? undefined,
    }));

    set({
      entries: dedupe([...conditionEntries, ...spellEntries, ...customEntries]),
      loaded: true,
      loading: false,
      degraded: conditions === null,
    });
  },

  addCustomEffect: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const state = get();
    if (state.entries.some((entry) => key(entry.name) === key(trimmed))) return;
    set({ entries: [...state.entries, { name: trimmed, group: 'custom' }] });
    effectsApi.createEffect({ name: trimmed, effect_type: 'CUSTOM' }).catch((err) => {
      console.error('Failed to persist custom effect', err);
    });
  },
}));
