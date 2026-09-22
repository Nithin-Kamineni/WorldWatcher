import { TREE_GAP, TREE_NODE_SIZE, type TreeCanvas, type TreeNodeItem } from '../../../types/noteCanvas';

export interface LaidOutNode {
  node: TreeNodeItem;
  x: number;
  y: number;
  depth: number;
  /** How many descendants a collapsed node is hiding - shown as the badge on its chip. */
  hidden: number;
  /** Direct children, ignoring collapse - drives the expand/collapse control's visibility. */
  childCount: number;
}

export interface TreeLayout {
  nodes: LaidOutNode[];
  byId: Map<string, LaidOutNode>;
  /** Parent-child pairs that are actually on screen (a collapsed branch draws no edges). */
  edges: { parent: LaidOutNode; child: LaidOutNode }[];
}

/** Classic tidy-tree pass: lay the leaves out left to right in order, then centre every
 * parent over the span of its children. Linear in node count and stable - the same document
 * always draws the same shape - which matters more here than the extra tightness a full
 * Reingold-Tilford contour pass would buy on deep lopsided trees.
 *
 * A node the user has dragged carries its own x/y and is placed there instead; everything
 * else still flows automatically around it, and "Auto arrange" clears the overrides. A
 * collapsed node is laid out as a leaf, so hiding a branch really does reclaim its space. */
export function layoutTree(doc: TreeCanvas): TreeLayout {
  const childrenOf = new Map<string | null, TreeNodeItem[]>();
  for (const node of doc.nodes) {
    const key = node.parentId;
    const list = childrenOf.get(key);
    if (list) list.push(node);
    else childrenOf.set(key, [node]);
  }

  const vertical = doc.orientation === 'vertical';
  const crossStep = (vertical ? TREE_NODE_SIZE.width : TREE_NODE_SIZE.height) + TREE_GAP.sibling;
  const depthStep = (vertical ? TREE_NODE_SIZE.height : TREE_NODE_SIZE.width) + TREE_GAP.level;

  const placed = new Map<string, { cross: number; depth: number; level: number }>();
  let cursor = 0;

  const walk = (node: TreeNodeItem, level: number): number => {
    const kids = node.collapsed ? [] : childrenOf.get(node.id) ?? [];
    let cross: number;
    if (kids.length === 0) {
      cross = cursor;
      cursor += crossStep;
    } else {
      const spans = kids.map((kid) => walk(kid, level + 1));
      cross = (spans[0] + spans[spans.length - 1]) / 2;
    }
    placed.set(node.id, { cross, depth: level * depthStep, level });
    return cross;
  };

  for (const root of childrenOf.get(null) ?? []) {
    walk(root, 0);
    // Breathing room between one root's subtree and the next, so two bloodlines or two
    // research branches read as two trees rather than one wide one.
    cursor += crossStep * 0.6;
  }

  const countDescendants = (id: string): number => {
    const kids = childrenOf.get(id) ?? [];
    return kids.reduce((total, kid) => total + 1 + countDescendants(kid.id), 0);
  };

  // Only what the walk reached: a node inside a collapsed branch was never placed, and a
  // laid-out node is a DRAWN node - handing one back with no position renders the whole
  // hidden branch stacked on the origin instead of hiding it.
  const nodes: LaidOutNode[] = doc.nodes
    .filter((node) => placed.has(node.id))
    .map((node) => {
      const slot = placed.get(node.id)!;
      const auto = vertical ? { x: slot.cross, y: slot.depth } : { x: slot.depth, y: slot.cross };
      const childCount = (childrenOf.get(node.id) ?? []).length;
      return {
        node,
        x: node.x ?? auto.x,
        y: node.y ?? auto.y,
        depth: slot.level,
        hidden: node.collapsed ? countDescendants(node.id) : 0,
        childCount,
      };
    });

  const byId = new Map(nodes.map((n) => [n.node.id, n]));
  const edges: { parent: LaidOutNode; child: LaidOutNode }[] = [];
  for (const laid of nodes) {
    const parentId = laid.node.parentId;
    if (!parentId) continue;
    const parent = byId.get(parentId);
    // A collapsed parent hides the whole branch below it, edges included.
    if (!parent || parent.node.collapsed) continue;
    edges.push({ parent, child: laid });
  }

  return { nodes, byId, edges };
}

/** Elbow path from a parent to a child: out of the parent's near edge, across at the halfway
 * line, into the child's far edge. Reads as a family/tech tree in a way a straight diagonal
 * does not. */
export function edgePath(parent: LaidOutNode, child: LaidOutNode, vertical: boolean): string {
  const { width, height } = TREE_NODE_SIZE;
  if (vertical) {
    const x1 = parent.x + width / 2;
    const y1 = parent.y + height;
    const x2 = child.x + width / 2;
    const y2 = child.y;
    const mid = y1 + (y2 - y1) / 2;
    return `M ${x1} ${y1} L ${x1} ${mid} L ${x2} ${mid} L ${x2} ${y2}`;
  }
  const x1 = parent.x + width;
  const y1 = parent.y + height / 2;
  const x2 = child.x;
  const y2 = child.y + height / 2;
  const mid = x1 + (x2 - x1) / 2;
  return `M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`;
}

/** Every descendant of a node, so dragging a branch carries it and deleting one can offer to
 * take it with them. */
export function descendantIds(doc: TreeCanvas, id: string): string[] {
  const direct = doc.nodes.filter((n) => n.parentId === id).map((n) => n.id);
  return direct.flatMap((childId) => [childId, ...descendantIds(doc, childId)]);
}
