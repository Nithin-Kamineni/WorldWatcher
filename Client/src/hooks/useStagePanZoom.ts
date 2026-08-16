import { useRef, type RefObject } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

const SCALE_BY = 1.05;
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function getDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

function getCenter(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

/**
 * Minimal best-effort pan/zoom: desktop wheel-zoom centered on the pointer,
 * plus two-finger pinch-zoom/pan on touch. No grid-snap or momentum.
 */
export function useStagePanZoom() {
  const lastPinchDistance = useRef(0);
  const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = clampScale(direction > 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY);

    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
    stage.batchDraw();
  };

  const onTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const touches = e.evt.touches;
    if (touches.length !== 2) return;
    e.evt.preventDefault();

    const p1 = { x: touches[0].clientX, y: touches[0].clientY };
    const p2 = { x: touches[1].clientX, y: touches[1].clientY };
    const distance = getDistance(p1, p2);
    const center = getCenter(p1, p2);

    if (!lastPinchDistance.current || !lastPinchCenter.current) {
      lastPinchDistance.current = distance;
      lastPinchCenter.current = center;
      return;
    }

    const oldScale = stage.scaleX();
    const newScale = clampScale(oldScale * (distance / lastPinchDistance.current));

    const stageBox = stage.container().getBoundingClientRect();
    const localCenter = { x: center.x - stageBox.left, y: center.y - stageBox.top };
    const pointTo = {
      x: (localCenter.x - stage.x()) / oldScale,
      y: (localCenter.y - stage.y()) / oldScale,
    };

    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: localCenter.x - pointTo.x * newScale,
      y: localCenter.y - pointTo.y * newScale,
    });
    stage.batchDraw();

    lastPinchDistance.current = distance;
    lastPinchCenter.current = center;
  };

  const onTouchEnd = () => {
    lastPinchDistance.current = 0;
    lastPinchCenter.current = null;
  };

  return { onWheel, onTouchMove, onTouchEnd };
}

export type StageRef = RefObject<Konva.Stage | null>;
