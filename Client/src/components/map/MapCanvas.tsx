import { useRef, useState, type RefObject } from 'react';
import { Stage } from 'react-konva';
import type Konva from 'konva';
import Box from '@mui/material/Box';
import { useResponsiveStageSize } from '../../hooks/useResponsiveStageSize';
import { useStagePanZoom } from '../../hooks/useStagePanZoom';
import { MapBackgroundLayer } from './MapBackgroundLayer';
import { MapObjectsLayer } from './MapObjectsLayer';
import { MapOverlayLayer } from './MapOverlayLayer';
import type { PlacedToken } from '../../types/token';
import type { AoEShape, AoEShapeType } from '../../types/shape';
import { CONE_ANGLE_DEGREES, DEFAULT_MARKER_WIDTH, THIN_LINE_WIDTH } from '../../types/shape';
import type { GridType } from '../../types/map';
import type { MapToolMode } from '../../types/tool';
import {
  ENCOUNTER_ENTRY_DRAG_MIME,
  FAVORITE_CREATURE_DRAG_MIME,
  TOKEN_DRAG_MIME,
  clientPointToStagePoint,
  type StagePoint,
} from '../../utils/tokenDrag';

interface MapCanvasProps {
  stageRef: RefObject<Konva.Stage | null>;
  backgroundImageSrc: string;
  tokens: PlacedToken[];
  onTokenMove: (id: string, x: number, y: number) => void;
  onTokenContextMenu: (token: PlacedToken, clientX: number, clientY: number) => void;
  onTokenStatsRequest: (token: PlacedToken) => void;
  gridEnabled: boolean;
  gridSize: number;
  gridColor: string;
  gridThickness: number;
  gridType: GridType;
  shapes: AoEShape[];
  activeTool: MapToolMode;
  shapeColor: string;
  markerWidth: number;
  onShapeComplete: (shape: AoEShape) => void;
  onEraseShape: (shapeId: string) => void;
  onDropToken: (tokenDefId: string, point: StagePoint) => void;
  onDropEncounterCreature?: (entryId: string, point: StagePoint) => void;
  onDropFavoriteCreature?: (creatureId: string, point: StagePoint) => void;
  flippedHorizontal?: boolean;
  flippedVertical?: boolean;
  rotation?: number;
}

const MIN_DRAFT_SIZE = 6;

const AOE_TOOL_TO_SHAPE: Partial<Record<MapToolMode, AoEShapeType>> = {
  'aoe-circle': 'circle',
  'aoe-cone': 'cone',
  'aoe-square': 'square',
  'aoe-rectangle': 'rectangle',
  'aoe-line': 'line',
  'aoe-line-thin': 'thin-line',
};

function isDraftBigEnough(shape: AoEShape): boolean {
  switch (shape.type) {
    case 'circle':
    case 'cone':
      return shape.radius > MIN_DRAFT_SIZE;
    case 'square':
      return Math.abs(shape.width ?? 0) > MIN_DRAFT_SIZE || Math.abs(shape.height ?? 0) > MIN_DRAFT_SIZE;
    case 'rectangle':
      return Math.abs(shape.width ?? 0) > MIN_DRAFT_SIZE && Math.abs(shape.height ?? 0) > MIN_DRAFT_SIZE;
    case 'line':
    case 'thin-line': {
      const pts = shape.points ?? [];
      const ex = pts[2] ?? 0;
      const ey = pts[3] ?? 0;
      return Math.hypot(ex, ey) > MIN_DRAFT_SIZE;
    }
    case 'freehand':
      return (shape.points?.length ?? 0) >= 4;
    default:
      return false;
  }
}

interface FloorTransform {
  pivot: StagePoint;
  flippedHorizontal?: boolean;
  flippedVertical?: boolean;
  rotation?: number;
}

/** Standard 2D rotation of a vector by `deg` degrees. */
function rotateVec(x: number, y: number, deg: number): StagePoint {
  if (!deg) return { x, y };
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/**
 * Converts a point in VISUAL (screen/rendered) stage space into LOCAL
 * (stored) space, undoing the same rotate+flip transform the render-time
 * Konva Group applies around `pivot`. Self-consistent with `toLocalVector`.
 */
function toLocalPoint(visual: StagePoint, t: FloorTransform): StagePoint {
  const v = toLocalVector(visual.x - t.pivot.x, visual.y - t.pivot.y, t);
  return { x: t.pivot.x + v.x, y: t.pivot.y + v.y };
}

/** Same as `toLocalPoint` but for a direction/offset vector (no translation). */
function toLocalVector(dx: number, dy: number, t: FloorTransform): StagePoint {
  const unrotated = rotateVec(dx, dy, -(t.rotation ?? 0));
  return {
    x: t.flippedHorizontal ? -unrotated.x : unrotated.x,
    y: t.flippedVertical ? -unrotated.y : unrotated.y,
  };
}

/** Converts a freshly-drafted (visual-space) shape into local/stored space. */
function toStoredShape(shape: AoEShape, t: FloorTransform): AoEShape {
  const { x, y } = toLocalPoint({ x: shape.x, y: shape.y }, t);
  const result: AoEShape = { ...shape, x, y };

  if (shape.width !== undefined || shape.height !== undefined) {
    const v = toLocalVector(shape.width ?? 0, shape.height ?? 0, t);
    result.width = v.x;
    result.height = v.y;
  }

  if (shape.points) {
    const pts: number[] = [];
    for (let i = 0; i < shape.points.length; i += 2) {
      const v = toLocalVector(shape.points[i], shape.points[i + 1], t);
      pts.push(v.x, v.y);
    }
    result.points = pts;
  }

  if (shape.type === 'cone') {
    const angleRad = ((shape.rotation + CONE_ANGLE_DEGREES / 2) * Math.PI) / 180;
    const dir = toLocalVector(Math.cos(angleRad), Math.sin(angleRad), t);
    const newAngleDeg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    result.rotation = newAngleDeg - CONE_ANGLE_DEGREES / 2;
  }

  return result;
}

export function MapCanvas({
  stageRef,
  backgroundImageSrc,
  tokens,
  onTokenMove,
  onTokenContextMenu,
  onTokenStatsRequest,
  gridEnabled,
  gridSize,
  gridColor,
  gridThickness,
  gridType,
  shapes,
  activeTool,
  shapeColor,
  markerWidth,
  onShapeComplete,
  onEraseShape,
  onDropToken,
  onDropEncounterCreature,
  onDropFavoriteCreature,
  flippedHorizontal,
  flippedVertical,
  rotation,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useResponsiveStageSize(containerRef);
  const { onWheel, onTouchMove, onTouchEnd } = useStagePanZoom();

  const isRulerTool = activeTool === 'ruler';
  const isMarkerTool = activeTool === 'marker';
  const isAoEDrawTool = activeTool in AOE_TOOL_TO_SHAPE;
  const isDrawingTool = isAoEDrawTool || isMarkerTool;

  const draftStart = useRef<StagePoint | null>(null);
  const [draftShape, setDraftShape] = useState<AoEShape | null>(null);

  const rulerStart = useRef<StagePoint | null>(null);
  const [rulerLine, setRulerLine] = useState<{ start: StagePoint; end: StagePoint } | null>(null);

  // The rotate/flip pivot must stay fixed relative to the floor's content, not the live
  // container size - otherwise resizing the container (e.g. opening/closing the sidebar)
  // while flipped/rotated shifts the pivot and visibly drags the whole floor (background,
  // tokens, grid, shapes) with it. Freeze it to the first valid measurement per floor.
  const pivotSizeRef = useRef<{ src: string; width: number; height: number } | null>(null);
  if (width > 0 && height > 0 && pivotSizeRef.current?.src !== backgroundImageSrc) {
    pivotSizeRef.current = { src: backgroundImageSrc, width, height };
  }
  const pivotSize = pivotSizeRef.current?.src === backgroundImageSrc ? pivotSizeRef.current : { width, height };
  const flipPivot = { x: pivotSize.width / 2, y: pivotSize.height / 2 };
  const transform: FloorTransform = { pivot: flipPivot, flippedHorizontal, flippedVertical, rotation };

  const getStagePoint = (): StagePoint | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const scale = stage.scaleX() || 1;
    return { x: (pointer.x - stage.x()) / scale, y: (pointer.y - stage.y()) / scale };
  };

  const handleMouseDown = () => {
    const point = getStagePoint();
    if (!point) return;

    if (isRulerTool) {
      rulerStart.current = point;
      setRulerLine({ start: point, end: point });
      return;
    }

    if (!isDrawingTool) return;
    draftStart.current = point;

    if (isMarkerTool) {
      setDraftShape({
        id: 'draft',
        type: 'freehand',
        x: point.x,
        y: point.y,
        radius: 0,
        rotation: 0,
        color: shapeColor,
        points: [0, 0],
        strokeWidth: markerWidth,
      });
      return;
    }

    const type = AOE_TOOL_TO_SHAPE[activeTool];
    if (!type) return;
    setDraftShape({
      id: 'draft',
      type,
      x: point.x,
      y: point.y,
      radius: 0,
      rotation: 0,
      color: shapeColor,
      width: 0,
      height: 0,
      strokeWidth: type === 'thin-line' ? THIN_LINE_WIDTH : type === 'line' ? DEFAULT_MARKER_WIDTH : undefined,
      points: type === 'line' || type === 'thin-line' ? [0, 0] : undefined,
    });
  };

  const handleMouseMove = () => {
    if (isRulerTool) {
      if (!rulerStart.current) return;
      const point = getStagePoint();
      if (!point) return;
      setRulerLine({ start: rulerStart.current, end: point });
      return;
    }

    if (!draftStart.current) return;
    const point = getStagePoint();
    if (!point) return;
    const dx = point.x - draftStart.current.x;
    const dy = point.y - draftStart.current.y;

    setDraftShape((prev) => {
      if (!prev) return prev;
      switch (prev.type) {
        case 'freehand':
          return { ...prev, points: [...(prev.points ?? []), dx, dy] };
        case 'circle':
          return { ...prev, radius: Math.hypot(dx, dy) };
        case 'cone': {
          const radius = Math.hypot(dx, dy);
          const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
          return { ...prev, radius, rotation: angleDeg - CONE_ANGLE_DEGREES / 2 };
        }
        case 'square': {
          const side = Math.max(Math.abs(dx), Math.abs(dy));
          return { ...prev, width: side * Math.sign(dx || 1), height: side * Math.sign(dy || 1) };
        }
        case 'rectangle':
          return { ...prev, width: dx, height: dy };
        case 'line':
        case 'thin-line':
          return { ...prev, points: [0, 0, dx, dy] };
        default:
          return prev;
      }
    });
  };

  const handleMouseUp = () => {
    if (isRulerTool) {
      rulerStart.current = null;
      setRulerLine(null);
      return;
    }
    if (draftStart.current && draftShape && isDraftBigEnough(draftShape)) {
      const stored = toStoredShape(draftShape, transform);
      onShapeComplete({ ...stored, id: crypto.randomUUID() });
    }
    draftStart.current = null;
    setDraftShape(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!containerRef.current || !stage) return;

    const entryId = e.dataTransfer.getData(ENCOUNTER_ENTRY_DRAG_MIME);
    if (entryId && onDropEncounterCreature) {
      const raw = clientPointToStagePoint(e.clientX, e.clientY, containerRef.current, stage);
      onDropEncounterCreature(entryId, toLocalPoint(raw, transform));
      return;
    }

    const favoriteCreatureId = e.dataTransfer.getData(FAVORITE_CREATURE_DRAG_MIME);
    if (favoriteCreatureId && onDropFavoriteCreature) {
      const raw = clientPointToStagePoint(e.clientX, e.clientY, containerRef.current, stage);
      onDropFavoriteCreature(favoriteCreatureId, toLocalPoint(raw, transform));
      return;
    }

    const tokenId = e.dataTransfer.getData(TOKEN_DRAG_MIME);
    if (!tokenId) return;
    const raw = clientPointToStagePoint(e.clientX, e.clientY, containerRef.current, stage);
    onDropToken(tokenId, toLocalPoint(raw, transform));
  };

  const handleTokenContextMenu = (token: PlacedToken, clientX: number, clientY: number) => {
    onTokenContextMenu(token, clientX, clientY);
  };

  const cursor = activeTool === 'select' ? 'default' : 'crosshair';

  return (
    <Box
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{
        flexGrow: 1,
        width: '100%',
        minHeight: 0,
        bgcolor: 'background.paper',
        borderRadius: 2,
        overflow: 'hidden',
        touchAction: 'none',
        cursor,
      }}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        draggable={activeTool === 'select'}
        onWheel={onWheel}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <MapBackgroundLayer
          src={backgroundImageSrc}
          stageWidth={width}
          stageHeight={height}
          flipPivot={flipPivot}
          flippedHorizontal={flippedHorizontal}
          flippedVertical={flippedVertical}
          rotation={rotation}
        />
        <MapObjectsLayer
          tokens={tokens}
          onTokenMove={onTokenMove}
          onTokenContextMenu={handleTokenContextMenu}
          onTokenStatsRequest={onTokenStatsRequest}
          flipPivot={flipPivot}
          flippedHorizontal={flippedHorizontal}
          flippedVertical={flippedVertical}
          rotation={rotation}
        />
        <MapOverlayLayer
          stageWidth={width}
          stageHeight={height}
          gridEnabled={gridEnabled}
          gridSize={gridSize}
          gridColor={gridColor}
          gridThickness={gridThickness}
          gridType={gridType}
          shapes={shapes}
          draftShape={draftShape}
          eraserActive={activeTool === 'eraser'}
          onEraseShape={onEraseShape}
          rulerLine={rulerLine}
          flipPivot={flipPivot}
          flippedHorizontal={flippedHorizontal}
          flippedVertical={flippedVertical}
          rotation={rotation}
        />
      </Stage>
    </Box>
  );
}
