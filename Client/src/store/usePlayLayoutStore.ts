import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  PLAY_LAYOUTS,
  nextFreeSlot,
  removeLeaf,
  splitLeaf,
  visibleSlotsOf,
  type LayoutNode,
  type PaneSlot,
  type PlayLayoutId,
  type SplitSide,
} from '../components/play/layout/playLayoutTrees';

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
  /** Per layout, which pane slots are collapsed to a thin strip.
   *
   * PER LAYOUT is the fix, not a detail. This used to be one flat per-CAMPAIGN map, which was
   * survivable only while collapse was chat-only (checklist I-P11): a flag left on a slot that
   * was not a chat pane in the current layout was simply ignored. Once every window kind
   * honoured it, that same stale flag started collapsing real panes in layouts the DM had
   * never collapsed anything in - and two of them at once turned a two-pane workspace into two
   * 44px strips with no content, i.e. a Play page that looks blank. It is keyed like
   * windowAssignment and dismissedPanes now, which is what it should always have been. */
  collapsedPanes: Record<PlayLayoutId, Partial<Record<PaneSlot, boolean>>>;
  /** Which window kind each pane slot shows, per layout - lets switching layouts remember a
   * different arrangement per layout rather than one global assignment. */
  windowAssignment: Record<PlayLayoutId, Partial<Record<PaneSlot, PlayWindowKind>>>;
  /** Per layout, the slots whose space has been handed back to their neighbours. SplitPane
   * prunes these out of the tree entirely, so dismissing one of two side-by-side panes really
   * does turn a two-window layout into a single-window one without changing layoutId. */
  dismissedPanes: Record<PlayLayoutId, Partial<Record<PaneSlot, boolean>>>;
  /** Per layout, what each slot held the last time it was closed or dismissed. Closing used to
   * throw the window kind away, so "bring closed windows back" handed back the SPACE and left
   * the DM to pick the kind again (checklist P4). Remembering it lets the placeholder offer a
   * one-click reopen and lets restore put the arrangement back as it was. */
  lastKindBySlot: Record<PlayLayoutId, Partial<Record<PaneSlot, ContentWindowKindName>>>;
  /** Per preset, the DM's edited version of its tree - absent until they split something.
   *
   * This is what makes the six layouts STARTING POINTS rather than the only reachable shapes
   * (checklist I-P1). Picking a preset clears its entry (start again from the preset); splitting
   * a pane seeds it from the preset and edits the copy; "Reset this layout" throws it away. */
  customTrees: Partial<Record<PlayLayoutId, LayoutNode>>;
}

/** A window kind that can actually be restored - `empty` is the absence of one. */
type ContentWindowKindName = Exclude<PlayWindowKind, 'empty'>;

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

/** True for the per-layout shape, false for the legacy flat {slot: boolean} one. */
function isPerLayoutCollapsed(value: unknown): value is Record<PlayLayoutId, Partial<Record<PaneSlot, boolean>>> {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every((entry) => entry !== null && typeof entry === 'object');
}

function emptyPerLayout(): Record<PlayLayoutId, Partial<Record<PaneSlot, boolean>>> {
  return { single: {}, 'double-row': {}, 'double-col': {}, 'triple-even': {}, 'triple-half': {}, quad: {} };
}

function defaultCampaignState(): CampaignLayoutState {
  return {
    layoutId: 'double-row',
    locked: false,
    paneSizes: {},
    collapsedPanes: emptyPerLayout(),
    windowAssignment: defaultWindowAssignment(),
    dismissedPanes: emptyPerLayout(),
    lastKindBySlot: emptyPerLayout() as CampaignLayoutState['lastKindBySlot'],
    customTrees: {},
  };
}

/** The tree actually rendered for a layout: the DM's edited one when there is one, else the
 * preset. The single place that decision is made. */
export function getLayoutTree(state: CampaignLayoutState, layoutId: PlayLayoutId): LayoutNode {
  return state.customTrees[layoutId] ?? PLAY_LAYOUTS[layoutId].root;
}

/** Every slot the layout currently shows, edited shape included - what `slots` on the preset
 * used to answer before trees became editable. */
export function getLayoutSlots(state: CampaignLayoutState, layoutId: PlayLayoutId): PaneSlot[] {
  return visibleSlotsOf(getLayoutTree(state, layoutId));
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
    // A record persisted before collapsedPanes became per-layout is a flat {slot: boolean}
    // map. Its values are booleans rather than objects, which is how it is recognised - and it
    // is DISCARDED rather than migrated: a stale collapse flag is exactly what caused the
    // blank-workspace bug, and "nothing is collapsed" is both safe and what the DM expects
    // when they next open Play.
    collapsedPanes: isPerLayoutCollapsed(stored.collapsedPanes)
      ? { ...emptyPerLayout(), ...stored.collapsedPanes }
      : emptyPerLayout(),
    dismissedPanes: { ...emptyPerLayout(), ...stored.dismissedPanes },
    lastKindBySlot: {
      ...(emptyPerLayout() as CampaignLayoutState['lastKindBySlot']),
      ...stored.lastKindBySlot,
    },
    customTrees: stored.customTrees ?? {},
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
  toggleCollapsed: (campaignId: string, layoutId: PlayLayoutId, slot: PaneSlot) => void;
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
  /** Splits `slot`, putting a new empty pane on the given side of it, and returns the new
   * slot (or null when all eight are in use). Seeds the editable tree from the preset on the
   * first split (checklist I-P1). */
  splitPane: (campaignId: string, layoutId: PlayLayoutId, slot: PaneSlot, side: SplitSide) => PaneSlot | null;
  /** Takes a pane out of the edited tree entirely, rather than leaving an empty placeholder -
   * what "give this space back" means once the tree is the DM's own. */
  removePane: (campaignId: string, layoutId: PlayLayoutId, slot: PaneSlot) => void;
  /** Finds a pane of `kind` in the current layout, converting/uncollapsing one if none is
   * currently visible, and returns its slot. Used so an @-mention click always has an Items
   * window to open into (see EntityRefPreview), and so opening a DM-notes thread from the
   * Notes folder always lands in a real Chat window (see NotesFolderExplorer). */
  ensurePaneOfKind: (campaignId: string, layoutId: PlayLayoutId, slots: PaneSlot[], kind: Exclude<PlayWindowKind, 'empty'>) => PaneSlot;
  /** ensurePaneOfKind(..., 'items'). Kept as its own name because it is what every caller
   * around @-mentions reads as. */
  ensureItemsPane: (campaignId: string, layoutId: PlayLayoutId, slots: PaneSlot[]) => PaneSlot;
}

/** Records what `slot` is showing before it is emptied, so the placeholder can offer to put it
 * back. An already-empty slot keeps whatever it remembered from the first close. */
function rememberKind(
  c: CampaignLayoutState,
  layoutId: PlayLayoutId,
  slot: PaneSlot,
): CampaignLayoutState['lastKindBySlot'] {
  const current = c.windowAssignment[layoutId]?.[slot];
  if (!current || current === 'empty') return c.lastKindBySlot;
  return { ...c.lastKindBySlot, [layoutId]: { ...c.lastKindBySlot[layoutId], [slot]: current } };
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

      // Picking a preset is picking a STARTING POINT: it drops whatever tree was edited from
      // it, so the toolbar button always gives you the shape on its icon (checklist I-P1).
      setLayout: (campaignId, layoutId) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            layoutId,
            customTrees: { ...c.customTrees, [layoutId]: undefined },
          })),
        })),

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
              collapsedPanes: { ...c.collapsedPanes, [c.layoutId]: {} },
              dismissedPanes: { ...c.dismissedPanes, [c.layoutId]: {} },
              windowAssignment: { ...c.windowAssignment, [c.layoutId]: defaultWindowAssignment()[c.layoutId] },
              lastKindBySlot: { ...c.lastKindBySlot, [c.layoutId]: {} },
              // "Put it back how it was" has to include the SHAPE now that the DM can change
              // it, or Reset would leave their splits in place and only undo the sizes.
              customTrees: { ...c.customTrees, [c.layoutId]: undefined },
            };
          }),
        })),

      toggleCollapsed: (campaignId, layoutId, slot) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            collapsedPanes: { ...c.collapsedPanes, [layoutId]: { ...c.collapsedPanes[layoutId], [slot]: !c.collapsedPanes[layoutId]?.[slot] } },
          })),
        })),

      setWindowKind: (campaignId, layoutId, slot, kind) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            windowAssignment: { ...c.windowAssignment, [layoutId]: { ...c.windowAssignment[layoutId], [slot]: kind } },
            // Putting real content back into a pane must also un-dismiss and un-collapse it,
            // otherwise the assignment lands somewhere invisible.
            dismissedPanes: { ...c.dismissedPanes, [layoutId]: { ...c.dismissedPanes[layoutId], [slot]: false } },
            collapsedPanes: { ...c.collapsedPanes, [layoutId]: { ...c.collapsedPanes[layoutId], [slot]: false } },
            // The slot is filled again, so there is nothing left to reopen.
            lastKindBySlot: { ...c.lastKindBySlot, [layoutId]: { ...c.lastKindBySlot[layoutId], [slot]: undefined } },
          })),
        })),

      closePane: (campaignId, layoutId, slot) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            windowAssignment: { ...c.windowAssignment, [layoutId]: { ...c.windowAssignment[layoutId], [slot]: 'empty' } },
            collapsedPanes: { ...c.collapsedPanes, [layoutId]: { ...c.collapsedPanes[layoutId], [slot]: false } },
            lastKindBySlot: rememberKind(c, layoutId, slot),
          })),
        })),

      dismissPane: (campaignId, layoutId, slot) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            windowAssignment: { ...c.windowAssignment, [layoutId]: { ...c.windowAssignment[layoutId], [slot]: 'empty' } },
            dismissedPanes: { ...c.dismissedPanes, [layoutId]: { ...c.dismissedPanes[layoutId], [slot]: true } },
            lastKindBySlot: rememberKind(c, layoutId, slot),
          })),
        })),

      splitPane: (campaignId, layoutId, slot, side) => {
        const current = resolve(get().byCampaignId, campaignId);
        const tree = getLayoutTree(current, layoutId);
        const newSlot = nextFreeSlot(tree);
        if (!newSlot) return null;
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            customTrees: { ...c.customTrees, [layoutId]: splitLeaf(getLayoutTree(c, layoutId), slot, newSlot, side) },
            // The new pane starts empty rather than guessing a kind - the placeholder already
            // asks "what goes here", which is the established way a pane gets filled (P4).
            windowAssignment: { ...c.windowAssignment, [layoutId]: { ...c.windowAssignment[layoutId], [newSlot]: 'empty' } },
            // A split slot could be carrying stale flags from an earlier life in this layout.
            dismissedPanes: { ...c.dismissedPanes, [layoutId]: { ...c.dismissedPanes[layoutId], [newSlot]: false } },
            collapsedPanes: { ...c.collapsedPanes, [layoutId]: { ...c.collapsedPanes[layoutId], [newSlot]: false } },
          })),
        }));
        return newSlot;
      },

      removePane: (campaignId, layoutId, slot) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => {
            const pruned = removeLeaf(getLayoutTree(c, layoutId), slot);
            // Refuse to empty the workspace: the last pane has nowhere to hand its space to.
            if (!pruned) return {};
            return {
              customTrees: { ...c.customTrees, [layoutId]: pruned },
              lastKindBySlot: rememberKind(c, layoutId, slot),
            };
          }),
        })),

      restoreDismissedPanes: (campaignId, layoutId) =>
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => {
            // Put back the window each restored slot was holding, not just its space (P4).
            const remembered = c.lastKindBySlot[layoutId] ?? {};
            const assignment = { ...c.windowAssignment[layoutId] };
            const stillRemembered = { ...remembered };
            for (const slot of Object.keys(c.dismissedPanes[layoutId] ?? {}) as PaneSlot[]) {
              if (!c.dismissedPanes[layoutId]?.[slot]) continue;
              const kind = remembered[slot];
              if (kind) {
                assignment[slot] = kind;
                delete stillRemembered[slot];
              }
            }
            return {
              dismissedPanes: { ...c.dismissedPanes, [layoutId]: {} },
              windowAssignment: { ...c.windowAssignment, [layoutId]: assignment },
              lastKindBySlot: { ...c.lastKindBySlot, [layoutId]: stillRemembered },
            };
          }),
        })),

      swapPanes: (campaignId, layoutId, a, b) =>
        set((state) => {
          if (a === b) return state;
          return {
            byCampaignId: patch(state.byCampaignId, campaignId, (c) => {
              const assignment = c.windowAssignment[layoutId] ?? {};
              const dismissed = c.dismissedPanes[layoutId] ?? {};
              const remembered = c.lastKindBySlot[layoutId] ?? {};
              return {
                windowAssignment: {
                  ...c.windowAssignment,
                  [layoutId]: { ...assignment, [a]: assignment[b] ?? 'empty', [b]: assignment[a] ?? 'empty' },
                },
                dismissedPanes: {
                  ...c.dismissedPanes,
                  [layoutId]: { ...dismissed, [a]: !!dismissed[b], [b]: !!dismissed[a] },
                },
                collapsedPanes: {
                  ...c.collapsedPanes,
                  [layoutId]: {
                    ...c.collapsedPanes[layoutId],
                    [a]: !!c.collapsedPanes[layoutId]?.[b],
                    [b]: !!c.collapsedPanes[layoutId]?.[a],
                  },
                },
                lastKindBySlot: {
                  ...c.lastKindBySlot,
                  [layoutId]: { ...remembered, [a]: remembered[b], [b]: remembered[a] },
                },
              };
            }),
          };
        }),

      ensurePaneOfKind: (campaignId, layoutId, slots, kind) => {
        const current = resolve(get().byCampaignId, campaignId);
        const assignment = current.windowAssignment[layoutId] ?? {};
        const dismissed = current.dismissedPanes[layoutId] ?? {};
        const live = slots.filter((slot) => !dismissed[slot]);
        const existing = live.find((slot) => assignment[slot] === kind);
        if (existing) {
          if (current.collapsedPanes[layoutId]?.[existing]) {
            set((state) => ({
              byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
                collapsedPanes: { ...c.collapsedPanes, [layoutId]: { ...c.collapsedPanes[layoutId], [existing]: false } },
              })),
            }));
          }
          return existing;
        }
        // Prefer a slot the DM has already emptied - claiming it costs them nothing - then
        // anything that isn't the session note they are reading from, so opening a window
        // never evicts the notes the whole screen is anchored to.
        const target =
          live.find((slot) => (assignment[slot] ?? 'empty') === 'empty') ??
          live.find((slot) => assignment[slot] !== 'session' && assignment[slot] !== kind) ??
          live.find((slot) => assignment[slot] !== 'session') ??
          live[live.length - 1] ??
          slots[slots.length - 1];
        set((state) => ({
          byCampaignId: patch(state.byCampaignId, campaignId, (c) => ({
            windowAssignment: { ...c.windowAssignment, [layoutId]: { ...c.windowAssignment[layoutId], [target]: kind } },
            collapsedPanes: { ...c.collapsedPanes, [layoutId]: { ...c.collapsedPanes[layoutId], [target]: false } },
            dismissedPanes: { ...c.dismissedPanes, [layoutId]: { ...c.dismissedPanes[layoutId], [target]: false } },
          })),
        }));
        return target;
      },

      ensureItemsPane: (campaignId, layoutId, slots) => get().ensurePaneOfKind(campaignId, layoutId, slots, 'items'),
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
