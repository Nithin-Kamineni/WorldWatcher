import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PaneSlot, PlayLayoutId } from '../components/play/layout/playLayoutTrees';

export type PlayWindowKind = 'session' | 'chat' | 'items';

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

function defaultCampaignState(): CampaignLayoutState {
  return {
    layoutId: 'double-row',
    locked: false,
    paneSizes: {},
    collapsedPanes: {},
    windowAssignment: defaultWindowAssignment(),
  };
}

function resolve(byCampaignId: Record<string, CampaignLayoutState>, campaignId: string): CampaignLayoutState {
  return byCampaignId[campaignId] ?? defaultCampaignState();
}

interface PlayLayoutStoreState {
  byCampaignId: Record<string, CampaignLayoutState>;
  setLayout: (campaignId: string, layoutId: PlayLayoutId) => void;
  toggleLock: (campaignId: string) => void;
  setPaneSizes: (campaignId: string, key: string, sizes: number[]) => void;
  /** Clears remembered pane sizes for the current layout - dividers snap back to even splits. */
  resetLayout: (campaignId: string) => void;
  toggleCollapsed: (campaignId: string, slot: PaneSlot) => void;
  setWindowKind: (campaignId: string, layoutId: PlayLayoutId, slot: PaneSlot, kind: PlayWindowKind) => void;
  /** Finds an Items-window pane in the current layout, converting/uncollapsing one if none is
   * currently visible, and returns its slot - used so an @-mention click always has somewhere
   * to open into (see EntityRefPreview). */
  ensureItemsPane: (campaignId: string, layoutId: PlayLayoutId, slots: PaneSlot[]) => PaneSlot;
}

export const usePlayLayoutStore = create<PlayLayoutStoreState>()(
  persist(
    (set, get) => ({
      byCampaignId: {},

      setLayout: (campaignId, layoutId) =>
        set((state) => ({
          byCampaignId: { ...state.byCampaignId, [campaignId]: { ...resolve(state.byCampaignId, campaignId), layoutId } },
        })),

      toggleLock: (campaignId) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          return { byCampaignId: { ...state.byCampaignId, [campaignId]: { ...current, locked: !current.locked } } };
        }),

      setPaneSizes: (campaignId, key, sizes) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          return {
            byCampaignId: {
              ...state.byCampaignId,
              [campaignId]: { ...current, paneSizes: { ...current.paneSizes, [key]: sizes } },
            },
          };
        }),

      resetLayout: (campaignId) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          const prefix = `${current.layoutId}:`;
          const paneSizes = Object.fromEntries(Object.entries(current.paneSizes).filter(([k]) => !k.startsWith(prefix)));
          return { byCampaignId: { ...state.byCampaignId, [campaignId]: { ...current, paneSizes } } };
        }),

      toggleCollapsed: (campaignId, slot) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          return {
            byCampaignId: {
              ...state.byCampaignId,
              [campaignId]: { ...current, collapsedPanes: { ...current.collapsedPanes, [slot]: !current.collapsedPanes[slot] } },
            },
          };
        }),

      setWindowKind: (campaignId, layoutId, slot, kind) =>
        set((state) => {
          const current = resolve(state.byCampaignId, campaignId);
          return {
            byCampaignId: {
              ...state.byCampaignId,
              [campaignId]: {
                ...current,
                windowAssignment: {
                  ...current.windowAssignment,
                  [layoutId]: { ...current.windowAssignment[layoutId], [slot]: kind },
                },
              },
            },
          };
        }),

      ensureItemsPane: (campaignId, layoutId, slots) => {
        const current = resolve(get().byCampaignId, campaignId);
        const assignment = current.windowAssignment[layoutId] ?? {};
        const existing = slots.find((slot) => assignment[slot] === 'items');
        if (existing) {
          if (current.collapsedPanes[existing]) {
            set((state) => {
              const c = resolve(state.byCampaignId, campaignId);
              return {
                byCampaignId: {
                  ...state.byCampaignId,
                  [campaignId]: { ...c, collapsedPanes: { ...c.collapsedPanes, [existing]: false } },
                },
              };
            });
          }
          return existing;
        }
        const target =
          slots.find((slot) => assignment[slot] === 'chat') ??
          slots.find((slot) => assignment[slot] !== 'session') ??
          slots[slots.length - 1];
        set((state) => {
          const c = resolve(state.byCampaignId, campaignId);
          return {
            byCampaignId: {
              ...state.byCampaignId,
              [campaignId]: {
                ...c,
                windowAssignment: { ...c.windowAssignment, [layoutId]: { ...c.windowAssignment[layoutId], [target]: 'items' } },
                collapsedPanes: { ...c.collapsedPanes, [target]: false },
              },
            },
          };
        });
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
