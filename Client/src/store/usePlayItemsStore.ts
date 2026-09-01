import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PaneSlot } from '../components/play/layout/playLayoutTrees';
import type { EntityRefType } from '../utils/bbcode';

export type ItemsTabKind = 'random-tables' | 'encounters' | 'stats' | 'places' | 'factions';

export const ITEMS_TAB_KINDS: ItemsTabKind[] = ['random-tables', 'encounters', 'stats', 'places', 'factions'];

interface SlotTabsState {
  kinds: ItemsTabKind[];
  active: ItemsTabKind | null;
}

interface CampaignItemsState {
  /** Chrome-tab-style open sub-windows, per pane slot (a quad layout can have 2 independent
   * Items windows) - issues.txt 10.c.1/10.c.2. */
  tabsBySlot: Partial<Record<PaneSlot, SlotTabsState>>;
  /** Everything below is campaign-wide per kind, not per pane - "remembered throughout the
   * game" (issues.txt 10.c.3c) regardless of which window/layout is showing it. */
  pinnedByKind: Record<ItemsTabKind, string[]>;
  /** The one replaceable "just selected" slot per kind - a new pick overwrites this, pinned
   * items never do (issues.txt 10.c.3b). */
  currentByKind: Record<ItemsTabKind, string | null>;
  expandedByKind: Record<ItemsTabKind, string[]>;
}

function emptyByKind<T>(value: T): Record<ItemsTabKind, T> {
  return { 'random-tables': value, encounters: value, stats: value, places: value, factions: value };
}

/** id "creature:<uuid>" / "spell:<uuid>" / "item:<uuid>" - lets pinned/current share one string
 * id space across 3 different entity stores inside the Stats sub-window. */
export function compositeId(kind: 'creature' | 'spell' | 'item', id: string): string {
  return `${kind}:${id}`;
}
export function splitComposite(compId: string): { kind: 'creature' | 'spell' | 'item'; id: string } {
  const [kind, ...rest] = compId.split(':');
  return { kind: kind as 'creature' | 'spell' | 'item', id: rest.join(':') };
}

/** Maps an @-mention's ref type to the Items sub-window tab (and item id within it) that can
 * display it, so a mention click can open/focus the right sub-window. Every ref type has a
 * home: situational tables live in the Random Tables sub-window, everything else maps 1:1. */
export function mapEntityRefToItemsTarget(type: EntityRefType, id: string): { kind: ItemsTabKind; itemId: string } | null {
  switch (type) {
    case 'npc':
    case 'creature':
      return { kind: 'stats', itemId: compositeId('creature', id) };
    case 'spell':
      return { kind: 'stats', itemId: compositeId('spell', id) };
    case 'faction':
      return { kind: 'factions', itemId: id };
    case 'encounter':
      return { kind: 'encounters', itemId: id };
    case 'place':
      return { kind: 'places', itemId: id };
    case 'situational_table':
      return { kind: 'random-tables', itemId: id };
    default:
      return null;
  }
}

function defaultCampaignState(): CampaignItemsState {
  return {
    tabsBySlot: {},
    pinnedByKind: emptyByKind<string[]>([]) as unknown as Record<ItemsTabKind, string[]>,
    currentByKind: emptyByKind<string | null>(null),
    expandedByKind: emptyByKind<string[]>([]) as unknown as Record<ItemsTabKind, string[]>,
  };
}

function resolve(byCampaignId: Record<string, CampaignItemsState>, campaignId: string): CampaignItemsState {
  return byCampaignId[campaignId] ?? defaultCampaignState();
}

function resolveSlot(state: CampaignItemsState, slot: PaneSlot): SlotTabsState {
  return state.tabsBySlot[slot] ?? { kinds: ['random-tables'], active: 'random-tables' };
}

interface PlayItemsStoreState {
  byCampaignId: Record<string, CampaignItemsState>;
  openTab: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind) => void;
  closeTab: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind) => void;
  setActiveTab: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind) => void;
  pinItem: (campaignId: string, kind: ItemsTabKind, id: string) => void;
  unpinItem: (campaignId: string, kind: ItemsTabKind, id: string) => void;
  selectItem: (campaignId: string, kind: ItemsTabKind, id: string) => void;
  toggleExpanded: (campaignId: string, kind: ItemsTabKind, id: string) => void;
  /** Idempotent "set expanded" (unlike toggleExpanded) - used when focusing an item, where we
   * always want it open regardless of its current state. */
  expandItem: (campaignId: string, kind: ItemsTabKind, id: string) => void;
  /** Selects + force-expands an item in one step - what "open this in the Items window,
   * uncollapsed" means operationally (see mention click handling in EntityRefPreview). */
  focusItem: (campaignId: string, kind: ItemsTabKind, id: string) => void;
}

function withCampaign(
  byCampaignId: Record<string, CampaignItemsState>,
  campaignId: string,
  patch: Partial<CampaignItemsState>,
): Record<string, CampaignItemsState> {
  return { ...byCampaignId, [campaignId]: { ...resolve(byCampaignId, campaignId), ...patch } };
}

export const usePlayItemsStore = create<PlayItemsStoreState>()(
  persist(
    (set) => ({
      byCampaignId: {},

      openTab: (campaignId, slot, kind) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          const slotState = resolveSlot(current, slot);
          const kinds = slotState.kinds.includes(kind) ? slotState.kinds : [...slotState.kinds, kind];
          return {
            byCampaignId: withCampaign(state.byCampaignId, campaignId, {
              tabsBySlot: { ...current.tabsBySlot, [slot]: { kinds, active: kind } },
            }),
          };
        }),

      closeTab: (campaignId, slot, kind) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          const slotState = resolveSlot(current, slot);
          const kinds = slotState.kinds.filter((k) => k !== kind);
          const active = slotState.active === kind ? (kinds[0] ?? null) : slotState.active;
          return {
            byCampaignId: withCampaign(state.byCampaignId, campaignId, {
              tabsBySlot: { ...current.tabsBySlot, [slot]: { kinds, active } },
            }),
          };
        }),

      setActiveTab: (campaignId, slot, kind) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          const slotState = resolveSlot(current, slot);
          return {
            byCampaignId: withCampaign(state.byCampaignId, campaignId, {
              tabsBySlot: { ...current.tabsBySlot, [slot]: { ...slotState, active: kind } },
            }),
          };
        }),

      pinItem: (campaignId, kind, id) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          if (current.pinnedByKind[kind].includes(id)) return state;
          return {
            byCampaignId: withCampaign(state.byCampaignId, campaignId, {
              pinnedByKind: { ...current.pinnedByKind, [kind]: [...current.pinnedByKind[kind], id] },
            }),
          };
        }),

      unpinItem: (campaignId, kind, id) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          return {
            byCampaignId: withCampaign(state.byCampaignId, campaignId, {
              pinnedByKind: { ...current.pinnedByKind, [kind]: current.pinnedByKind[kind].filter((x) => x !== id) },
            }),
          };
        }),

      selectItem: (campaignId, kind, id) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          return {
            byCampaignId: withCampaign(state.byCampaignId, campaignId, {
              currentByKind: { ...current.currentByKind, [kind]: id },
            }),
          };
        }),

      toggleExpanded: (campaignId, kind, id) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          const expanded = current.expandedByKind[kind];
          const next = expanded.includes(id) ? expanded.filter((x) => x !== id) : [...expanded, id];
          return {
            byCampaignId: withCampaign(state.byCampaignId, campaignId, {
              expandedByKind: { ...current.expandedByKind, [kind]: next },
            }),
          };
        }),

      expandItem: (campaignId, kind, id) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          const expanded = current.expandedByKind[kind];
          if (expanded.includes(id)) return state;
          return {
            byCampaignId: withCampaign(state.byCampaignId, campaignId, {
              expandedByKind: { ...current.expandedByKind, [kind]: [...expanded, id] },
            }),
          };
        }),

      focusItem: (campaignId, kind, id) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          const expanded = current.expandedByKind[kind];
          return {
            byCampaignId: withCampaign(state.byCampaignId, campaignId, {
              currentByKind: { ...current.currentByKind, [kind]: id },
              expandedByKind: { ...current.expandedByKind, [kind]: expanded.includes(id) ? expanded : [...expanded, id] },
            }),
          };
        }),
    }),
    { name: 'worldwatcher-play-items' },
  ),
);

export function getPlayItemsState(
  byCampaignId: Record<string, CampaignItemsState>,
  campaignId: string | undefined,
): CampaignItemsState {
  if (!campaignId) return defaultCampaignState();
  return resolve(byCampaignId, campaignId);
}

export function getSlotTabs(state: CampaignItemsState, slot: PaneSlot): SlotTabsState {
  return resolveSlot(state, slot);
}
