import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SHORTCUT_ACTIONS, SHORTCUT_ACTIONS_BY_ID, type ShortcutCategory } from '../types/shortcut';

export interface ShortcutOverride {
  combo?: string;
  toolbar?: boolean;
  inline?: boolean;
}

interface ShortcutStoreState {
  overrides: Record<string, ShortcutOverride>;
  setCombo: (actionId: string, combo: string) => void;
  setToolbarVisible: (actionId: string, visible: boolean) => void;
  setInlineVisible: (actionId: string, visible: boolean) => void;
  resetAction: (actionId: string) => void;
  resetAll: () => void;
  /** Bulk-commits a whole overrides map in one write - used by ShortcutsSettingsDialog's
   * "Save and Close", which buffers edits locally so nothing takes effect until confirmed. */
  replaceAll: (overrides: Record<string, ShortcutOverride>) => void;
}

/** Per-DM keyboard-shortcut customizations for running combat on the map - muscle-memory
 * preference, not campaign data other players/co-DMs need to see, so this stays localStorage
 * (same precedent as useTokenManagerUiStore) rather than syncing to the backend. */
export const useShortcutStore = create<ShortcutStoreState>()(
  persist(
    (set) => ({
      overrides: {},

      setCombo: (actionId, combo) =>
        set((state) => ({
          overrides: { ...state.overrides, [actionId]: { ...state.overrides[actionId], combo } },
        })),

      setToolbarVisible: (actionId, visible) =>
        set((state) => ({
          overrides: { ...state.overrides, [actionId]: { ...state.overrides[actionId], toolbar: visible } },
        })),

      setInlineVisible: (actionId, visible) =>
        set((state) => ({
          overrides: { ...state.overrides, [actionId]: { ...state.overrides[actionId], inline: visible } },
        })),

      resetAction: (actionId) =>
        set((state) => {
          const next = { ...state.overrides };
          delete next[actionId];
          return { overrides: next };
        }),

      resetAll: () => set({ overrides: {} }),

      replaceAll: (overrides) => set({ overrides }),
    }),
    { name: 'worldwatcher-shortcut-overrides' },
  ),
);

export function getEffectiveCombo(overrides: Record<string, ShortcutOverride>, actionId: string): string {
  return overrides[actionId]?.combo ?? SHORTCUT_ACTIONS_BY_ID[actionId]?.defaultCombo ?? '';
}

export function getEffectiveToolbar(overrides: Record<string, ShortcutOverride>, actionId: string): boolean {
  return overrides[actionId]?.toolbar ?? SHORTCUT_ACTIONS_BY_ID[actionId]?.defaultToolbar ?? false;
}

export function getEffectiveInline(overrides: Record<string, ShortcutOverride>, actionId: string): boolean {
  return overrides[actionId]?.inline ?? SHORTCUT_ACTIONS_BY_ID[actionId]?.defaultInline ?? false;
}

/** actionId of whichever action currently owns `combo` within `category`, if any (combos may
 * collide across categories - e.g. an encounter and a combatant action sharing a key is fine
 * since only one category is ever the target of a given press's intent). */
export function findComboOwner(
  overrides: Record<string, ShortcutOverride>,
  category: ShortcutCategory,
  combo: string,
  excludingActionId?: string,
): string | undefined {
  return SHORTCUT_ACTIONS.find(
    (a) => a.category === category && a.id !== excludingActionId && getEffectiveCombo(overrides, a.id) === combo,
  )?.id;
}

/** Builds actionId -> effective combo for every action in a category, for the keydown
 * dispatcher's reverse lookup (combo -> actionId). */
export function buildComboLookup(
  overrides: Record<string, ShortcutOverride>,
  category: ShortcutCategory,
): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const action of SHORTCUT_ACTIONS) {
    if (action.category !== category) continue;
    lookup[getEffectiveCombo(overrides, action.id)] = action.id;
  }
  return lookup;
}
