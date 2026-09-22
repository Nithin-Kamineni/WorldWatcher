import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTheme } from '@mui/material/styles';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import TimelineIcon from '@mui/icons-material/Timeline';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import TextIncreaseIcon from '@mui/icons-material/TextIncrease';
import TextDecreaseIcon from '@mui/icons-material/TextDecrease';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import { useCanvasDoc } from './useCanvasDoc';
import {
  SVG_ORIGIN,
  borderPoint,
  canvasSurfaceSx,
  clampZoom,
  dragWithPointer,
  swatchColors,
  useCanvasViewport,
  type Rect,
} from './canvasShared';
import { SwatchPicker } from './SwatchPicker';
import {
  CANVAS_MIN_ITEM_SIZE,
  FRAME_DEFAULT_SIZE,
  LABEL_DEFAULT_SIZE,
  STICKY_DEFAULT_SIZE,
  emptyWhiteboard,
  type WhiteboardCanvas,
  type WhiteboardConnection,
  type WhiteboardConnectionStyle,
  type WhiteboardItem,
  type WhiteboardItemKind,
} from '../../../types/noteCanvas';
import type { Note } from '../../../types/note';

type Selection = { type: 'item'; id: string } | { type: 'connection'; id: string } | null;

const CONNECTION_STYLES: { value: WhiteboardConnectionStyle; label: string }[] = [
  { value: 'arrow', label: 'Arrow' },
  { value: 'line', label: 'Line' },
  { value: 'dashed', label: 'Dashed' },
];

const KEYBOARD_HELP = [
  'Drag empty space to pan · wheel to scroll · ctrl+wheel to zoom',
  'Double-click an item to type in it · Esc to stop',
  'Delete removes what is selected · ctrl+D duplicates it',
  'ctrl+Z undo · ctrl+shift+Z redo',
].join('\n');

/** True while the keystroke belongs to something the user is typing in, so the board's own
 * shortcuts (Delete, ctrl+D) don't fire while a sticky's text or the note title has focus. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

/** A whiteboard note: sticky notes, text labels and frames you drag around a free canvas,
 * optionally joined by arrows.
 *
 * Deliberately plain DOM rather than Konva (which this app already uses for the battle map):
 * the map draws hundreds of tokens over an image and needs a scene graph, while a board is a
 * few dozen boxes of TEXT that must be selectable, wrap properly and be typed into - all of
 * which HTML does for free and canvas makes you rebuild.
 *
 * Every change flows through useCanvasDoc, which owns undo and the debounced write-back to
 * the note; there is no Save button, the gesture is the commit. */
export function WhiteboardEditor({ note }: { note: Note }) {
  const theme = useTheme();
  const initial = note.canvas?.kind === 'whiteboard' ? note.canvas : emptyWhiteboard();
  const { doc, commit, update, beginHistory, undo, redo, canUndo, canRedo, pending } = useCanvasDoc<WhiteboardCanvas>(
    note.id,
    initial,
  );

  const [selection, setSelection] = useState<Selection>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Arrow-drawing mode, and the item the arrow starts from once one is picked. */
  const [connecting, setConnecting] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  const viewport = useCanvasViewport(doc.view, (view) => update((d) => ({ ...d, view })));
  const editingRef = useRef<string | null>(null);
  editingRef.current = editingId;

  const ordered = useMemo(() => [...doc.items].sort((a, b) => a.z - b.z), [doc.items]);
  const selectedItem = selection?.type === 'item' ? doc.items.find((i) => i.id === selection.id) ?? null : null;
  const selectedConnection =
    selection?.type === 'connection' ? doc.connections.find((c) => c.id === selection.id) ?? null : null;

  const patchItem = (id: string, patch: Partial<WhiteboardItem>, history = true) =>
    (history ? commit : update)((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));

  const removeItem = (id: string) => {
    commit((d) => ({
      ...d,
      items: d.items.filter((i) => i.id !== id),
      // An arrow with a missing end is not a drawable thing - it goes with the item.
      connections: d.connections.filter((c) => c.fromId !== id && c.toId !== id),
    }));
    setSelection(null);
  };

  const addItem = (kind: WhiteboardItemKind) => {
    const size = kind === 'frame' ? FRAME_DEFAULT_SIZE : kind === 'label' ? LABEL_DEFAULT_SIZE : STICKY_DEFAULT_SIZE;
    const at = viewport.center();
    const zValues = doc.items.map((i) => i.z);
    // Cascade successive additions instead of stacking them all on the middle of the screen,
    // which buries each new item under the last one.
    const offset = (doc.items.length % 6) * 26;
    const item: WhiteboardItem = {
      id: crypto.randomUUID(),
      kind,
      // Frames are backdrops: a new one goes behind everything so it doesn't swallow the
      // stickies it is drawn around.
      x: Math.round(at.x - size.width / 2 + offset),
      y: Math.round(at.y - size.height / 2 + offset * 0.8),
      width: size.width,
      height: size.height,
      text: '',
      color: kind === 'sticky' ? 'yellow' : kind === 'frame' ? 'grey' : 'blue',
      fontSize: kind === 'label' ? 22 : 14,
      // A wall of perfectly square stickies is harder to read than a slightly untidy one.
      rotation: kind === 'sticky' ? Math.round((Math.random() - 0.5) * 4) : 0,
      z: kind === 'frame' ? Math.min(0, ...zValues) - 1 : Math.max(0, ...zValues) + 1,
    };
    commit((d) => ({ ...d, items: [...d.items, item] }));
    setSelection({ type: 'item', id: item.id });
    setEditingId(item.id);
  };

  const duplicateItem = (id: string) => {
    const source = doc.items.find((i) => i.id === id);
    if (!source) return;
    const copy: WhiteboardItem = {
      ...source,
      id: crypto.randomUUID(),
      x: source.x + 24,
      y: source.y + 24,
      z: Math.max(0, ...doc.items.map((i) => i.z)) + 1,
    };
    commit((d) => ({ ...d, items: [...d.items, copy] }));
    setSelection({ type: 'item', id: copy.id });
  };

  const raise = (id: string, toFront: boolean) => {
    const zValues = doc.items.map((i) => i.z);
    patchItem(id, { z: toFront ? Math.max(0, ...zValues) + 1 : Math.min(0, ...zValues) - 1 });
  };

  const handleItemPointerDown = (e: ReactPointerEvent, item: WhiteboardItem) => {
    if (editingId === item.id) return;
    e.stopPropagation();

    if (connecting) {
      if (!connectFrom) {
        setConnectFrom(item.id);
        return;
      }
      if (connectFrom !== item.id) {
        const connection: WhiteboardConnection = {
          id: crypto.randomUUID(),
          fromId: connectFrom,
          toId: item.id,
          label: '',
          style: 'arrow',
        };
        commit((d) => ({ ...d, connections: [...d.connections, connection] }));
        setSelection({ type: 'connection', id: connection.id });
      }
      setConnectFrom(null);
      return;
    }

    setSelection({ type: 'item', id: item.id });
    const originX = item.x;
    const originY = item.y;
    let moved = false;
    dragWithPointer(e, (dx, dy) => {
      if (!moved) {
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        // History is pushed once, at the point the drag becomes a drag - so undo restores
        // where the item was before this move rather than one mouse-move ago.
        moved = true;
        beginHistory();
      }
      const zoom = doc.view.zoom;
      update((d) => ({
        ...d,
        items: d.items.map((i) =>
          i.id === item.id ? { ...i, x: Math.round(originX + dx / zoom), y: Math.round(originY + dy / zoom) } : i,
        ),
      }));
    });
  };

  const handleResizePointerDown = (e: ReactPointerEvent, item: WhiteboardItem) => {
    e.stopPropagation();
    const startW = item.width;
    const startH = item.height;
    let started = false;
    dragWithPointer(e, (dx, dy) => {
      if (!started) {
        started = true;
        beginHistory();
      }
      const zoom = doc.view.zoom;
      update((d) => ({
        ...d,
        items: d.items.map((i) =>
          i.id === item.id
            ? {
                ...i,
                width: Math.max(CANVAS_MIN_ITEM_SIZE, Math.round(startW + dx / zoom)),
                height: Math.max(CANVAS_MIN_ITEM_SIZE / 2, Math.round(startH + dy / zoom)),
              }
            : i,
        ),
      }));
    });
  };

  const fitToContent = () => {
    const el = viewport.ref.current;
    if (!el || doc.items.length === 0) return;
    const rect = el.getBoundingClientRect();
    const minX = Math.min(...doc.items.map((i) => i.x));
    const minY = Math.min(...doc.items.map((i) => i.y));
    const maxX = Math.max(...doc.items.map((i) => i.x + i.width));
    const maxY = Math.max(...doc.items.map((i) => i.y + i.height));
    const pad = 80;
    const zoom = clampZoom(Math.min(rect.width / (maxX - minX + pad), rect.height / (maxY - minY + pad), 1.2));
    update((d) => ({
      ...d,
      view: {
        zoom,
        x: rect.width / 2 - ((minX + maxX) / 2) * zoom,
        y: rect.height / 2 - ((minY + maxY) / 2) * zoom,
      },
    }));
  };

  // A board opened for the first time (its view is still the untouched default) starts
  // centred on its content rather than in the top-left corner - the origin is an arbitrary
  // place for a canvas, and a board restored from a saved view is left exactly as it was.
  const centredOnce = useRef(false);
  useEffect(() => {
    if (centredOnce.current) return;
    centredOnce.current = true;
    const view = doc.view;
    if (doc.items.length > 0 && view.x === 0 && view.y === 0 && view.zoom === 1) fitToContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Board-level shortcuts. Bound to the window rather than the canvas so they work without
  // the surface itself having focus, and skipped whenever something is being typed into.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingId(null);
        setConnecting(false);
        setConnectFrom(null);
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
        if (selection.type === 'item') removeItem(selection.id);
        else {
          commit((d) => ({ ...d, connections: d.connections.filter((c) => c.id !== selection.id) }));
          setSelection(null);
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 'd' && selection.type === 'item') {
        e.preventDefault();
        duplicateItem(selection.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const rectOf = (item: WhiteboardItem): Rect => ({ x: item.x, y: item.y, width: item.width, height: item.height });
  const itemsById = new Map(doc.items.map((i) => [i.id, i]));
  const edgeColor = theme.palette.mode === 'dark' ? 'rgba(220,228,236,0.75)' : 'rgba(40,50,62,0.65)';

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      {/* Toolbar */}
      <Paper
        variant="outlined"
        sx={{ borderRadius: 0, borderLeft: 0, borderRight: 0, px: 1.25, py: 0.75, flexShrink: 0 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<StickyNote2Icon fontSize="small" />} onClick={() => addItem('sticky')}>
            Sticky
          </Button>
          <Button size="small" variant="outlined" startIcon={<TextFieldsIcon fontSize="small" />} onClick={() => addItem('label')}>
            Label
          </Button>
          <Button size="small" variant="outlined" startIcon={<CropSquareIcon fontSize="small" />} onClick={() => addItem('frame')}>
            Frame
          </Button>
          <Tooltip title="Draw an arrow: click the item it starts from, then the one it points at">
            <Button
              size="small"
              variant={connecting ? 'contained' : 'outlined'}
              color={connecting ? 'secondary' : 'primary'}
              startIcon={<TimelineIcon fontSize="small" />}
              onClick={() => {
                setConnecting((on) => !on);
                setConnectFrom(null);
              }}
            >
              Connect
            </Button>
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

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

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
          <Tooltip title="Fit the whole board on screen">
            <span>
              <IconButton size="small" aria-label="Fit board" disabled={doc.items.length === 0} onClick={fitToContent}>
                <FitScreenIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="caption" color="text.secondary">
            {pending ? 'Saving…' : 'Saved'}
          </Typography>
          <Tooltip title={<Box sx={{ whiteSpace: 'pre-line' }}>{KEYBOARD_HELP}</Box>}>
            <IconButton size="small" aria-label="Whiteboard shortcuts">
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Contextual row - only what the current selection can actually be given. */}
        {selectedItem && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            <SwatchPicker value={selectedItem.color} onChange={(color) => patchItem(selectedItem.id, { color })} />
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title="Smaller text">
              <IconButton
                size="small"
                aria-label="Smaller text"
                onClick={() => patchItem(selectedItem.id, { fontSize: Math.max(10, selectedItem.fontSize - 2) })}
              >
                <TextDecreaseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Bigger text">
              <IconButton
                size="small"
                aria-label="Bigger text"
                onClick={() => patchItem(selectedItem.id, { fontSize: Math.min(48, selectedItem.fontSize + 2) })}
              >
                <TextIncreaseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {selectedItem.kind === 'sticky' && (
              <>
                <Tooltip title="Tilt left">
                  <IconButton
                    size="small"
                    aria-label="Tilt left"
                    onClick={() => patchItem(selectedItem.id, { rotation: selectedItem.rotation - 3 })}
                  >
                    <RotateLeftIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Tilt right">
                  <IconButton
                    size="small"
                    aria-label="Tilt right"
                    onClick={() => patchItem(selectedItem.id, { rotation: selectedItem.rotation + 3 })}
                  >
                    <RotateRightIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
            <Tooltip title="Bring to front">
              <IconButton size="small" aria-label="Bring to front" onClick={() => raise(selectedItem.id, true)}>
                <FlipToFrontIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Send to back">
              <IconButton size="small" aria-label="Send to back" onClick={() => raise(selectedItem.id, false)}>
                <FlipToBackIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Duplicate (ctrl+D)">
              <IconButton size="small" aria-label="Duplicate" onClick={() => duplicateItem(selectedItem.id)}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete (Del)">
              <IconButton size="small" color="error" aria-label="Delete item" onClick={() => removeItem(selectedItem.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}

        {selectedConnection && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={selectedConnection.style}
              onChange={(_e, value) =>
                value &&
                commit((d) => ({
                  ...d,
                  connections: d.connections.map((c) => (c.id === selectedConnection.id ? { ...c, style: value } : c)),
                }))
              }
            >
              {CONNECTION_STYLES.map((style) => (
                <ToggleButton key={style.value} value={style.value}>
                  {style.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <TextField
              size="small"
              placeholder="Arrow label"
              value={selectedConnection.label}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  connections: d.connections.map((c) =>
                    c.id === selectedConnection.id ? { ...c, label: e.target.value } : c,
                  ),
                }))
              }
              sx={{ width: 200 }}
            />
            <Tooltip title="Delete arrow (Del)">
              <IconButton
                size="small"
                color="error"
                aria-label="Delete arrow"
                onClick={() => {
                  commit((d) => ({ ...d, connections: d.connections.filter((c) => c.id !== selectedConnection.id) }));
                  setSelection(null);
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Paper>

      {/* Canvas */}
      <Box
        ref={viewport.ref}
        sx={(t) => ({
          position: 'relative',
          flexGrow: 1,
          minHeight: 0,
          overflow: 'hidden',
          touchAction: 'none',
          cursor: connecting ? 'crosshair' : viewport.panning ? 'grabbing' : 'grab',
          ...canvasSurfaceSx(t, doc.view),
        })}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          setSelection(null);
          setEditingId(null);
          setConnectFrom(null);
          viewport.startPan(e);
        }}
      >
        <Box
          sx={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0' }}
          style={{ transform: `translate(${doc.view.x}px, ${doc.view.y}px) scale(${doc.view.zoom})` }}
        >
          {/* Arrows, under every item: an arrow is a relationship between things, not a thing
              you stack on top of them. */}
          <Box
            component="svg"
            sx={{ position: 'absolute', left: -SVG_ORIGIN, top: -SVG_ORIGIN, pointerEvents: 'none' }}
            width={SVG_ORIGIN * 2}
            height={SVG_ORIGIN * 2}
          >
            <defs>
              <marker id="wb-arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <path d="M0,0 L10,4 L0,8 z" fill={edgeColor} />
              </marker>
            </defs>
            <g transform={`translate(${SVG_ORIGIN},${SVG_ORIGIN})`}>
              {doc.connections.map((connection) => {
                const from = itemsById.get(connection.fromId);
                const to = itemsById.get(connection.toId);
                if (!from || !to) return null;
                const start = borderPoint(rectOf(to), rectOf(from));
                const end = borderPoint(rectOf(from), rectOf(to));
                const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
                const isSelected = selection?.type === 'connection' && selection.id === connection.id;
                return (
                  <g key={connection.id}>
                    {/* Invisible fat line: a 2px stroke is not a click target. */}
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
                        setSelection({ type: 'connection', id: connection.id });
                      }}
                    />
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke={isSelected ? theme.palette.primary.main : edgeColor}
                      strokeWidth={isSelected ? 3 : 2}
                      strokeDasharray={connection.style === 'dashed' ? '7 6' : undefined}
                      markerEnd={connection.style === 'arrow' ? 'url(#wb-arrowhead)' : undefined}
                    />
                    {connection.label && (
                      <text
                        x={mid.x}
                        y={mid.y - 6}
                        textAnchor="middle"
                        fontSize={13}
                        fill={theme.palette.text.secondary}
                        style={{ paintOrder: 'stroke', stroke: theme.palette.background.default, strokeWidth: 4 }}
                      >
                        {connection.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </Box>

          {ordered.map((item) => {
            const colors = swatchColors(theme, item.color);
            const isSelected = selection?.type === 'item' && selection.id === item.id;
            const isEditing = editingId === item.id;
            const isConnectSource = connectFrom === item.id;
            const isFrame = item.kind === 'frame';
            const isLabel = item.kind === 'label';
            return (
              <Box
                key={item.id}
                sx={{
                  position: 'absolute',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: isLabel ? 1 : isFrame ? 2 : 1.5,
                  p: isFrame ? 1 : 1.25,
                  cursor: isEditing ? 'text' : 'move',
                  bgcolor: isLabel ? 'transparent' : isFrame ? `${colors.accent}14` : colors.bg,
                  color: isLabel ? 'text.primary' : colors.text,
                  border: isFrame ? 2 : isLabel ? 1 : 0,
                  borderStyle: isFrame ? 'dashed' : 'solid',
                  borderColor: isFrame ? colors.accent : isLabel ? (isSelected ? 'primary.main' : 'transparent') : 'transparent',
                  boxShadow: isLabel || isFrame ? 'none' : 3,
                  outline: isSelected ? 2 : isConnectSource ? 2 : 0,
                  outlineStyle: 'solid',
                  outlineColor: isConnectSource ? 'secondary.main' : 'primary.main',
                  outlineOffset: 2,
                }}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                  zIndex: item.z + 1000,
                  transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
                }}
                onPointerDown={(e) => handleItemPointerDown(e, item)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setSelection({ type: 'item', id: item.id });
                  setEditingId(item.id);
                }}
              >
                {isEditing ? (
                  <Box
                    component="textarea"
                    autoFocus
                    value={item.text}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      // No history per keystroke - beginHistory ran when editing started.
                      update((d) => ({
                        ...d,
                        items: d.items.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)),
                      }))
                    }
                    onFocus={beginHistory}
                    onBlur={() => setEditingId(null)}
                    onPointerDown={(e: ReactPointerEvent) => e.stopPropagation()}
                    sx={{
                      flexGrow: 1,
                      width: '100%',
                      border: 0,
                      outline: 'none',
                      resize: 'none',
                      bgcolor: 'transparent',
                      color: 'inherit',
                      font: 'inherit',
                      fontFamily: 'inherit',
                      p: 0,
                    }}
                    style={{ fontSize: item.fontSize, fontWeight: isLabel ? 700 : 400 }}
                  />
                ) : (
                  <Typography
                    component="div"
                    sx={{
                      flexGrow: 1,
                      minHeight: 0,
                      overflow: 'hidden',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontWeight: isLabel ? 700 : 400,
                      opacity: item.text ? 1 : 0.55,
                      alignSelf: isFrame ? 'flex-start' : undefined,
                    }}
                    style={{ fontSize: item.fontSize }}
                  >
                    {item.text || (isFrame ? 'Frame' : isLabel ? 'Label' : 'Double-click to write…')}
                  </Typography>
                )}

                {isSelected && !isEditing && (
                  <Box
                    onPointerDown={(e) => handleResizePointerDown(e, item)}
                    sx={{
                      position: 'absolute',
                      right: -5,
                      bottom: -5,
                      width: 14,
                      height: 14,
                      borderRadius: '3px',
                      bgcolor: 'primary.main',
                      cursor: 'nwse-resize',
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>

        {doc.items.length === 0 && (
          <Stack
            spacing={1.5}
            sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
          >
            <StickyNote2Icon sx={{ fontSize: 56, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, textAlign: 'center' }}>
              An empty board. Add a sticky note, a label or a frame from the toolbar, then drag things around -
              double-click any item to write in it.
            </Typography>
          </Stack>
        )}

        {connecting && (
          <Paper
            elevation={4}
            sx={{ position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', px: 2, py: 0.75, borderRadius: 5 }}
          >
            <Typography variant="caption">
              {connectFrom ? 'Now click the item the arrow points at' : 'Click the item the arrow starts from'} · Esc to stop
            </Typography>
          </Paper>
        )}
      </Box>
    </Stack>
  );
}
