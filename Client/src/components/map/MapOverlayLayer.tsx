import { Layer, Group, Line, Circle, Wedge, Rect, RegularPolygon, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { AoEShape } from '../../types/shape';
import { AOE_SHAPE_OPACITY, CONE_ANGLE_DEGREES, DEFAULT_MARKER_WIDTH, STROKE_SHAPE_OPACITY, THIN_LINE_WIDTH } from '../../types/shape';
import type { GridType } from '../../types/map';
import type { StagePoint } from '../../utils/tokenDrag';

interface MapOverlayLayerProps {
  stageWidth: number;
  stageHeight: number;
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

function buildSquareGridLines(width: number, height: number, gridSize: number) {
  if (gridSize <= 0) return [];
  const lines: { points: number[]; key: string }[] = [];
  for (let x = 0; x <= width; x += gridSize) {
    lines.push({ key: `v-${x}`, points: [x, 0, x, height] });
  }
  for (let y = 0; y <= height; y += gridSize) {
    lines.push({ key: `h-${y}`, points: [0, y, width, y] });
  }
  return lines;
}

function buildHexCenters(width: number, height: number, gridSize: number) {
  const hexRadius = gridSize / 2;
  if (hexRadius <= 0) return [];
  const hexWidth = Math.sqrt(3) * hexRadius;
  const hexHeight = 2 * hexRadius;
  const vertSpacing = hexHeight * 0.75;
  const centers: { x: number; y: number; key: string }[] = [];
  let row = 0;
  for (let y = 0; y - hexHeight < height; y += vertSpacing, row++) {
    const xOffset = row % 2 === 1 ? hexWidth / 2 : 0;
    for (let x = xOffset; x - hexWidth < width; x += hexWidth) {
      centers.push({ x, y, key: `hex-${row}-${x}` });
    }
  }
  return centers;
}

export function MapOverlayLayer({
  stageWidth,
  stageHeight,
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
        {gridEnabled && gridType === 'square' &&
          buildSquareGridLines(stageWidth, stageHeight, gridSize).map((line) => (
            <Line key={line.key} points={line.points} stroke={gridColor} strokeWidth={gridThickness} listening={false} />
          ))}
        {gridEnabled && gridType === 'hex' &&
          buildHexCenters(stageWidth, stageHeight, gridSize).map((c) => (
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
