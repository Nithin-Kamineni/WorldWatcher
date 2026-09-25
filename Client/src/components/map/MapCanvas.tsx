import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Stage } from 'react-konva';
import type Konva from 'konva';
import Box from '@mui/material/Box';
import useImage from 'use-image';
import { useResponsiveStageSize } from '../../hooks/useResponsiveStageSize';
import { useStagePanZoom } from '../../hooks/useStagePanZoom';
import { MapBackgroundLayer } from './MapBackgroundLayer';
import { MapObjectsLayer } from './MapObjectsLayer';
import { MapOverlayLayer } from './MapOverlayLayer';
import { MapFogLayer, type FogBrushStroke } from './MapFogLayer';
import { MapWallsLayer } from './MapWallsLayer';
import type { PlacedToken } from '../../types/token';
import type { AoEShape, AoEShapeType } from '../../types/shape';
import { CONE_ANGLE_DEGREES, DEFAULT_MARKER_WIDTH, THIN_LINE_WIDTH } from '../../types/shape';
import type { GridType } from '../../types/map';
import type { FogState, WallSegment } from '../../types/fog';
import type { MapToolMode } from '../../types/tool';
import { computeBackgroundFit, gridBoundsFor, stagePointToImage, type BackgroundFit } from '../../utils/mapFit';
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
  onTokenSelect: (token: PlacedToken, additive: boolean) => void;
  selectedTokenIds: string[];
  onClearSelection: () => void;
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
  /** Bump to re-frame the authored canvas in the current viewport, discarding whatever the
   * DM has panned/zoomed to. Reset View uses it. It no longer recomputes the background fit
   * - that is a pure function of the authored size now, so there is nothing to reset. */
  fitResetEpoch?: number;
  // --- fog of war ---
  fog: FogState;
  walls: WallSegment[];
  /** Line-of-sight polygons, flat [x,y,...] in image space, one per seeing token. */
  visionPolygons: number[][];
  showWalls: boolean;
  playerPreview: boolean;
  fogBrushRadius: number;
  /** Fires once per completed brush stroke, with every point the pointer
   * visited in image space - see the painting note in handleMouseUp. */
  onFogPaint: (imagePoints: StagePoint[], radius: number, reveal: boolean) => void;
  onWallComplete: (imagePoints: number[]) => void;
  onEraseWall: (wallId: string) => void;
  /** Reports the background fit upward; MapPage needs it to run line-of-sight and to
   * place auto-detected walls. */
  onFitChange: (fit: BackgroundFit | null) => void;
  /** The canvas size this floor's tokens/shapes were authored against - see
   * MapFloor.authoredStage. Undefined on a floor that predates it. */
  authoredStage?: { width: number; height: number };
  /** Fired once for a floor that has no authored size yet, with the size to adopt. */
  onAuthoredStageResolved: (size: { width: number; height: number }) => void;
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
  onTokenSelect,
  selectedTokenIds,
  onClearSelection,
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
  fitResetEpoch = 0,
  fog,
  walls,
  visionPolygons,
  showWalls,
  playerPreview,
  fogBrushRadius,
  onFogPaint,
  onWallComplete,
  onEraseWall,
  onFitChange,
  authoredStage,
  onAuthoredStageResolved,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useResponsiveStageSize(containerRef);
  const { onWheel, onTouchMove, onTouchEnd } = useStagePanZoom();
  const [image] = useImage(backgroundImageSrc);

  const isRulerTool = activeTool === 'ruler';
  const isMarkerTool = activeTool === 'marker';
  const isAoEDrawTool = activeTool in AOE_TOOL_TO_SHAPE;
  const isDrawingTool = isAoEDrawTool || isMarkerTool;
  const isFogBrush = activeTool === 'fog-reveal' || activeTool === 'fog-hide';
  const isWallDraw = activeTool === 'wall-draw';

  const draftStart = useRef<StagePoint | null>(null);
  const [draftShape, setDraftShape] = useState<AoEShape | null>(null);

  const rulerStart = useRef<StagePoint | null>(null);
  const [rulerLine, setRulerLine] = useState<{ start: StagePoint; end: StagePoint } | null>(null);

  const fogStroke = useRef<StagePoint[] | null>(null);
  const [fogPreview, setFogPreview] = useState<FogBrushStroke | null>(null);
  const wallStart = useRef<StagePoint | null>(null);
  const [draftWall, setDraftWall] = useState<number[] | null>(null);

  // EVERYTHING below is laid out against the AUTHORED canvas size, never the live one.
  //
  // Tokens, shapes and the grid are stored in raw stage pixels. If the background's fit were
  // computed from the live canvas, opening the map at any other window size would re-fit the
  // background while the tokens kept their old numbers - which is exactly the bug where a
  // token reappears somewhere else. Pinning the authored size makes the fit a pure function
  // of stored data, so a token's coordinates mean the same thing forever, and adapting to
  // the window that is actually open becomes one transform on the Stage (below) that moves
  // the background and the tokens together.
  const authoredW = authoredStage?.width ?? (width > 0 ? width : 0);
  const authoredH = authoredStage?.height ?? (height > 0 ? height : 0);
  const hasAuthored = authoredW > 0 && authoredH > 0;

  // A floor with no authored size yet is being opened for the first time since this became
  // viewport-independent: adopt the current canvas, which pins every existing token exactly
  // where it renders right now, and persist it so it never shifts again.
  useEffect(() => {
    if (!authoredStage && authoredW > 0 && authoredH > 0) {
      onAuthoredStageResolved({ width: authoredW, height: authoredH });
    }
  }, [authoredStage, authoredW, authoredH, onAuthoredStageResolved]);

  // Memoised because it is a prop on EVERY layer. As a fresh object literal it changed
  // identity on each render, so react-konva re-applied it to all five Groups and Konva
  // marked all five layers dirty - including a full redraw of the scaled background bitmap -
  // every time anything on the page changed, e.g. a token moving.
  const flipPivot = useMemo(() => ({ x: authoredW / 2, y: authoredH / 2 }), [authoredW, authoredH]);
  const transform: FloorTransform = { pivot: flipPivot, flippedHorizontal, flippedVertical, rotation };

  const fit = useMemo(
    () => (image && hasAuthored ? computeBackgroundFit(authoredW, authoredH, image.width, image.height, rotation) : null),
    [image, hasAuthored, authoredW, authoredH, rotation],
  );

  // Memoised for the same reason as flipPivot: it feeds the grid's line memo.
  const gridBounds = useMemo(() => gridBoundsFor(authoredW, authoredH, rotation, fit), [authoredW, authoredH, rotation, fit]);

  useEffect(() => {
    onFitChange(fit);
  }, [fit, onFitChange]);

  // Contain-fit the authored canvas into whatever the window actually gives us. This is a
  // Stage transform, so it scales background, tokens, grid and fog as one - nothing moves
  // relative to anything else. Reapplied when the container resizes or Reset View bumps the
  // epoch, which does mean a resize re-frames the map; that is the same thing every map
  // viewer does, and the alternative is content drifting out of view.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !hasAuthored || width <= 0 || height <= 0) return;
    const scale = Math.min(width / authoredW, height / authoredH);
    stage.scale({ x: scale, y: scale });
    stage.position({ x: (width - authoredW * scale) / 2, y: (height - authoredH * scale) / 2 });
    stage.batchDraw();
  }, [stageRef, hasAuthored, authoredW, authoredH, width, height, fitResetEpoch]);

  const getStagePoint = (): StagePoint | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const scale = stage.scaleX() || 1;
    return { x: (pointer.x - stage.x()) / scale, y: (pointer.y - stage.y()) / scale };
  };

  /** Visual stage point -> image-pixel space, the space walls and fog live in. */
  const getImagePoint = (): StagePoint | null => {
    if (!fit) return null;
    const visual = getStagePoint();
    if (!visual) return null;
    const local = toLocalPoint(visual, transform);
    return stagePointToImage(local.x, local.y, fit);
  };

  const handleMouseDown = () => {
    if (isFogBrush) {
      const point = getImagePoint();
      if (!point) return;
      fogStroke.current = [point];
      setFogPreview({ points: [point], radius: fogBrushRadius, reveal: activeTool === 'fog-reveal' });
      return;
    }

    if (isWallDraw) {
      const point = getImagePoint();
      if (!point) return;
      wallStart.current = point;
      setDraftWall([point.x, point.y, point.x, point.y]);
      return;
    }

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
    if (isFogBrush) {
      if (!fogStroke.current) return;
      const point = getImagePoint();
      if (!point) return;
      fogStroke.current.push(point);
      setFogPreview({
        points: [...fogStroke.current],
        radius: fogBrushRadius,
        reveal: activeTool === 'fog-reveal',
      });
      return;
    }

    if (isWallDraw) {
      if (!wallStart.current) return;
      const point = getImagePoint();
      if (!point) return;
      setDraftWall([wallStart.current.x, wallStart.current.y, point.x, point.y]);
      return;
    }

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
    // A brush stroke is applied to the stored mask ONCE, on release, rather than per
    // pointer-move: every floor mutation round-trips a PATCH through mapSync, and a single
    // drag across the map is easily 200 moves. The live feedback during the drag comes from
    // fogPreview, which the fog layer paints on top of the committed mask.
    if (isFogBrush) {
      const stroke = fogStroke.current;
      fogStroke.current = null;
      setFogPreview(null);
      if (stroke && stroke.length > 0) {
        onFogPaint(stroke, fogBrushRadius, activeTool === 'fog-reveal');
      }
      return;
    }

    if (isWallDraw) {
      const start = wallStart.current;
      wallStart.current = null;
      const draft = draftWall;
      setDraftWall(null);
      if (start && draft && Math.hypot(draft[2] - draft[0], draft[3] - draft[1]) > MIN_DRAFT_SIZE) {
        onWallComplete(draft);
      }
      return;
    }

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

  // Clicking empty canvas (the stage itself, not a token/shape) clears the multi-select -
  // only fires when the event target IS the stage, so token clicks (handled in
  // MapObjectsLayer) never bubble into clearing the selection they just set.
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) onClearSelection();
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
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <MapBackgroundLayer
          src={backgroundImageSrc}
          fit={fit}
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
          onTokenSelect={onTokenSelect}
          selectedTokenIds={selectedTokenIds}
          flipPivot={flipPivot}
          flippedHorizontal={flippedHorizontal}
          flippedVertical={flippedVertical}
          rotation={rotation}
        />
        {/* The grid is laid out against the AUTHORED canvas, not the live one: it is content,
            and has to line up with the tokens standing on it whatever the window size. Its
            extent also covers the rotated image - see gridBoundsFor. */}
        <MapOverlayLayer
          gridBounds={gridBounds}
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
        {/* Fog sits above the grid and the tokens so that "preview as players see it" is
            honest. In the DM's own view the whole layer is translucent, so tokens and
            terrain stay readable underneath it. */}
        {fit && (
          <MapFogLayer
            fog={fog}
            fit={fit}
            visionPolygons={visionPolygons}
            brushPreview={fogPreview}
            playerPreview={playerPreview}
            flipPivot={flipPivot}
            flippedHorizontal={flippedHorizontal}
            flippedVertical={flippedVertical}
            rotation={rotation}
          />
        )}
        {fit && (
          <MapWallsLayer
            walls={walls}
            fit={fit}
            visible={showWalls}
            interactive={activeTool === 'wall-erase'}
            onEraseWall={onEraseWall}
            draftWall={draftWall}
            flipPivot={flipPivot}
            flippedHorizontal={flippedHorizontal}
            flippedVertical={flippedVertical}
            rotation={rotation}
          />
        )}
      </Stage>
    </Box>
  );
}
