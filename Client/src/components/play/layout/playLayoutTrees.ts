/** Static definitions for the Play workspace's 6 window layouts (issues.txt point 10.3) - each
 * a fixed row/column split tree over up to 4 pane slots ('p1'-'p4'). The tree *shape* never
 * changes at runtime, only the sizes (see usePlayLayoutStore.paneSizes, keyed by `${layoutId}:
 * ${splitNode.path}`) and which window kind (session/chat/items) each slot shows. SplitPane.tsx
 * is the one generic renderer for all 6 trees. */

export type PaneSlot = 'p1' | 'p2' | 'p3' | 'p4';
export type SplitDirection = 'row' | 'column';

export interface LeafNode {
  type: 'leaf';
  slot: PaneSlot;
}

export interface SplitNode {
  type: 'split';
  direction: SplitDirection;
  /** Key into usePlayLayoutStore's paneSizes, scoped by layout id - root split's path is '',
   * a nested split's path is its parent's path + its own child index (e.g. '1' for the second
   * child of the root). */
  path: string;
  children: LayoutNode[];
}

export type LayoutNode = LeafNode | SplitNode;

export type PlayLayoutId = 'single' | 'double-row' | 'double-col' | 'triple-even' | 'triple-half' | 'quad';

export interface PlayLayoutDef {
  id: PlayLayoutId;
  label: string;
  root: LayoutNode;
  /** Every pane slot present in this layout, left-to-right/top-to-bottom - drives default
   * window-kind assignment and the window-type-switcher menu. */
  slots: PaneSlot[];
}

function leaf(slot: PaneSlot): LeafNode {
  return { type: 'leaf', slot };
}

export const PLAY_LAYOUTS: Record<PlayLayoutId, PlayLayoutDef> = {
  single: {
    id: 'single',
    label: 'Single window',
    root: leaf('p1'),
    slots: ['p1'],
  },
  'double-row': {
    id: 'double-row',
    label: 'Two windows, side by side',
    root: { type: 'split', direction: 'row', path: '', children: [leaf('p1'), leaf('p2')] },
    slots: ['p1', 'p2'],
  },
  'double-col': {
    id: 'double-col',
    label: 'Two windows, stacked',
    root: { type: 'split', direction: 'column', path: '', children: [leaf('p1'), leaf('p2')] },
    slots: ['p1', 'p2'],
  },
  'triple-even': {
    id: 'triple-even',
    label: 'Three windows, evenly split',
    root: { type: 'split', direction: 'row', path: '', children: [leaf('p1'), leaf('p2'), leaf('p3')] },
    slots: ['p1', 'p2', 'p3'],
  },
  'triple-half': {
    id: 'triple-half',
    label: 'Three windows, one half + two quarters',
    root: {
      type: 'split',
      direction: 'row',
      path: '',
      children: [leaf('p1'), { type: 'split', direction: 'column', path: '1', children: [leaf('p2'), leaf('p3')] }],
    },
    slots: ['p1', 'p2', 'p3'],
  },
  quad: {
    id: 'quad',
    label: 'Four windows, one per corner',
    root: {
      type: 'split',
      direction: 'row',
      path: '',
      children: [
        { type: 'split', direction: 'column', path: '0', children: [leaf('p1'), leaf('p2')] },
        { type: 'split', direction: 'column', path: '1', children: [leaf('p3'), leaf('p4')] },
      ],
    },
    slots: ['p1', 'p2', 'p3', 'p4'],
  },
};

/** The default and next-most-complete common setup - shown directly on the toolbar; every
 * other layout lives in the "More layouts" popover. */
export const QUICK_LAYOUT_IDS: PlayLayoutId[] = ['double-row', 'triple-even'];

export const ALL_LAYOUT_IDS: PlayLayoutId[] = ['single', 'double-row', 'double-col', 'triple-even', 'triple-half', 'quad'];
