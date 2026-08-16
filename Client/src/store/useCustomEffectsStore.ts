import { create } from 'zustand';
import { PRESET_EFFECTS } from '../types/effect';
import * as effectsApi from '../api/resources/effects';

interface CustomEffectsState {
  customEffectNames: string[];
  loaded: boolean;
  fetchCustomEffects: () => Promise<void>;
  addCustomEffect: (name: string) => void;
}

export const useCustomEffectsStore = create<CustomEffectsState>((set, get) => ({
  customEffectNames: [],
  loaded: false,

  fetchCustomEffects: async () => {
    if (get().loaded) return;
    try {
      const page = await effectsApi.listEffects();
      const names = page.items
        .map((e) => e.name)
        .filter((name) => !PRESET_EFFECTS.some((preset) => preset.toLowerCase() === name.toLowerCase()));
      set({ customEffectNames: names, loaded: true });
    } catch (err) {
      console.error('Failed to load custom effects', err);
    }
  },

  addCustomEffect: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const state = get();
    const exists = [...PRESET_EFFECTS, ...state.customEffectNames].some(
      (existing) => existing.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) return;
    set({ customEffectNames: [...state.customEffectNames, trimmed] });
    effectsApi.createEffect({ name: trimmed, effect_type: 'CUSTOM' }).catch((err) => {
      console.error('Failed to persist custom effect', err);
    });
  },
}));
