import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_PANE_SLOTS, type ItemsSurface } from '../components/play/layout/playLayoutTrees';
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
  bySlot: Partial<Record<ItemsSurface, SlotItemsState>>;
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

/** Normalised copies, keyed by the stored object they came from.
 *
 * The cache is not an optimisation, it is the correctness bit: DEFAULT_SLOT_STATE's comment
 * above explains that these values are handed straight to components and fed into useMemo
 * dependency lists, so returning a freshly-built object per call would re-run every downstream
 * memo on every render - including the Random Tables window's ranking pass over the whole
 * library. A WeakMap keyed on the stored object gives one stable normalised instance per
 * version of that object: identity changes exactly when the state actually changes, which is
 * what it did before. */
const normalizedSlots = new WeakMap<object, SlotItemsState>();

/** Fills in anything a persisted slot record is missing.
 *
 * usePlayLayoutStore has always done this (see its own `resolve`); this store never did, and
 * that was a latent crash for the whole life of the file: a slot persisted BEFORE a sub-window
 * kind existed has no entry for it in pinnedByKind/currentByKind/expandedByKind, so the first
 * component to read `pinnedByKind.factions` on it dies on `.length` of undefined. It only ever
 * fired if you opened that particular tab - until countSlotItems (checklist I-P7) started
 * reducing over ALL five kinds on mount, at which point it took the whole Play page down for
 * anyone with older state. Normalising here fixes countSlotItems and every sub-window at once.
 *
 * `kinds` is filtered too: a tab strip holding a kind that no longer exists would render a tab
 * whose sub-window does not exist, and `active` is repointed if it named one. */
function normalizeSlot(stored: SlotItemsState): SlotItemsState {
  const cached = normalizedSlots.get(stored);
  if (cached) return cached;

  const kinds = (stored.kinds ?? []).filter((kind) => ITEMS_TAB_KINDS.includes(kind));
  const normalized: SlotItemsState = {
    ...defaultSlotState(),
    ...stored,
    kinds,
    active: stored.active && kinds.includes(stored.active) ? stored.active : (kinds[0] ?? null),
    pinnedByKind: { ...emptyByKind<string[]>(() => []), ...stored.pinnedByKind },
    currentByKind: { ...emptyByKind<string | null>(() => null), ...stored.currentByKind },
    expandedByKind: { ...emptyByKind<string[]>(() => []), ...stored.expandedByKind },
  };
  normalizedSlots.set(stored, normalized);
  return normalized;
}

function resolveSlot(state: CampaignItemsState, slot: ItemsSurface): SlotItemsState {
  const stored = state.bySlot[slot];
  return stored ? normalizeSlot(stored) : DEFAULT_SLOT_STATE;
}

interface PlayItemsStoreState {
  byCampaignId: Record<string, CampaignItemsState>;
  openTab: (campaignId: string, slot: ItemsSurface, kind: ItemsTabKind) => void;
  closeTab: (campaignId: string, slot: ItemsSurface, kind: ItemsTabKind) => void;
  setActiveTab: (campaignId: string, slot: ItemsSurface, kind: ItemsTabKind) => void;
  /** Reorders one window's tab strip - the drop half of tab drag-and-drop inside a window. */
  moveTab: (campaignId: string, slot: ItemsSurface, kind: ItemsTabKind, toIndex: number) => void;
  /** Moves a sub-tab from one Items window to another, taking that kind's pins, opened row and
   * expanded rows with it - the tab IS its contents, so leaving them behind would silently
   * empty the tab in the act of moving it (checklist I-P3). No-op if the target already has
   * that kind open, since the two would have nowhere to merge to. */
  moveTabToSlot: (
    campaignId: string,
    from: ItemsSurface,
    to: ItemsSurface,
    kind: ItemsTabKind,
    options?: {
      /** Where in the target's strip to insert it. Defaults to the end. */
      toIndex?: number;
      /** Tear-off: the target becomes a window holding ONLY this tab. Without it an empty pane
       * resolves to the default state (a Random Tables tab) and the torn-off tab would arrive
       * with a stranger beside it, which is not what "give this sub-window its own pane" means. */
      replace?: boolean;
    },
  ) => void;
  pinItem: (campaignId: string, slot: ItemsSurface, kind: ItemsTabKind, id: string) => void;
  unpinItem: (campaignId: string, slot: ItemsSurface, kind: ItemsTabKind, id: string) => void;
  selectItem: (campaignId: string, slot: ItemsSurface, kind: ItemsTabKind, id: string) => void;
  toggleExpanded: (campaignId: string, slot: ItemsSurface, kind: ItemsTabKind, id: string) => void;
  /** Selects + force-expands an item in one step - what "open this in the Items window,
   * uncollapsed" means operationally (see mention click handling in EntityRefPreview). */
  focusItem: (campaignId: string, slot: ItemsSurface, kind: ItemsTabKind, id: string) => void;
  /** Opens `kind` in this window *and* focuses `id` inside it - the "show me this creature's
   * card" jump from one sub-window into another (Encounters roster -> Stats). */
  focusItemInTab: (campaignId: string, slot: ItemsSurface, kind: ItemsTabKind, id: string) => void;
  /** Follows a pane swap in the layout: two Items windows trading places have to take their
   * tab sets and pins with them, or a drag silently re-labels both windows' contents. */
  swapSlots: (campaignId: string, a: ItemsSurface, b: ItemsSurface) => void;
  /** Throws away everything one Items window is holding - its tab strip, pins, opened and
   * expanded rows - putting it back to a fresh Random Tables window. What "Clear this window"
   * does, and what a layout reset now does to every slot (checklist I-P7). */
  clearSlot: (campaignId: string, slot: ItemsSurface) => void;
  /** The same, for every pane slot of a campaign. The map surface is deliberately left alone:
   * it is not part of any Play layout, so resetting the Play layout must not wipe the map
   * page's Reference sidebar out from under it. */
  clearCampaignSlots: (campaignId: string) => void;
  /** Drops state for surfaces that are not Items surfaces any more. Run once after rehydrate;
   * a real action rather than an in-place mutation, so the pruned shape is actually written
   * back to localStorage instead of only living until the next reload. */
  pruneUnknownSlots: () => void;
}

/** Every surface an Items window can live on. Anything else found in persisted state is from a
 * layout that no longer exists and is dropped on load - see the persist config. */
const KNOWN_SURFACES: ItemsSurface[] = [...ALL_PANE_SLOTS, 'map'];

/** How many stored rows a slot is holding - drives the "Clear this window" affordance, which
 * should say what it is about to throw away rather than being a blind button. */
export function countSlotItems(state: SlotItemsState): number {
  // resolveSlot normalises every record before it reaches a component, so the optional chaining
  // here is redundant by design - and kept anyway, because this is the function whose crash
  // took the Play page down and it should not be the single point of failure again.
  return ITEMS_TAB_KINDS.reduce(
    (total, kind) =>
      total +
      (state.pinnedByKind?.[kind]?.length ?? 0) +
      (state.expandedByKind?.[kind]?.length ?? 0) +
      (state.currentByKind?.[kind] ? 1 : 0),
    0,
  );
}

function withSlot(
  byCampaignId: Record<string, CampaignItemsState>,
  campaignId: string,
  slot: ItemsSurface,
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

      moveTabToSlot: (campaignId, from, to, kind, options) =>
        set((state) => {
          if (from === to) return state;
          const campaign = resolve(state.byCampaignId, campaignId);
          const source = resolveSlot(campaign, from);
          const target = options?.replace ? defaultSlotState() : resolveSlot(campaign, to);
          if (!source.kinds.includes(kind)) return state;
          if (!options?.replace && target.kinds.includes(kind)) return state;

          const sourceKinds = source.kinds.filter((k) => k !== kind);
          const targetKinds = options?.replace ? [] : [...target.kinds];
          const toIndex = options?.toIndex;
          targetKinds.splice(Math.max(0, Math.min(targetKinds.length, toIndex ?? targetKinds.length)), 0, kind);

          return {
            byCampaignId: {
              ...state.byCampaignId,
              [campaignId]: {
                ...campaign,
                bySlot: {
                  ...campaign.bySlot,
                  [from]: {
                    ...source,
                    kinds: sourceKinds,
                    active: source.active === kind ? (sourceKinds[0] ?? null) : source.active,
                    pinnedByKind: { ...source.pinnedByKind, [kind]: [] },
                    currentByKind: { ...source.currentByKind, [kind]: null },
                    expandedByKind: { ...source.expandedByKind, [kind]: [] },
                  },
                  [to]: {
                    ...target,
                    kinds: targetKinds,
                    active: kind,
                    pinnedByKind: { ...target.pinnedByKind, [kind]: source.pinnedByKind[kind] },
                    currentByKind: { ...target.currentByKind, [kind]: source.currentByKind[kind] },
                    expandedByKind: { ...target.expandedByKind, [kind]: source.expandedByKind[kind] },
                  },
                },
              },
            },
          };
        }),

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

      pruneUnknownSlots: () =>
        set((state) => {
          let changed = false;
          const byCampaignId: Record<string, CampaignItemsState> = {};
          Object.entries(state.byCampaignId).forEach(([campaignId, campaign]) => {
            const bySlot: Partial<Record<ItemsSurface, SlotItemsState>> = {};
            (Object.keys(campaign.bySlot) as ItemsSurface[]).forEach((slot) => {
              if (KNOWN_SURFACES.includes(slot)) bySlot[slot] = campaign.bySlot[slot];
              else changed = true;
            });
            byCampaignId[campaignId] = { ...campaign, bySlot };
          });
          return changed ? { byCampaignId } : state;
        }),

      clearSlot: (campaignId, slot) =>
        set((state) => {
          const campaign = resolve(state.byCampaignId, campaignId);
          if (!campaign.bySlot[slot]) return state;
          const bySlot = { ...campaign.bySlot };
          delete bySlot[slot];
          return { byCampaignId: { ...state.byCampaignId, [campaignId]: { ...campaign, bySlot } } };
        }),

      clearCampaignSlots: (campaignId) =>
        set((state) => {
          const campaign = resolve(state.byCampaignId, campaignId);
          const bySlot: Partial<Record<ItemsSurface, SlotItemsState>> = {};
          if (campaign.bySlot.map) bySlot.map = campaign.bySlot.map;
          return { byCampaignId: { ...state.byCampaignId, [campaignId]: { ...campaign, bySlot } } };
        }),

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
      /** Drops slot state for any surface that is not a real Items surface any more. Nothing
       * ever cleaned these up, so state for a retired slot sat in localStorage forever
       * (checklist I-P7); this is the cheap half of that, run once per load. Deferred by a
       * microtask because the store is still mid-rehydrate when this fires - a set() from
       * inside the callback would be overwritten by the rehydrate that scheduled it. */
      onRehydrateStorage: () => (state) => {
        if (state) queueMicrotask(() => state.pruneUnknownSlots());
      },
      /** v1 kept pins/current/expanded campaign-wide beside a `tabsBySlot` map; v2 folds all of
       * it into the per-slot state so two Items windows are independent. The old shared values
       * are handed to every slot that existed, which preserves what the DM was looking at. */
      migrate: (persisted, version) => {
        if (version >= 2 || !persisted || typeof persisted !== 'object') return persisted as never;
        const old = persisted as { byCampaignId?: Record<string, Record<string, unknown>> };
        const byCampaignId: Record<string, CampaignItemsState> = {};
        Object.entries(old.byCampaignId ?? {}).forEach(([campaignId, campaign]) => {
          const tabsBySlot = (campaign.tabsBySlot ?? {}) as Partial<
            Record<ItemsSurface, { kinds: ItemsTabKind[]; active: ItemsTabKind | null }>
          >;
          const shared = {
            pinnedByKind: (campaign.pinnedByKind ?? emptyByKind<string[]>(() => [])) as Record<ItemsTabKind, string[]>,
            currentByKind: (campaign.currentByKind ?? emptyByKind<string | null>(() => null)) as Record<ItemsTabKind, string | null>,
            expandedByKind: (campaign.expandedByKind ?? emptyByKind<string[]>(() => [])) as Record<ItemsTabKind, string[]>,
          };
          const bySlot: Partial<Record<ItemsSurface, SlotItemsState>> = {};
          (Object.keys(tabsBySlot) as ItemsSurface[]).forEach((slot) => {
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

export function getSlotItems(state: CampaignItemsState, slot: ItemsSurface): SlotItemsState {
  return resolveSlot(state, slot);
}
