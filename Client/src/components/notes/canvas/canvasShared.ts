import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { Theme } from '@mui/material/styles';
import { MAX_ZOOM, MIN_ZOOM, swatchById, type CanvasView } from '../../../types/noteCanvas';

/** Pieces both canvas editors (whiteboard, content tree) share, so the two surfaces pan,
 * zoom, look and feel like one feature rather than two that happen to sit in the same menu. */

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const rectCenter = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** Where the line joining two boxes' centres crosses the border of `to` - so an arrow stops at
 * the edge of the sticky it points at instead of disappearing underneath it. */
export function borderPoint(from: Rect, to: Rect): { x: number; y: number } {
  const a = rectCenter(from);
  const b = rectCenter(to);
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  if (dx === 0 && dy === 0) return b;
  const halfW = to.width / 2;
  const halfH = to.height / 2;
  // How far along the centre-to-centre direction the box's own border sits: whichever axis
  // runs out first is the side the line leaves through.
  const scale = Math.min(dx === 0 ? Infinity : halfW / Math.abs(dx), dy === 0 ? Infinity : halfH / Math.abs(dy));
  return { x: b.x + dx * scale, y: b.y + dy * scale };
}

/** The SVG edge layer is positioned at the canvas origin and its contents are shifted by this
 * much, so edges between items at negative coordinates (perfectly normal once you drag left of
 * where you started) are still inside the SVG's own box and get painted. */
export const SVG_ORIGIN = 4000;

/** The shared canvas backdrop: a dot grid that pans and zooms with the content, so dragging
 * something actually looks like moving over a surface. */
export function canvasSurfaceSx(theme: Theme, view: CanvasView) {
  const dark = theme.palette.mode === 'dark';
  const dot = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.13)';
  const step = 26 * view.zoom;
  return {
    bgcolor: dark ? '#10141a' : '#f4f6f8',
    backgroundImage: `radial-gradient(${dot} 1px, transparent 1px)`,
    backgroundSize: `${step}px ${step}px`,
    backgroundPosition: `${view.x}px ${view.y}px`,
  } as const;
}

export interface ViewportApi {
  ref: RefObject<HTMLDivElement | null>;
  /** Client (screen) coordinates to canvas coordinates. */
  toCanvas: (clientX: number, clientY: number) => { x: number; y: number };
  /** The canvas point at the middle of what's on screen - where a newly added item lands, so
   * "Add sticky" never drops one off-screen. */
  center: () => { x: number; y: number };
  /** Pointer-down on empty canvas: grab-pans until the pointer is released. */
  startPan: (e: ReactPointerEvent) => void;
  zoomBy: (factor: number) => void;
  setZoom: (zoom: number) => void;
  panning: boolean;
}

/** Pan/zoom for a canvas: drag empty space to pan, wheel to pan, ctrl/⌘+wheel (or a trackpad
 * pinch, which arrives as the same event) to zoom about the cursor. */
export function useCanvasViewport(view: CanvasView, onChange: (next: CanvasView) => void): ViewportApi {
  const ref = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [panning, setPanning] = useState(false);

  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    const v = viewRef.current;
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return { x: (clientX - left - v.x) / v.zoom, y: (clientY - top - v.y) / v.zoom };
  }, []);

  const center = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    const v = viewRef.current;
    return { x: ((rect?.width ?? 800) / 2 - v.x) / v.zoom, y: ((rect?.height ?? 600) / 2 - v.y) / v.zoom };
  }, []);

  /** Zoom about a point given in element-local pixels, keeping whatever is under it still. */
  const zoomAt = useCallback((nextZoom: number, px: number, py: number) => {
    const v = viewRef.current;
    const zoom = clampZoom(nextZoom);
    if (zoom === v.zoom) return;
    const k = zoom / v.zoom;
    onChangeRef.current({ zoom, x: px - k * (px - v.x), y: py - k * (py - v.y) });
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const rect = ref.current?.getBoundingClientRect();
      zoomAt(viewRef.current.zoom * factor, (rect?.width ?? 800) / 2, (rect?.height ?? 600) / 2);
    },
    [zoomAt],
  );

  const setZoom = useCallback(
    (zoom: number) => {
      const rect = ref.current?.getBoundingClientRect();
      zoomAt(zoom, (rect?.width ?? 800) / 2, (rect?.height ?? 600) / 2);
    },
    [zoomAt],
  );

  // Attached by hand rather than with onWheel, because React's wheel listener is passive: a
  // preventDefault() from it is ignored and the whole page scrolls while you zoom the board.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(viewRef.current.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - rect.left, e.clientY - rect.top);
        return;
      }
      const v = viewRef.current;
      onChangeRef.current({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const startPan = useCallback((e: ReactPointerEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = viewRef.current;
    setPanning(true);
    const move = (ev: PointerEvent) => {
      onChangeRef.current({ ...viewRef.current, x: origin.x + (ev.clientX - startX), y: origin.y + (ev.clientY - startY) });
    };
    const up = () => {
      setPanning(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  return { ref, toCanvas, center, startPan, zoomBy, setZoom, panning };
}

/** Runs a pointer drag on window listeners rather than the element's own, so the gesture
 * survives the pointer leaving the item (or the canvas) mid-drag. */
export function dragWithPointer(
  e: ReactPointerEvent,
  onMove: (deltaX: number, deltaY: number, ev: PointerEvent) => void,
  onEnd?: () => void,
) {
  const startX = e.clientX;
  const startY = e.clientY;
  const move = (ev: PointerEvent) => onMove(ev.clientX - startX, ev.clientY - startY, ev);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    onEnd?.();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/** Fill + text colour for a swatch in the active theme. */
export function swatchColors(theme: Theme, id: string) {
  const swatch = swatchById(id);
  const dark = theme.palette.mode === 'dark';
  return { bg: dark ? swatch.dark : swatch.light, text: dark ? swatch.darkText : swatch.lightText, accent: swatch.accent };
}
