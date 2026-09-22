/** The three kinds of file a Notes folder can hold. 'text' is the original note (an HTML body
 * edited with TipTap); the other two are free-form canvases whose whole content lives in the
 * note's `canvas` JSONB instead of its `body`:
 *
 *   - 'whiteboard' - a pinboard of draggable sticky notes, labels and frames, optionally
 *     joined by arrows. For thinking out loud: session brainstorms, clue boards, "who knows
 *     what" webs.
 *   - 'tree'       - a node graph with one parent per node (plus free extra links), drawn by
 *     an automatic tidy-tree layout. For tech trees, family trees, faction hierarchies,
 *     succession lines.
 *
 * Both canvases are persisted as one JSON document per note, so adding a field here needs no
 * migration - but it DOES need a default in the normalizers at the bottom of this file, since
 * a board saved before the field existed will not have it. Everything that reads a canvas
 * goes through `asWhiteboardCanvas` / `asTreeCanvas` for exactly that reason. */
export type NoteDocType = 'text' | 'whiteboard' | 'tree';

export const NOTE_DOC_TYPES: NoteDocType[] = ['text', 'whiteboard', 'tree'];

export const NOTE_DOC_TYPE_META: Record<NoteDocType, { label: string; description: string }> = {
  text: {
    label: 'Text document',
    description: 'A written page - rich text, tables, @-mentions. The classic note.',
  },
  whiteboard: {
    label: 'Whiteboard',
    description: 'Sticky notes, labels and arrows you can drag around a free canvas.',
  },
  tree: {
    label: 'Content tree',
    description: 'A branching diagram - tech trees, family trees, hierarchies.',
  },
};

// ============================================================
// Shared canvas bits
// ============================================================

/** A named colour a sticky/node can be painted, with both themes spelled out rather than
 * derived: a pastel that reads as "post-it" on paper is a glare on a dark canvas, so the dark
 * value is a deep muted tone with light text instead of the same hex dimmed. Same flat-hex
 * convention as AOE_COLOR_PRESETS in types/shape.ts. */
export interface CanvasSwatch {
  id: string;
  label: string;
  /** fill + text in light mode */
  light: string;
  lightText: string;
  /** fill + text in dark mode */
  dark: string;
  darkText: string;
  /** border/edge accent, works on both */
  accent: string;
}

export const CANVAS_SWATCHES: CanvasSwatch[] = [
  { id: 'yellow', label: 'Yellow', light: '#fef3c0', lightText: '#4a3b00', dark: '#4a3f14', darkText: '#f6e6b0', accent: '#d9a900' },
  { id: 'green', label: 'Green', light: '#d8f5da', lightText: '#10391a', dark: '#1f4429', darkText: '#c3edcb', accent: '#22c55e' },
  { id: 'blue', label: 'Blue', light: '#d6e9fd', lightText: '#0d2f52', dark: '#1c3550', darkText: '#c5dcf5', accent: '#3b82f6' },
  { id: 'purple', label: 'Purple', light: '#e8dcfb', lightText: '#301a53', dark: '#372a55', darkText: '#ddd0f5', accent: '#a855f7' },
  { id: 'pink', label: 'Pink', light: '#fbdce8', lightText: '#4d1230', dark: '#4d2439', darkText: '#f6cddd', accent: '#ec4899' },
  { id: 'orange', label: 'Orange', light: '#fde3cd', lightText: '#4d2708', dark: '#4d3320', darkText: '#f7d9bd', accent: '#f97316' },
  { id: 'red', label: 'Red', light: '#fcd9d9', lightText: '#511616', dark: '#4f2626', darkText: '#f5c9c9', accent: '#e5484d' },
  { id: 'grey', label: 'Grey', light: '#e6e8eb', lightText: '#23272b', dark: '#33383d', darkText: '#dfe3e7', accent: '#8b949e' },
];

export const DEFAULT_SWATCH_ID = 'yellow';

export function swatchById(id: string | undefined): CanvasSwatch {
  return CANVAS_SWATCHES.find((s) => s.id === id) ?? CANVAS_SWATCHES[0];
}

/** Pan/zoom remembered inside the document, so re-opening a board lands where it was left
 * rather than scrolled back to the origin. */
export interface CanvasView {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;
export const DEFAULT_VIEW: CanvasView = { x: 0, y: 0, zoom: 1 };

// ============================================================
// Whiteboard
// ============================================================

/** sticky = a coloured post-it; label = transparent text straight on the canvas; frame = a
 * titled outlined box that groups the things dropped on top of it (purely visual - dragging a
 * frame does not carry its contents, matching how the map's shapes behave). */
export type WhiteboardItemKind = 'sticky' | 'label' | 'frame';

export interface WhiteboardItem {
  id: string;
  kind: WhiteboardItemKind;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Plain text, newlines kept - deliberately not HTML: a sticky is a scribble, and forty
   * TipTap instances on one board is not a canvas anyone wants to drag. */
  text: string;
  /** CanvasSwatch id */
  color: string;
  fontSize: number;
  /** degrees; the slight tilt that makes a wall of stickies readable. Stickies only. */
  rotation: number;
  /** stacking order - highest is on top, and clicking an item raises it */
  z: number;
}

export type WhiteboardConnectionStyle = 'arrow' | 'line' | 'dashed';

export interface WhiteboardConnection {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  style: WhiteboardConnectionStyle;
}

export interface WhiteboardCanvas {
  kind: 'whiteboard';
  version: 1;
  items: WhiteboardItem[];
  connections: WhiteboardConnection[];
  view: CanvasView;
}

export const STICKY_DEFAULT_SIZE = { width: 180, height: 150 };
export const LABEL_DEFAULT_SIZE = { width: 240, height: 48 };
export const FRAME_DEFAULT_SIZE = { width: 420, height: 320 };
export const CANVAS_MIN_ITEM_SIZE = 64;

export function emptyWhiteboard(): WhiteboardCanvas {
  return { kind: 'whiteboard', version: 1, items: [], connections: [], view: { ...DEFAULT_VIEW } };
}

// ============================================================
// Content tree
// ============================================================

/** One parent per node (parentId null = a root; a document may hold several roots, which is
 * what makes a family tree with two unrelated bloodlines, or a tech tree with parallel
 * disciplines, expressible). Anything that is NOT a parent-child edge - a marriage, a
 * cross-branch prerequisite, "rivals" - is a TreeLink instead, so the layout stays a tree
 * while the drawing can be a graph. */
export interface TreeNodeItem {
  id: string;
  parentId: string | null;
  title: string;
  subtitle: string;
  /** Longer freeform text, shown in the inspector. */
  body: string;
  /** CanvasSwatch id */
  color: string;
  /** Hides this node's descendants without deleting them. */
  collapsed: boolean;
  /** Manual position, set by dragging the node. null on both axes = laid out automatically.
   * "Auto arrange" clears these back to null. */
  x: number | null;
  y: number | null;
}

export type TreeLinkStyle = 'solid' | 'dashed';

export interface TreeLink {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  style: TreeLinkStyle;
}

export type TreeOrientation = 'vertical' | 'horizontal';

export interface TreeCanvas {
  kind: 'tree';
  version: 1;
  orientation: TreeOrientation;
  nodes: TreeNodeItem[];
  links: TreeLink[];
  view: CanvasView;
}

export const TREE_NODE_SIZE = { width: 190, height: 84 };
/** Gaps used by the tidy-tree layout in treeLayout.ts. */
export const TREE_GAP = { sibling: 34, level: 96 };

export function emptyTree(): TreeCanvas {
  return { kind: 'tree', version: 1, orientation: 'vertical', nodes: [], links: [], view: { ...DEFAULT_VIEW } };
}

/** A brand-new tree is never empty - a blank canvas with a "+" somewhere is a worse first
 * screen than a single root you can rename. */
export function seedTree(rootTitle: string): TreeCanvas {
  return {
    ...emptyTree(),
    nodes: [
      {
        id: crypto.randomUUID(),
        parentId: null,
        title: rootTitle,
        subtitle: '',
        body: '',
        color: 'blue',
        collapsed: false,
        x: null,
        y: null,
      },
    ],
  };
}

export type NoteCanvas = WhiteboardCanvas | TreeCanvas;

// ============================================================
// Normalizers
// ============================================================
//
// Everything below exists because a canvas is a JSONB blob written by an older build of this
// app: a board saved before `connections` existed has no `connections`, a node saved before
// `collapsed` has no `collapsed`, and a single `undefined.map` takes the whole page down. Same
// discipline as usePlayLayoutStore.resolve / usePlayItemsStore.normalizeSlot (see CLAUDE.md) -
// read a persisted canvas through these, never straight off the record.

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function nullableNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null);
}

function asView(raw: unknown): CanvasView {
  const v = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    x: num(v.x, 0),
    y: num(v.y, 0),
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, num(v.zoom, 1))),
  };
}

function asItemKind(raw: unknown): WhiteboardItemKind {
  return raw === 'label' || raw === 'frame' ? raw : 'sticky';
}

export function asWhiteboardCanvas(raw: unknown): WhiteboardCanvas {
  const doc = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const items: WhiteboardItem[] = rows(doc.items).map((item, index) => {
    const kind = asItemKind(item.kind);
    const size = kind === 'frame' ? FRAME_DEFAULT_SIZE : kind === 'label' ? LABEL_DEFAULT_SIZE : STICKY_DEFAULT_SIZE;
    return {
      id: str(item.id) || crypto.randomUUID(),
      kind,
      x: num(item.x, 40),
      y: num(item.y, 40),
      width: Math.max(CANVAS_MIN_ITEM_SIZE, num(item.width, size.width)),
      height: Math.max(CANVAS_MIN_ITEM_SIZE / 2, num(item.height, size.height)),
      text: str(item.text),
      color: swatchById(str(item.color, DEFAULT_SWATCH_ID)).id,
      fontSize: num(item.fontSize, kind === 'label' ? 22 : 14),
      rotation: num(item.rotation, 0),
      z: num(item.z, index + 1),
    };
  });
  const itemIds = new Set(items.map((i) => i.id));
  const connections: WhiteboardConnection[] = rows(doc.connections)
    .map((c) => ({
      id: str(c.id) || crypto.randomUUID(),
      fromId: str(c.fromId),
      toId: str(c.toId),
      label: str(c.label),
      style: (c.style === 'line' || c.style === 'dashed' ? c.style : 'arrow') as WhiteboardConnectionStyle,
    }))
    // A connection whose endpoint was deleted is not drawable - drop it rather than render a
    // line to (0,0).
    .filter((c) => itemIds.has(c.fromId) && itemIds.has(c.toId) && c.fromId !== c.toId);

  return { kind: 'whiteboard', version: 1, items, connections, view: asView(doc.view) };
}

export function asTreeCanvas(raw: unknown): TreeCanvas {
  const doc = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const nodes: TreeNodeItem[] = rows(doc.nodes).map((n) => ({
    id: str(n.id) || crypto.randomUUID(),
    parentId: typeof n.parentId === 'string' ? n.parentId : null,
    title: str(n.title, 'Untitled'),
    subtitle: str(n.subtitle),
    body: str(n.body),
    color: swatchById(str(n.color, 'blue')).id,
    collapsed: bool(n.collapsed),
    x: nullableNum(n.x),
    y: nullableNum(n.y),
  }));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  // Re-root anything whose parent is gone, and break parent cycles - a cycle would hang the
  // layout walk, and a dangling parentId would silently hide the node from every root's
  // subtree (it would exist in the document and be invisible on the canvas).
  for (const node of nodes) {
    if (node.parentId && !byId.has(node.parentId)) node.parentId = null;
  }
  for (const node of nodes) {
    const seen = new Set<string>([node.id]);
    let cursor = node.parentId ? byId.get(node.parentId) : undefined;
    while (cursor) {
      if (seen.has(cursor.id)) {
        node.parentId = null;
        break;
      }
      seen.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const links: TreeLink[] = rows(doc.links)
    .map((l) => ({
      id: str(l.id) || crypto.randomUUID(),
      fromId: str(l.fromId),
      toId: str(l.toId),
      label: str(l.label),
      style: (l.style === 'dashed' ? 'dashed' : 'solid') as TreeLinkStyle,
    }))
    .filter((l) => nodeIds.has(l.fromId) && nodeIds.has(l.toId) && l.fromId !== l.toId);

  return {
    kind: 'tree',
    version: 1,
    orientation: doc.orientation === 'horizontal' ? 'horizontal' : 'vertical',
    nodes,
    links,
    view: asView(doc.view),
  };
}

/** Reads a note's stored canvas as whatever its docType says it is. A note whose canvas is
 * null (every note that existed before this feature) comes back as an empty board. */
export function asCanvas(docType: NoteDocType, raw: unknown): NoteCanvas | null {
  if (docType === 'whiteboard') return asWhiteboardCanvas(raw);
  if (docType === 'tree') return asTreeCanvas(raw);
  return null;
}

/** Item/node count for the explorer's listing - a canvas note has no body length to report. */
export function canvasItemCount(docType: NoteDocType, raw: unknown): number {
  if (docType === 'whiteboard') return asWhiteboardCanvas(raw).items.length;
  if (docType === 'tree') return asTreeCanvas(raw).nodes.length;
  return 0;
}
