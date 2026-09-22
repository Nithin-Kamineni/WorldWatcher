/** The Play workspace's 6 window layouts (issues.txt point 10.3), each a row/column split tree
 * over pane slots, plus the helpers that let a DM edit one.
 *
 * The six are PRESETS: STARTING POINTS, NOT THE ONLY REACHABLE SHAPES (checklist I-P1). Picking
 * one seeds a per-campaign editable tree (usePlayLayoutStore.customTrees); splitting a pane
 * edits that tree, and "Reset this layout" throws the edits away and returns to the preset. So
 * `layoutId` still means "which preset am I working from", and a DM who wants "three panes, the
 * middle one narrow and split top/bottom" can now build it.
 *
 * Sizes live in usePlayLayoutStore.paneSizes, keyed `${layoutId}:${splitNode.path}`.
 * SplitPane.tsx is the one generic renderer for every tree, preset or edited. */

/** Eight slots, not four: splitting adds panes, and every piece of Play state is keyed by slot
 * (window assignment, Items tab sets, collapsed/dismissed flags). A bounded union keeps those
 * Record types exhaustive and type-checked where a bare `string` would not; eight is well past
 * the point where another pane on one screen stops being useful. */
export type PaneSlot = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7' | 'p8';

export const ALL_PANE_SLOTS: PaneSlot[] = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];

/** A surface that can host one Items window's state (usePlayItemsStore).
 * The four Play pane slots, plus 'map' - the Reference section of the map page's sidebar,
 * which shows the same Items window but is not part of any layout tree, so it can never be
 * dragged, swapped or closed. Keeping it in the same keyspace is what lets a map token open
 * straight into the Stats sub-window (checklist E13). */
export type ItemsSurface = PaneSlot | 'map';

export type SplitDirection = 'row' | 'column';

export interface LeafNode {
  type: 'leaf';
  slot: PaneSlot;
}

export interface SplitNode {
  type: 'split';
  direction: SplitDirection;
  /** Key into usePlayLayoutStore's paneSizes, scoped by layout id. In the presets it reads
   * positionally (root is '', its second child's split is '1'), but it is really just a stable
   * unique id - a split created by the DM gets a generated one and NOTHING is ever renumbered.
   * That is deliberate: renumbering on every edit would silently reattach remembered pane sizes
   * to different splits, so a DM who split one pane would find another one resizing itself. */
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

/** Which side of the target pane the new one lands on. */
export type SplitSide = 'left' | 'right' | 'up' | 'down';

/** Every slot a tree currently uses, in layout order. */
export function visibleSlotsOf(node: LayoutNode): PaneSlot[] {
  if (node.type === 'leaf') return [node.slot];
  return node.children.flatMap(visibleSlotsOf);
}

/** The lowest-numbered slot the tree is not already using, or null when all eight are taken. */
export function nextFreeSlot(node: LayoutNode): PaneSlot | null {
  const used = new Set(visibleSlotsOf(node));
  return ALL_PANE_SLOTS.find((slot) => !used.has(slot)) ?? null;
}

function clone(node: LayoutNode): LayoutNode {
  return node.type === 'leaf'
    ? { type: 'leaf', slot: node.slot }
    : { type: 'split', direction: node.direction, path: node.path, children: node.children.map(clone) };
}

/** A detached copy of a preset, ready to be edited without mutating the constant. */
export function cloneTree(node: LayoutNode): LayoutNode {
  return clone(node);
}

/** Splits the pane holding `slot`, putting `newSlot` on the given side of it.
 *
 * When the target's parent already runs along the requested axis, the new leaf is inserted as a
 * SIBLING rather than wrapped in a nested split - three panes in a row stay one row of three
 * instead of becoming a row containing a row, which is both what the DM sees and what keeps the
 * divider between every adjacent pair draggable. */
export function splitLeaf(root: LayoutNode, slot: PaneSlot, newSlot: PaneSlot, side: SplitSide): LayoutNode {
  const direction: SplitDirection = side === 'left' || side === 'right' ? 'row' : 'column';
  const before = side === 'left' || side === 'up';
  const newLeaf: LeafNode = { type: 'leaf', slot: newSlot };

  const rewrite = (node: LayoutNode, parentDirection: SplitDirection | null): LayoutNode => {
    if (node.type === 'leaf') {
      if (node.slot !== slot) return node;
      if (parentDirection === direction) return node; // handled by the parent below
      return {
        type: 'split',
        direction,
        path: `s${crypto.randomUUID().slice(0, 8)}`,
        children: before ? [newLeaf, node] : [node, newLeaf],
      };
    }
    const index = node.children.findIndex((child) => child.type === 'leaf' && child.slot === slot);
    if (index >= 0 && node.direction === direction) {
      const children = [...node.children];
      children.splice(before ? index : index + 1, 0, newLeaf);
      return { ...node, children };
    }
    return { ...node, children: node.children.map((child) => rewrite(child, node.direction)) };
  };

  return rewrite(cloneTree(root), null);
}

/** Removes a leaf, collapsing any split left with a single child so the tree never grows
 * pointless one-child wrappers. Returns null if the tree would be emptied. */
export function removeLeaf(root: LayoutNode, slot: PaneSlot): LayoutNode | null {
  const prune = (node: LayoutNode): LayoutNode | null => {
    if (node.type === 'leaf') return node.slot === slot ? null : node;
    const children = node.children.map(prune).filter((child): child is LayoutNode => child !== null);
    if (children.length === 0) return null;
    if (children.length === 1) return children[0];
    return { ...node, children };
  };
  return prune(cloneTree(root));
}
