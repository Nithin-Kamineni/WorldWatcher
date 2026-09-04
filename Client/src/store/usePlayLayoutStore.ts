import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PaneSlot, PlayLayoutId } from '../components/play/layout/playLayoutTrees';

/** What a pane slot shows. `empty` is a real, deliberate state, not an absence: closing a
 * window leaves its space behind as a droppable placeholder so the DM can drag another window
 * into it (or pick a kind for it) instead of the layout silently reflowing under them. A slot
 * whose space should go back to its neighbours is *dismissed* instead - see dismissedPanes. */
export type PlayWindowKind = 'session' | 'chat' | 'items' | 'empty';

/** The kinds a DM can actually pick from a menu - `empty` is reached by closing a window. */
export const PICKABLE_WINDOW_KINDS: Exclude<PlayWindowKind, 'empty'>[] = ['session', 'items', 'chat'];

interface CampaignLayoutState {
  layoutId: PlayLayoutId;
  locked: boolean;
  /** Keyed `${layoutId}:${splitNode.path}` - flex-grow weights for that split's children, see
   * SplitPane.tsx. Missing key = even split (SplitPane's own default). */
  paneSizes: Record<string, number[]>;
  /** Chat-only feature (issues.txt 8.4) - which pane slots are currently collapsed to a thin
   * strip. Stored generically by slot since a slot's assigned window kind can change. */
  collapsedPanes: Partial<Record<PaneSlot, boolean>>;
  /** Which window kind each pane slot shows, per layout - lets switching layouts remember a
   * different arrangement per layout rather than one global assignment. */
  windowAssignment: Record<PlayLayoutId, Partial<Record<PaneSlot, PlayWindowKind>>>;
  /** Per layout, the slots whose space has been handed back to their neighbours. SplitPane
   * prunes these out of the tree entirely, so dismissing one of two side-by-side panes really
   * does turn a two-window layout into a single-window one without changing layoutId. */
  dismissedPanes: Record<PlayLayoutId, Partial<Record<PaneSlot, boolean>>>;
}

/** Default arrangement per issues.txt 10.8: "session window, Items window (random table
 * default), chat window from left to right." Quad's 4th slot has no spec'd default - reuses
 * Items (a second, independently-tabbed Items window) rather than duplicating Chat/Session. */
function defaultWindowAssignment(): Record<PlayLayoutId, Partial<Record<PaneSlot, PlayWindowKind>>> {
  return {
    single: { p1: 'session' },
    'double-row': { p1: 'session', p2: 'items' },
    'double-col': { p1: 'session', p2: 'items' },
    'triple-even': { p1: 'session', p2: 'items', p3: 'chat' },
    'triple-half': { p1: 'session', p2: 'items', p3: 'chat' },
    quad: { p1: 'session', p2: 'items', p3: 'chat', p4: 'items' },
  };
}

function emptyPerLayout(): Record<PlayLayoutId, Partial<Record<PaneSlot, boolean>>> {
  return { single: {}, 'double-row': {}, 'double-col': {}, 'triple-even': {}, 'triple-half': {}, quad: {} };
}

function defaultCampaignState(): CampaignLayoutState {
  return {
    layoutId: 'double-row',
    locked: false,
    paneSizes: {},
    collapsedPanes: {},
    windowAssignment: defaultWindowAssignment(),
    dismissedPanes: emptyPerLayout(),
  };
}

/** Fills in anything a persisted (older) record is missing, so a field added after a DM already
 * has state in localStorage never reads back as undefined. */
function resolve(byCampaignId: Record<string, CampaignLayoutState>, campaignId: string): CampaignLayoutState {
  const stored = byCampaignId[campaignId];
  if (!stored) return defaultCampaignState();
  return {
    ...defaultCampaignState(),
    ...stored,
    windowAssignment: { ...defaultWindowAssignment(), ...stored.windowAssignment },
    dismissedPanes: { ...emptyPerLayout(), ...stored.dismissedPanes },
  };
}

interface PlayLayoutStoreState {
  byCampaignId: Record<string, CampaignLayoutState>;
  setLayout: (campaignId: string, layoutId: PlayLayoutId) => void;
  toggleLock: (campaignId: string) => void;
  setPaneSizes: (campaignId: string, key: string, sizes: number[]) => void;
  /** Clears remembered pane sizes for the current layout and brings every closed/dismissed pane
   * back - the one "put it back how it was" button. */
  resetLayout: (campaignId: string) => void;
  toggleCollapsed: (campaignId: string, slot: PaneSlot) => void;
  setWindowKind: (campaignId: string, layoutId: PlayLayoutId, slot: PaneSlot, kind: PlayWindowKind) => void;
  /** Closes a window, leaving its space behind as an empty droppable placeholder. */
  closePane: (campaignId: string, layoutId: PlayLayoutId, slot: PaneSlot) => void;
  /** Hands an (already empty) pane's space back to its neighbours, changing the effective
   * layout without changing which layout is selected. */
  dismissPane: (campaignId: string, layoutId: PlayLayoutId, slot: PaneSlot) => void;
  /** Brings every dismissed pane in this layout back as an empty placeholder. */
  restoreDismissedPanes: (campaignId: string, layoutId: PlayLayoutId) => void;
  /** Trades two panes' contents - the drop half of pane drag-and-drop. Collapsed state travels
   * with the pane; the Items sub-tab state is swapped separately by usePlayItemsStore. */
  swapPanes: (campaignId: string, layoutId: PlayLayoutId, a: PaneSlot, b: PaneSlot) => void;
  /** Finds an Items-window pane in the current layout, converting/uncollapsing one if none is
   * currently visible, and returns its slot - used so an @-mention click always has somewhere
   * to open into (see EntityRefPreview). */
  ensureItemsPane: (campaignId: string, layoutId: PlayLayoutId, slots: PaneSlot[]) => PaneSlot;
}

function patch(
  byCampaignId: Record<string, CampaignLayoutState>,
  campaignId: string,
  next: (current: CampaignLayoutState) => Partial<CampaignLayoutState>,
): Record<string, CampaignLayoutState> {
  const current = resolve(byCampaignId, campaignId);
  return { ...byCampaignId, [campaignId]: { ...current, ...next(current) } };
}

export const usePlayLayoutStore = create<PlayLayoutStoreState>()(
  persist(
    (set, get) => ({
      byCampaignId: {},

      setLayout: (campaignId, layoutId) => set((state) => ({ byCampaignId: patch(state.byCampaignId, campaignId, () => ({ layoutId })) })),

      toggleLock: (campaignId) =>
        set((state) => ({ byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({ locked: !c.locked })) })),

      setPaneSizes: (campaignId, key, sizes) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({ paneSizes: { ...c.paneSizes, [key]: sizes } })),
        })),

      resetLayout: (campaignId) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => {
            const prefix = `${c.layoutId}:`;
            return {
              paneSizes: Object.fromEntries(Object.entries(c.paneSizes).filter(([k]) => !k.startsWith(prefix))),
              collapsedPanes: {},
              dismissedPanes: { ...c.dismissedPanes, [c.layoutId]: {} },
              windowAssignment: { ...c.windowAssignment, [c.layoutId]: defaultWindowAssignment()[c.layoutId] },
            };
          }),
        })),

      toggleCollapsed: (campaignId, slot) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            collapsedPanes: { ...c.collapsedPanes, [slot]: !c.collapsedPanes[slot] },
          })),
        })),

      setWindowKind: (campaignId, layoutId, slot, kind) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            windowAssignment: { ...c.windowAssignment, [layoutId]: { ...c.windowAssignment[layoutId], [slot]: kind } },
            // Putting real content back into a pane must also un-dismiss and un-collapse it,
            // otherwise the assignment lands somewhere invisible.
            dismissedPanes: { ...c.dismissedPanes, [layoutId]: { ...c.dismissedPanes[layoutId], [slot]: false } },
            collapsedPanes: { ...c.collapsedPanes, [slot]: false },
          })),
        })),

      closePane: (campaignId, layoutId, slot) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            windowAssignment: { ...c.windowAssignment, [layoutId]: { ...c.windowAssignment[layoutId], [slot]: 'empty' } },
            collapsedPanes: { ...c.collapsedPanes, [slot]: false },
          })),
        })),

      dismissPane: (campaignId, layoutId, slot) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            windowAssignment: { ...c.windowAssignment, [layoutId]: { ...c.windowAssignment[layoutId], [slot]: 'empty' } },
            dismissedPanes: { ...c.dismissedPanes, [layoutId]: { ...c.dismissedPanes[layoutId], [slot]: true } },
          })),
        })),

      restoreDismissedPanes: (campaignId, layoutId) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            dismissedPanes: { ...c.dismissedPanes, [layoutId]: {} },
          })),
        })),

      swapPanes: (campaignId, layoutId, a, b) =>
        set((state) => {
          if (a === b) return state;
          return {
            byCampaignId: patch(state.byCampaignId, campaignId, (c) => {
              const assignment = c.windowAssignment[layoutId] ?? {};
              const dismissed = c.dismissedPanes[layoutId] ?? {};
              return {
                windowAssignment: {
                  ...c.windowAssignment,
                  [layoutId]: { ...assignment, [a]: assignment[b] ?? 'empty', [b]: assignment[a] ?? 'empty' },
                },
                dismissedPanes: {
                  ...c.dismissedPanes,
                  [layoutId]: { ...dismissed, [a]: !!dismissed[b], [b]: !!dismissed[a] },
                },
                collapsedPanes: { ...c.collapsedPanes, [a]: !!c.collapsedPanes[b], [b]: !!c.collapsedPanes[a] },
              };
            }),
          };
        }),

      ensureItemsPane: (campaignId, layoutId, slots) => {
        const current = resolve(get().byCampaignId, campaignId);
        const assignment = current.windowAssignment[layoutId] ?? {};
        const dismissed = current.dismissedPanes[layoutId] ?? {};
        const live = slots.filter((slot) => !dismissed[slot]);
        const existing = live.find((slot) => assignment[slot] === 'items');
        if (existing) {
          if (current.collapsedPanes[existing]) {
            set((state) => ({
              byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
                collapsedPanes: { ...c.collapsedPanes, [existing]: false },
              })),
            }));
          }
          return existing;
        }
        // Prefer a slot the DM has already emptied - claiming it costs them nothing - then a
        // chat pane, then anything that isn't the session note they are reading from.
        const target =
          live.find((slot) => (assignment[slot] ?? 'empty') === 'empty') ??
          live.find((slot) => assignment[slot] === 'chat') ??
          live.find((slot) => assignment[slot] !== 'session') ??
          live[live.length - 1] ??
          slots[slots.length - 1];
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            windowAssignment: { ...c.windowAssignment, [layoutId]: { ...c.windowAssignment[layoutId], [target]: 'items' } },
            collapsedPanes: { ...c.collapsedPanes, [target]: false },
            dismissedPanes: { ...c.dismissedPanes, [layoutId]: { ...c.dismissedPanes[layoutId], [target]: false } },
          })),
        }));
        return target;
      },
    }),
    { name: 'worldwatcher-play-layout' },
  ),
);

export function getPlayLayoutState(
  byCampaignId: Record<string, CampaignLayoutState>,
  campaignId: string | undefined,
): CampaignLayoutState {
  if (!campaignId) return defaultCampaignState();
  return resolve(byCampaignId, campaignId);
}
