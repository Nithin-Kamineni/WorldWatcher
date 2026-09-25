import { useMemo } from 'react';
import { Layer, Group, Line, Circle, Wedge, Rect, RegularPolygon, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { AoEShape } from '../../types/shape';
import { AOE_SHAPE_OPACITY, CONE_ANGLE_DEGREES, DEFAULT_MARKER_WIDTH, STROKE_SHAPE_OPACITY, THIN_LINE_WIDTH } from '../../types/shape';
import type { GridType } from '../../types/map';
import type { StagePoint } from '../../utils/tokenDrag';
import type { GridBounds } from '../../utils/mapFit';

interface MapOverlayLayerProps {
  /** The area to rule, in the Group's LOCAL (pre-rotation) space - see gridBoundsFor. */
  gridBounds: GridBounds;
  gridEnabled: boolean;
  gridSize: number;
  gridColor: string;
  gridThickness: number;
  gridType: GridType;
  shapes: AoEShape[];
  draftShape: AoEShape | null;
  eraserActive: boolean;
  onEraseShape: (shapeId: string) => void;
  rulerLine: { start: StagePoint; end: StagePoint } | null;
  flipPivot: StagePoint;
  flippedHorizontal?: boolean;
  flippedVertical?: boolean;
  rotation?: number;
}

function renderShape(shape: AoEShape, interactive: boolean, onErase?: (id: string) => void) {
  const handleClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!interactive || !onErase) return;
    e.cancelBubble = true;
    onErase(shape.id);
  };

  switch (shape.type) {
    case 'circle':
      return (
        <Circle
          key={shape.id}
          x={shape.x}
          y={shape.y}
          radius={shape.radius}
          fill={shape.color}
          opacity={AOE_SHAPE_OPACITY}
          listening={interactive}
          onClick={handleClick}
          onTap={handleClick}
        />
      );
    case 'cone':
      return (
        <Wedge
          key={shape.id}
          x={shape.x}
          y={shape.y}
          radius={shape.radius}
          angle={CONE_ANGLE_DEGREES}
          rotation={shape.rotation}
          fill={shape.color}
          opacity={AOE_SHAPE_OPACITY}
          listening={interactive}
          onClick={handleClick}
          onTap={handleClick}
        />
      );
    case 'square':
    case 'rectangle':
      return (
        <Rect
          key={shape.id}
          x={shape.x}
          y={shape.y}
          width={shape.width ?? 0}
          height={shape.height ?? 0}
          fill={shape.color}
          opacity={AOE_SHAPE_OPACITY}
          listening={interactive}
          onClick={handleClick}
          onTap={handleClick}
        />
      );
    case 'line':
    case 'thin-line':
    case 'freehand': {
      const strokeWidth =
        shape.strokeWidth ?? (shape.type === 'thin-line' ? THIN_LINE_WIDTH : DEFAULT_MARKER_WIDTH);
      return (
        <Line
          key={shape.id}
          x={shape.x}
          y={shape.y}
          points={shape.points ?? []}
          stroke={shape.color}
          strokeWidth={strokeWidth}
          opacity={STROKE_SHAPE_OPACITY}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(20, strokeWidth)}
          listening={interactive}
          onClick={handleClick}
          onTap={handleClick}
        />
      );
    }
    default:
      return null;
  }
}

/* Both builders keep the lattice ANCHORED AT THE ORIGIN and only widen how far it runs, so
   extending the bounds never shifts a single line - every token already standing on a square
   stays on that square. They used to start at 0 and stop at the canvas size, which is fine
   unrotated but at 90/270 the canvas rectangle, turned about its centre, only covers a
   centre band of the (now tall) visual area and of the rotated image. */
function buildSquareGridLines(bounds: GridBounds, gridSize: number) {
  if (gridSize <= 0) return [];
  const lines: { points: number[]; key: string }[] = [];
  const startX = Math.floor(bounds.minX / gridSize) * gridSize;
  const startY = Math.floor(bounds.minY / gridSize) * gridSize;
  for (let x = startX; x <= bounds.maxX; x += gridSize) {
    lines.push({ key: `v-${x}`, points: [x, bounds.minY, x, bounds.maxY] });
  }
  for (let y = startY; y <= bounds.maxY; y += gridSize) {
    lines.push({ key: `h-${y}`, points: [bounds.minX, y, bounds.maxX, y] });
  }
  return lines;
}

function buildHexCenters(bounds: GridBounds, gridSize: number) {
  const hexRadius = gridSize / 2;
  if (hexRadius <= 0) return [];
  const hexWidth = Math.sqrt(3) * hexRadius;
  const hexHeight = 2 * hexRadius;
  const vertSpacing = hexHeight * 0.75;
  const centers: { x: number; y: number; key: string }[] = [];
  // Rows are counted from the origin, not from the first visible row, so the odd-row offset
  // lands on the same rows it always did.
  for (let row = Math.floor((bounds.minY - hexHeight) / vertSpacing); row * vertSpacing - hexHeight < bounds.maxY; row++) {
    const y = row * vertSpacing;
    const xOffset = Math.abs(row % 2) === 1 ? hexWidth / 2 : 0;
    const firstCol = Math.floor((bounds.minX - hexWidth - xOffset) / hexWidth);
    for (let x = xOffset + firstCol * hexWidth; x - hexWidth < bounds.maxX; x += hexWidth) {
      centers.push({ x, y, key: `hex-${row}-${x}` });
    }
  }
  return centers;
}

export function MapOverlayLayer({
  gridBounds,
  gridEnabled,
  gridSize,
  gridColor,
  gridThickness,
  gridType,
  shapes,
  draftShape,
  eraserActive,
  onEraseShape,
  rulerLine,
  flipPivot,
  flippedHorizontal,
  flippedVertical,
  rotation,
}: MapOverlayLayerProps) {
  // Memoised: a large map is a few hundred Konva nodes, and this layer re-renders with the
  // page on every token move.
  const squareLines = useMemo(
    () => (gridEnabled && gridType === 'square' ? buildSquareGridLines(gridBounds, gridSize) : []),
    [gridEnabled, gridType, gridBounds, gridSize],
  );
  const hexCenters = useMemo(
    () => (gridEnabled && gridType === 'hex' ? buildHexCenters(gridBounds, gridSize) : []),
    [gridEnabled, gridType, gridBounds, gridSize],
  );

  const rulerDx = rulerLine ? rulerLine.end.x - rulerLine.start.x : 0;
  const rulerDy = rulerLine ? rulerLine.end.y - rulerLine.start.y : 0;
  const rulerDistance = Math.hypot(rulerDx, rulerDy);
  const rulerBoxes = gridSize > 0 ? rulerDistance / gridSize : 0;
  const rulerFeet = rulerBoxes * 5;
  const rulerMidX = rulerLine ? (rulerLine.start.x + rulerLine.end.x) / 2 : 0;
  const rulerMidY = rulerLine ? (rulerLine.start.y + rulerLine.end.y) / 2 : 0;

  return (
    <Layer listening={eraserActive}>
      <Group
        x={flipPivot.x}
        y={flipPivot.y}
        offsetX={flipPivot.x}
        offsetY={flipPivot.y}
        rotation={rotation ?? 0}
        scaleX={flippedHorizontal ? -1 : 1}
        scaleY={flippedVertical ? -1 : 1}
      >
        {squareLines.map((line) => (
          <Line key={line.key} points={line.points} stroke={gridColor} strokeWidth={gridThickness} listening={false} />
        ))}
        {hexCenters.map((c) => (
          <RegularPolygon
            key={c.key}
            x={c.x}
            y={c.y}
            sides={6}
            radius={gridSize / 2}
            stroke={gridColor}
            strokeWidth={gridThickness}
            listening={false}
          />
        ))}
        {shapes.map((shape) => renderShape(shape, eraserActive, onEraseShape))}
      </Group>

      {/* draft preview lives in raw/visual coordinates, matching the cursor exactly regardless of flip/rotation */}
      {draftShape && renderShape(draftShape, false)}

      {rulerLine && rulerDistance > 2 && (
        <>
          <Line
            points={[rulerLine.start.x, rulerLine.start.y, rulerLine.end.x, rulerLine.end.y]}
            stroke="#ffffff"
            strokeWidth={2}
            dash={[8, 6]}
            listening={false}
          />
          <Circle x={rulerLine.start.x} y={rulerLine.start.y} radius={4} fill="#ffffff" listening={false} />
          <Circle x={rulerLine.end.x} y={rulerLine.end.y} radius={4} fill="#ffffff" listening={false} />
          <Text
            x={rulerMidX}
            y={rulerMidY - 20}
            width={160}
            offsetX={80}
            align="center"
            text={`${rulerBoxes.toFixed(1)} (${rulerFeet.toFixed(1)} feet)`}
            fontSize={14}
            fontStyle="bold"
            fill="#ffffff"
            stroke="#000000"
            strokeWidth={0.5}
            fillAfterStrokeEnabled
            listening={false}
          />
        </>
      )}
    </Layer>
  );
}
