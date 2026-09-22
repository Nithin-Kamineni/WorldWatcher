import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTheme } from '@mui/material/styles';
import AccountTreeIcon from '@mui/icons-material/AccountTreeOutlined';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/InsertLinkOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHighOutlined';
import SwapCallsIcon from '@mui/icons-material/SwapCalls';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import { useCanvasDoc } from './useCanvasDoc';
import { descendantIds, edgePath, layoutTree, type LaidOutNode } from './treeLayout';
import {
  SVG_ORIGIN,
  borderPoint,
  canvasSurfaceSx,
  clampZoom,
  dragWithPointer,
  swatchColors,
  useCanvasViewport,
} from './canvasShared';
import { SwatchPicker } from './SwatchPicker';
import {
  TREE_NODE_SIZE,
  emptyTree,
  type TreeCanvas,
  type TreeLink,
  type TreeNodeItem,
  type TreeOrientation,
} from '../../../types/noteCanvas';
import type { Note } from '../../../types/note';

type Selection = { type: 'node'; id: string } | { type: 'link'; id: string } | null;

const KEYBOARD_HELP = [
  'Drag empty space to pan · wheel to scroll · ctrl+wheel to zoom',
  'Drag a node to move it and its branch · Auto arrange puts everything back',
  'Double-click a node to rename it · Delete removes it, its children move up',
  'ctrl+Z undo · ctrl+shift+Z redo',
].join('\n');

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

/** A content-tree note: a branching diagram of titled nodes - tech trees, family trees,
 * succession lines, faction hierarchies, "what unlocks what".
 *
 * The document is a tree (one parent per node, several roots allowed) drawn by an automatic
 * tidy layout, plus free-form extra links for the edges a strict tree cannot carry - a
 * marriage, a cross-branch prerequisite, a rivalry. That split is the whole design: the
 * hierarchy stays something the app can lay out, while the picture can still be a graph. */
export function ContentTreeEditor({ note }: { note: Note }) {
  const theme = useTheme();
  const initial = note.canvas?.kind === 'tree' ? note.canvas : emptyTree();
  const { doc, commit, update, beginHistory, undo, redo, canUndo, canRedo, pending } = useCanvasDoc<TreeCanvas>(
    note.id,
    initial,
  );

  const [selection, setSelection] = useState<Selection>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);

  const viewport = useCanvasViewport(doc.view, (view) => update((d) => ({ ...d, view })));
  const editingRef = useRef<string | null>(null);
  editingRef.current = editingId;

  const layout = useMemo(() => layoutTree(doc), [doc]);
  const vertical = doc.orientation === 'vertical';
  const selectedNode = selection?.type === 'node' ? doc.nodes.find((n) => n.id === selection.id) ?? null : null;
  const selectedLink = selection?.type === 'link' ? doc.links.find((l) => l.id === selection.id) ?? null : null;

  const patchNode = (id: string, patch: Partial<TreeNodeItem>, history = true) =>
    (history ? commit : update)((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));

  const addNode = (parentId: string | null) => {
    const parent = parentId ? doc.nodes.find((n) => n.id === parentId) : null;
    const node: TreeNodeItem = {
      id: crypto.randomUUID(),
      parentId,
      title: parentId ? 'New node' : 'New root',
      subtitle: '',
      body: '',
      color: parent?.color ?? 'blue',
      collapsed: false,
      x: null,
      y: null,
    };
    commit((d) => ({
      ...d,
      // Adding a child to a collapsed node has to open it, or the new node appears nowhere.
      nodes: [...d.nodes.map((n) => (n.id === parentId ? { ...n, collapsed: false } : n)), node],
    }));
    setSelection({ type: 'node', id: node.id });
    setEditingId(node.id);
  };

  /** Removes the node; its children move up to its parent so a mis-placed middle node can be
   * dropped without taking the branch under it with it. */
  const deleteNode = (id: string) => {
    const target = doc.nodes.find((n) => n.id === id);
    if (!target) return;
    commit((d) => ({
      ...d,
      nodes: d.nodes.filter((n) => n.id !== id).map((n) => (n.parentId === id ? { ...n, parentId: target.parentId } : n)),
      links: d.links.filter((l) => l.fromId !== id && l.toId !== id),
    }));
    setSelection(null);
  };

  const deleteBranch = (id: string) => {
    const doomed = new Set([id, ...descendantIds(doc, id)]);
    commit((d) => ({
      ...d,
      nodes: d.nodes.filter((n) => !doomed.has(n.id)),
      links: d.links.filter((l) => !doomed.has(l.fromId) && !doomed.has(l.toId)),
    }));
    setSelection(null);
  };

  const setParent = (id: string, parentId: string | null) => {
    // Re-parenting under your own descendant would make a ring nothing could draw.
    if (parentId && (parentId === id || descendantIds(doc, id).includes(parentId))) return;
    patchNode(id, { parentId, x: null, y: null });
  };

  const handleNodePointerDown = (e: ReactPointerEvent, laid: LaidOutNode) => {
    if (editingId === laid.node.id) return;
    e.stopPropagation();

    if (linking) {
      if (!linkFrom) {
        setLinkFrom(laid.node.id);
        return;
      }
      if (linkFrom !== laid.node.id) {
        const link: TreeLink = { id: crypto.randomUUID(), fromId: linkFrom, toId: laid.node.id, label: '', style: 'dashed' };
        commit((d) => ({ ...d, links: [...d.links, link] }));
        setSelection({ type: 'link', id: link.id });
      }
      setLinkFrom(null);
      return;
    }

    setSelection({ type: 'node', id: laid.node.id });

    // Dragging carries the branch: moving a node and leaving its children behind is never
    // what anyone means by moving a subtree.
    // Only nodes that are actually on screen: a descendant inside a collapsed branch has no
    // position to offset from, and pinning one at 0,0 would scatter the branch the moment it
    // is expanded again.
    const origins = new Map<string, { x: number; y: number }>();
    for (const id of [laid.node.id, ...descendantIds(doc, laid.node.id)]) {
      const at = layout.byId.get(id);
      if (at) origins.set(id, { x: at.x, y: at.y });
    }
    let moved = false;
    dragWithPointer(e, (dx, dy) => {
      if (!moved) {
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        moved = true;
        beginHistory();
      }
      const zoom = doc.view.zoom;
      update((d) => ({
        ...d,
        nodes: d.nodes.map((n) => {
          const origin = origins.get(n.id);
          return origin ? { ...n, x: Math.round(origin.x + dx / zoom), y: Math.round(origin.y + dy / zoom) } : n;
        }),
      }));
    });
  };

  const autoArrange = () => commit((d) => ({ ...d, nodes: d.nodes.map((n) => ({ ...n, x: null, y: null })) }));

  const fitToContent = () => {
    const el = viewport.ref.current;
    if (!el || layout.nodes.length === 0) return;
    const rect = el.getBoundingClientRect();
    const minX = Math.min(...layout.nodes.map((n) => n.x));
    const minY = Math.min(...layout.nodes.map((n) => n.y));
    const maxX = Math.max(...layout.nodes.map((n) => n.x + TREE_NODE_SIZE.width));
    const maxY = Math.max(...layout.nodes.map((n) => n.y + TREE_NODE_SIZE.height));
    const pad = 80;
    const zoom = clampZoom(Math.min(rect.width / (maxX - minX + pad), rect.height / (maxY - minY + pad), 1.2));
    update((d) => ({
      ...d,
      view: { zoom, x: rect.width / 2 - ((minX + maxX) / 2) * zoom, y: rect.height / 2 - ((minY + maxY) / 2) * zoom },
    }));
  };

  // Same one-time centring as the whiteboard: a seeded tree's root sits at the layout
  // origin, which is the very corner of the canvas until the view is moved.
  const centredOnce = useRef(false);
  useEffect(() => {
    if (centredOnce.current) return;
    centredOnce.current = true;
    const view = doc.view;
    if (doc.nodes.length > 0 && view.x === 0 && view.y === 0 && view.zoom === 1) fitToContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingId(null);
        setLinking(false);
        setLinkFrom(null);
        return;
      }
      if (editingRef.current !== null || isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (!selection) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selection.type === 'node') deleteNode(selection.id);
        else {
          commit((d) => ({ ...d, links: d.links.filter((l) => l.id !== selection.id) }));
          setSelection(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const edgeColor = theme.palette.mode === 'dark' ? 'rgba(220,228,236,0.55)' : 'rgba(40,50,62,0.45)';
  const nodeRect = (laid: LaidOutNode) => ({ x: laid.x, y: laid.y, ...TREE_NODE_SIZE });
  /** Everything that may not become a node's parent: itself, and anything below it. */
  const forbiddenParents = selectedNode ? new Set([selectedNode.id, ...descendantIds(doc, selectedNode.id)]) : new Set<string>();

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <Paper variant="outlined" sx={{ borderRadius: 0, borderLeft: 0, borderRight: 0, px: 1.25, py: 0.75, flexShrink: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={() => addNode(null)}>
            Root node
          </Button>
          <Tooltip title={selectedNode ? 'Add a child under the selected node' : 'Select a node first'}>
            <span>
              <Button
                size="small"
                variant="outlined"
                disabled={!selectedNode}
                startIcon={<AccountTreeIcon fontSize="small" />}
                onClick={() => selectedNode && addNode(selectedNode.id)}
              >
                Child
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Link two nodes without making one the parent - a marriage, a prerequisite, a rivalry">
            <Button
              size="small"
              variant={linking ? 'contained' : 'outlined'}
              color={linking ? 'secondary' : 'primary'}
              startIcon={<LinkIcon fontSize="small" />}
              onClick={() => {
                setLinking((on) => !on);
                setLinkFrom(null);
              }}
            >
              Link
            </Button>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <ToggleButtonGroup
            size="small"
            exclusive
            value={doc.orientation}
            onChange={(_e, value: TreeOrientation | null) => value && commit((d) => ({ ...d, orientation: value }))}
          >
            <ToggleButton value="vertical" aria-label="Top to bottom">
              <SwapCallsIcon fontSize="small" sx={{ mr: 0.5 }} /> Down
            </ToggleButton>
            <ToggleButton value="horizontal" aria-label="Left to right">
              <SwapCallsIcon fontSize="small" sx={{ mr: 0.5, transform: 'rotate(90deg)' }} /> Across
            </ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="Drop every node back into the automatic layout">
            <span>
              <Button size="small" startIcon={<AutoFixHighIcon fontSize="small" />} onClick={autoArrange}>
                Auto arrange
              </Button>
            </span>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <Tooltip title="Undo (ctrl+Z)">
            <span>
              <IconButton size="small" aria-label="Undo" disabled={!canUndo} onClick={undo}>
                <UndoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo (ctrl+shift+Z)">
            <span>
              <IconButton size="small" aria-label="Redo" disabled={!canRedo} onClick={redo}>
                <RedoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Zoom out">
            <IconButton size="small" aria-label="Zoom out" onClick={() => viewport.zoomBy(1 / 1.2)}>
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ width: 42, textAlign: 'center', color: 'text.secondary' }}>
            {Math.round(doc.view.zoom * 100)}%
          </Typography>
          <Tooltip title="Zoom in">
            <IconButton size="small" aria-label="Zoom in" onClick={() => viewport.zoomBy(1.2)}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit the whole tree on screen">
            <span>
              <IconButton size="small" aria-label="Fit tree" disabled={doc.nodes.length === 0} onClick={fitToContent}>
                <FitScreenIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="caption" color="text.secondary">
            {pending ? 'Saving…' : 'Saved'}
          </Typography>
          <Tooltip title={<Box sx={{ whiteSpace: 'pre-line' }}>{KEYBOARD_HELP}</Box>}>
            <IconButton size="small" aria-label="Content tree shortcuts">
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {selectedLink && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Link
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={selectedLink.style}
              onChange={(_e, value) =>
                value &&
                commit((d) => ({ ...d, links: d.links.map((l) => (l.id === selectedLink.id ? { ...l, style: value } : l)) }))
              }
            >
              <ToggleButton value="solid">Solid</ToggleButton>
              <ToggleButton value="dashed">Dashed</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              size="small"
              placeholder="Link label (married, requires…)"
              value={selectedLink.label}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  links: d.links.map((l) => (l.id === selectedLink.id ? { ...l, label: e.target.value } : l)),
                }))
              }
              sx={{ width: 260 }}
            />
            <Tooltip title="Delete link (Del)">
              <IconButton
                size="small"
                color="error"
                aria-label="Delete link"
                onClick={() => {
                  commit((d) => ({ ...d, links: d.links.filter((l) => l.id !== selectedLink.id) }));
                  setSelection(null);
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Paper>

      <Stack direction="row" sx={{ flexGrow: 1, minHeight: 0 }}>
        <Box
          ref={viewport.ref}
          sx={(t) => ({
            position: 'relative',
            flexGrow: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
            touchAction: 'none',
            cursor: linking ? 'crosshair' : viewport.panning ? 'grabbing' : 'grab',
            ...canvasSurfaceSx(t, doc.view),
          })}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            setSelection(null);
            setEditingId(null);
            setLinkFrom(null);
            viewport.startPan(e);
          }}
        >
          <Box
            sx={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0' }}
            style={{ transform: `translate(${doc.view.x}px, ${doc.view.y}px) scale(${doc.view.zoom})` }}
          >
            <Box
              component="svg"
              sx={{ position: 'absolute', left: -SVG_ORIGIN, top: -SVG_ORIGIN, pointerEvents: 'none' }}
              width={SVG_ORIGIN * 2}
              height={SVG_ORIGIN * 2}
            >
              <g transform={`translate(${SVG_ORIGIN},${SVG_ORIGIN})`}>
                {layout.edges.map(({ parent, child }) => (
                  <path
                    key={`${parent.node.id}-${child.node.id}`}
                    d={edgePath(parent, child, vertical)}
                    fill="none"
                    stroke={edgeColor}
                    strokeWidth={2}
                  />
                ))}
                {doc.links.map((link) => {
                  const from = layout.byId.get(link.fromId);
                  const to = layout.byId.get(link.toId);
                  // A link into a hidden branch has nowhere to land - skip it until it opens.
                  if (!from || !to) return null;
                  const start = borderPoint(nodeRect(to), nodeRect(from));
                  const end = borderPoint(nodeRect(from), nodeRect(to));
                  const isSelected = selection?.type === 'link' && selection.id === link.id;
                  return (
                    <g key={link.id}>
                      <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke="transparent"
                        strokeWidth={14}
                        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSelection({ type: 'link', id: link.id });
                        }}
                      />
                      <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={isSelected ? theme.palette.primary.main : theme.palette.secondary.main}
                        strokeWidth={isSelected ? 3 : 2}
                        strokeDasharray={link.style === 'dashed' ? '7 6' : undefined}
                      />
                      {link.label && (
                        <text
                          x={(start.x + end.x) / 2}
                          y={(start.y + end.y) / 2 - 6}
                          textAnchor="middle"
                          fontSize={13}
                          fill={theme.palette.text.secondary}
                          style={{ paintOrder: 'stroke', stroke: theme.palette.background.default, strokeWidth: 4 }}
                        >
                          {link.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </Box>

            {layout.nodes.map((laid) => {
              const { node } = laid;
              const colors = swatchColors(theme, node.color);
              const isSelected = selection?.type === 'node' && selection.id === node.id;
              const isEditing = editingId === node.id;
              const isLinkSource = linkFrom === node.id;
              return (
                <Box
                  key={node.id}
                  sx={{
                    position: 'absolute',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.25,
                    p: 1,
                    borderRadius: 2,
                    bgcolor: colors.bg,
                    color: colors.text,
                    border: 1,
                    borderColor: colors.accent,
                    boxShadow: 1,
                    cursor: isEditing ? 'text' : 'move',
                    outline: isSelected || isLinkSource ? 2 : 0,
                    outlineStyle: 'solid',
                    outlineColor: isLinkSource ? 'secondary.main' : 'primary.main',
                    outlineOffset: 2,
                    '&:hover .tree-node-add': { opacity: 1 },
                  }}
                  style={{ left: laid.x, top: laid.y, width: TREE_NODE_SIZE.width, height: TREE_NODE_SIZE.height }}
                  onPointerDown={(e) => handleNodePointerDown(e, laid)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setSelection({ type: 'node', id: node.id });
                    setEditingId(node.id);
                  }}
                >
                  {isEditing ? (
                    <Box
                      component="input"
                      autoFocus
                      value={node.title}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => patchNode(node.id, { title: e.target.value }, false)}
                      onFocus={beginHistory}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e: ReactKeyboardEvent) => e.key === 'Enter' && setEditingId(null)}
                      onPointerDown={(e: ReactPointerEvent) => e.stopPropagation()}
                      sx={{
                        border: 0,
                        outline: 'none',
                        bgcolor: 'transparent',
                        color: 'inherit',
                        font: 'inherit',
                        fontWeight: 700,
                        fontSize: 14,
                        p: 0,
                        width: '100%',
                      }}
                    />
                  ) : (
                    <Typography
                      sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25, overflow: 'hidden', wordBreak: 'break-word' }}
                    >
                      {node.title || 'Untitled'}
                    </Typography>
                  )}
                  {node.subtitle && (
                    <Typography variant="caption" sx={{ opacity: 0.85, overflow: 'hidden', wordBreak: 'break-word' }}>
                      {node.subtitle}
                    </Typography>
                  )}

                  {laid.childCount > 0 && (
                    <Tooltip title={node.collapsed ? `Show ${laid.hidden} hidden` : 'Hide this branch'}>
                      <IconButton
                        size="small"
                        aria-label={node.collapsed ? 'Expand branch' : 'Collapse branch'}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          patchNode(node.id, { collapsed: !node.collapsed });
                        }}
                        sx={{
                          position: 'absolute',
                          right: 2,
                          bottom: 2,
                          color: 'inherit',
                          bgcolor: 'transparent',
                        }}
                      >
                        {node.collapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  )}
                  {node.collapsed && laid.hidden > 0 && (
                    <Chip
                      label={`+${laid.hidden}`}
                      size="small"
                      sx={{ position: 'absolute', right: 30, bottom: 6, height: 20, fontSize: 11 }}
                    />
                  )}

                  <Tooltip title="Add a child here">
                    <IconButton
                      className="tree-node-add"
                      size="small"
                      aria-label={`Add a child under ${node.title}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        addNode(node.id);
                      }}
                      sx={{
                        position: 'absolute',
                        opacity: 0,
                        transition: 'opacity 0.1s',
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                        width: 22,
                        height: 22,
                        ...(vertical
                          ? { left: '50%', bottom: -11, transform: 'translateX(-50%)' }
                          : { top: '50%', right: -11, transform: 'translateY(-50%)' }),
                        '&:hover': { bgcolor: 'background.paper' },
                      }}
                    >
                      <AddIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>

          {doc.nodes.length === 0 && (
            <Stack
              spacing={1.5}
              sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
            >
              <AccountTreeIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, textAlign: 'center' }}>
                An empty tree. Add a root node, then hover a node and press + to grow a branch under it.
              </Typography>
            </Stack>
          )}

          {linking && (
            <Paper
              elevation={4}
              sx={{ position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', px: 2, py: 0.75, borderRadius: 5 }}
            >
              <Typography variant="caption">
                {linkFrom ? 'Now click the node to link it to' : 'Click the first node to link'} · Esc to stop
              </Typography>
            </Paper>
          )}
        </Box>

        {/* Inspector - the fields that don't fit on a node chip. Only rendered for a
            selection, so the canvas keeps the full width the rest of the time. */}
        {selectedNode && (
          <Paper
            variant="outlined"
            sx={{ width: 300, flexShrink: 0, borderRadius: 0, borderRight: 0, borderBottom: 0, p: 2, overflowY: 'auto' }}
          >
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Node
              </Typography>
              <IconButton size="small" aria-label="Close node panel" onClick={() => setSelection(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Stack spacing={2}>
              <TextField
                size="small"
                label="Title"
                value={selectedNode.title}
                onFocus={beginHistory}
                onChange={(e) => patchNode(selectedNode.id, { title: e.target.value }, false)}
                fullWidth
              />
              <TextField
                size="small"
                label="Subtitle"
                placeholder="b. 1482 · Tier 2 · 3 sp"
                value={selectedNode.subtitle}
                onFocus={beginHistory}
                onChange={(e) => patchNode(selectedNode.id, { subtitle: e.target.value }, false)}
                fullWidth
              />
              <TextField
                size="small"
                label="Notes"
                value={selectedNode.body}
                onFocus={beginHistory}
                onChange={(e) => patchNode(selectedNode.id, { body: e.target.value }, false)}
                multiline
                minRows={4}
                fullWidth
              />
              <TextField
                size="small"
                select
                label="Parent"
                value={selectedNode.parentId ?? ''}
                onChange={(e) => setParent(selectedNode.id, e.target.value || null)}
                fullWidth
              >
                <MenuItem value="">(root)</MenuItem>
                {doc.nodes
                  .filter((n) => !forbiddenParents.has(n.id))
                  .map((n) => (
                    <MenuItem key={n.id} value={n.id}>
                      {n.title || 'Untitled'}
                    </MenuItem>
                  ))}
              </TextField>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                  Colour
                </Typography>
                <SwatchPicker value={selectedNode.color} onChange={(color) => patchNode(selectedNode.id, { color })} />
              </Box>
              <Divider />
              <Button size="small" startIcon={<AddIcon />} onClick={() => addNode(selectedNode.id)}>
                Add child
              </Button>
              <Button size="small" startIcon={<AddIcon />} onClick={() => addNode(selectedNode.parentId)}>
                Add sibling
              </Button>
              <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => deleteNode(selectedNode.id)}>
                Delete node
              </Button>
              {descendantIds(doc, selectedNode.id).length > 0 && (
                <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => deleteBranch(selectedNode.id)}>
                  Delete branch ({descendantIds(doc, selectedNode.id).length + 1})
                </Button>
              )}
              <Typography variant="caption" color="text.secondary">
                Deleting a node moves its children up to its parent. "Delete branch" removes it and everything under it.
              </Typography>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Stack>
  );
}
