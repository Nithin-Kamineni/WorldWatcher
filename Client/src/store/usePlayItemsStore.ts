import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PaneSlot } from '../components/play/layout/playLayoutTrees';
import type { EntityRefType } from '../utils/bbcode';

export type ItemsTabKind = 'random-tables' | 'encounters' | 'stats' | 'places' | 'factions';

export const ITEMS_TAB_KINDS: ItemsTabKind[] = ['random-tables', 'encounters', 'stats', 'places', 'factions'];

/** One Items window's complete state. Everything here is per pane slot, not per campaign: two
 * Items windows open at once are two independent workspaces, so pinning/opening/expanding a
 * row in one must not move the other - comparing two things side by side is the whole reason
 * to open a second one. */
export interface SlotItemsState {
  /** Chrome-tab-style open sub-windows (issues.txt 10.c.1/10.c.2). */
  kinds: ItemsTabKind[];
  active: ItemsTabKind | null;
  pinnedByKind: Record<ItemsTabKind, string[]>;
  /** The one replaceable "just selected" slot per kind - a new pick overwrites this, pinned
   * items never do (issues.txt 10.c.3b). */
  currentByKind: Record<ItemsTabKind, string | null>;
  expandedByKind: Record<ItemsTabKind, string[]>;
}

interface CampaignItemsState {
  bySlot: Partial<Record<PaneSlot, SlotItemsState>>;
}

function emptyByKind<T>(make: () => T): Record<ItemsTabKind, T> {
  return {
    'random-tables': make(),
    encounters: make(),
    stats: make(),
    places: make(),
    factions: make(),
  };
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

function defaultSlotState(): SlotItemsState {
  return {
    kinds: ['random-tables'],
    active: 'random-tables',
    pinnedByKind: emptyByKind<string[]>(() => []),
    currentByKind: emptyByKind<string | null>(() => null),
    expandedByKind: emptyByKind<string[]>(() => []),
  };
}

/** Shared fallbacks for a slot/campaign with nothing stored yet. These are handed straight back
 * to components, so they have to be stable *identities*, not fresh objects per call - a new
 * array every render would re-run every downstream useMemo, and the Random Tables window memoises
 * work over the whole 20k-table library. Nothing mutates state in place (every action copies),
 * so sharing one instance is safe. */
const DEFAULT_SLOT_STATE: SlotItemsState = defaultSlotState();
const DEFAULT_CAMPAIGN_STATE: CampaignItemsState = { bySlot: {} };

function resolve(byCampaignId: Record<string, CampaignItemsState>, campaignId: string): CampaignItemsState {
  return byCampaignId[campaignId] ?? DEFAULT_CAMPAIGN_STATE;
}

function resolveSlot(state: CampaignItemsState, slot: PaneSlot): SlotItemsState {
  return state.bySlot[slot] ?? DEFAULT_SLOT_STATE;
}

interface PlayItemsStoreState {
  byCampaignId: Record<string, CampaignItemsState>;
  openTab: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind) => void;
  closeTab: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind) => void;
  setActiveTab: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind) => void;
  /** Reorders one window's tab strip - the drop half of tab drag-and-drop inside a window. */
  moveTab: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind, toIndex: number) => void;
  pinItem: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind, id: string) => void;
  unpinItem: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind, id: string) => void;
  selectItem: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind, id: string) => void;
  toggleExpanded: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind, id: string) => void;
  /** Selects + force-expands an item in one step - what "open this in the Items window,
   * uncollapsed" means operationally (see mention click handling in EntityRefPreview). */
  focusItem: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind, id: string) => void;
  /** Opens `kind` in this window *and* focuses `id` inside it - the "show me this creature's
   * card" jump from one sub-window into another (Encounters roster -> Stats). */
  focusItemInTab: (campaignId: string, slot: PaneSlot, kind: ItemsTabKind, id: string) => void;
  /** Follows a pane swap in the layout: two Items windows trading places have to take their
   * tab sets and pins with them, or a drag silently re-labels both windows' contents. */
  swapSlots: (campaignId: string, a: PaneSlot, b: PaneSlot) => void;
}

function withSlot(
  byCampaignId: Record<string, CampaignItemsState>,
  campaignId: string,
  slot: PaneSlot,
  patch: (slotState: SlotItemsState) => Partial<SlotItemsState>,
): Record<string, CampaignItemsState> {
  const campaign = resolve(byCampaignId, campaignId);
  const slotState = resolveSlot(campaign, slot);
  return {
    ...byCampaignId,
    [campaignId]: { ...campaign, bySlot: { ...campaign.bySlot, [slot]: { ...slotState, ...patch(slotState) } } },
  };
}

export const usePlayItemsStore = create<PlayItemsStoreState>()(
  persist(
    (set) => ({
      byCampaignId: {},

      openTab: (campaignId, slot, kind) =>
        set((state) => ({
          byCampaignId: withSlot(state.byCampaignId, campaignId, slot, (s) => ({
            kinds: s.kinds.includes(kind) ? s.kinds : [...s.kinds, kind],
            active: kind,
          })),
        })),

      closeTab: (campaignId, slot, kind) =>
        set((state) => ({
          byCampaignId: withSlot(state.byCampaignId, campaignId, slot, (s) => {
            const kinds = s.kinds.filter((k) => k !== kind);
            return { kinds, active: s.active === kind ? (kinds[0] ?? null) : s.active };
          }),
        })),

      setActiveTab: (campaignId, slot, kind) =>
        set((state) => ({
          byCampaignId: withSlot(state.byCampaignId, campaignId, slot, () => ({ active: kind })),
        })),

      moveTab: (campaignId, slot, kind, toIndex) =>
        set((state) => ({
          byCampaignId: withSlot(state.byCampaignId, campaignId, slot, (s) => {
            const from = s.kinds.indexOf(kind);
            if (from === -1) return {};
            const kinds = [...s.kinds];
            kinds.splice(from, 1);
            kinds.splice(Math.max(0, Math.min(kinds.length, toIndex)), 0, kind);
            return { kinds };
          }),
        })),

      pinItem: (campaignId, slot, kind, id) =>
        set((state) => ({
          byCampaignId: withSlot(state.byCampaignId, campaignId, slot, (s) =>
            s.pinnedByKind[kind].includes(id)
              ? {}
              : { pinnedByKind: { ...s.pinnedByKind, [kind]: [...s.pinnedByKind[kind], id] } },
          ),
        })),

      unpinItem: (campaignId, slot, kind, id) =>
        set((state) => ({
          byCampaignId: withSlot(state.byCampaignId, campaignId, slot, (s) => ({
            pinnedByKind: { ...s.pinnedByKind, [kind]: s.pinnedByKind[kind].filter((x) => x !== id) },
          })),
        })),

      selectItem: (campaignId, slot, kind, id) =>
        set((state) => ({
          byCampaignId: withSlot(state.byCampaignId, campaignId, slot, (s) => ({
            currentByKind: { ...s.currentByKind, [kind]: id },
          })),
        })),

      toggleExpanded: (campaignId, slot, kind, id) =>
        set((state) => ({
          byCampaignId: withSlot(state.byCampaignId, campaignId, slot, (s) => {
            const expanded = s.expandedByKind[kind];
            const next = expanded.includes(id) ? expanded.filter((x) => x !== id) : [...expanded, id];
            return { expandedByKind: { ...s.expandedByKind, [kind]: next } };
          }),
        })),

      focusItem: (campaignId, slot, kind, id) =>
        set((state) => ({
          byCampaignId: withSlot(state.byCampaignId, campaignId, slot, (s) => {
            const expanded = s.expandedByKind[kind];
            return {
              currentByKind: { ...s.currentByKind, [kind]: id },
              expandedByKind: { ...s.expandedByKind, [kind]: expanded.includes(id) ? expanded : [...expanded, id] },
            };
          }),
        })),

      focusItemInTab: (campaignId, slot, kind, id) =>
        set((state) => ({
          byCampaignId: withSlot(state.byCampaignId, campaignId, slot, (s) => {
            const expanded = s.expandedByKind[kind];
            return {
              kinds: s.kinds.includes(kind) ? s.kinds : [...s.kinds, kind],
              active: kind,
              currentByKind: { ...s.currentByKind, [kind]: id },
              expandedByKind: { ...s.expandedByKind, [kind]: expanded.includes(id) ? expanded : [...expanded, id] },
            };
          }),
        })),

      swapSlots: (campaignId, a, b) =>
        set((state) => {
          if (a === b) return state;
          const campaign = resolve(state.byCampaignId, campaignId);
          const stateA = campaign.bySlot[a];
          const stateB = campaign.bySlot[b];
          const bySlot = { ...campaign.bySlot };
          if (stateB) bySlot[a] = stateB;
          else delete bySlot[a];
          if (stateA) bySlot[b] = stateA;
          else delete bySlot[b];
          return { byCampaignId: { ...state.byCampaignId, [campaignId]: { ...campaign, bySlot } } };
        }),
    }),
    {
      name: 'worldwatcher-play-items',
      version: 2,
      /** v1 kept pins/current/expanded campaign-wide beside a `tabsBySlot` map; v2 folds all of
       * it into the per-slot state so two Items windows are independent. The old shared values
       * are handed to every slot that existed, which preserves what the DM was looking at. */
      migrate: (persisted, version) => {
        if (version >= 2 || !persisted || typeof persisted !== 'object') return persisted as never;
        const old = persisted as { byCampaignId?: Record<string, Record<string, unknown>> };
        const byCampaignId: Record<string, CampaignItemsState> = {};
        Object.entries(old.byCampaignId ?? {}).forEach(([campaignId, campaign]) => {
          const tabsBySlot = (campaign.tabsBySlot ?? {}) as Partial<
            Record<PaneSlot, { kinds: ItemsTabKind[]; active: ItemsTabKind | null }>
          >;
          const shared = {
            pinnedByKind: (campaign.pinnedByKind ?? emptyByKind<string[]>(() => [])) as Record<ItemsTabKind, string[]>,
            currentByKind: (campaign.currentByKind ?? emptyByKind<string | null>(() => null)) as Record<ItemsTabKind, string | null>,
            expandedByKind: (campaign.expandedByKind ?? emptyByKind<string[]>(() => [])) as Record<ItemsTabKind, string[]>,
          };
          const bySlot: Partial<Record<PaneSlot, SlotItemsState>> = {};
          (Object.keys(tabsBySlot) as PaneSlot[]).forEach((slot) => {
            const tabs = tabsBySlot[slot];
            bySlot[slot] = {
              ...defaultSlotState(),
              ...shared,
              kinds: tabs?.kinds ?? ['random-tables'],
              active: tabs?.active ?? 'random-tables',
            };
          });
          byCampaignId[campaignId] = { bySlot };
        });
        return { byCampaignId } as never;
      },
    },
  ),
);

export function getPlayItemsState(
  byCampaignId: Record<string, CampaignItemsState>,
  campaignId: string | undefined,
): CampaignItemsState {
  if (!campaignId) return DEFAULT_CAMPAIGN_STATE;
  return resolve(byCampaignId, campaignId);
}

export function getSlotItems(state: CampaignItemsState, slot: PaneSlot): SlotItemsState {
  return resolveSlot(state, slot);
}
