import { useMemo } from 'react';
import { Layer, Group, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { WallSegment } from '../../types/fog';
import { imagePointsToStage, type BackgroundFit } from '../../utils/mapFit';
import type { StagePoint } from '../../utils/tokenDrag';

interface MapWallsLayerProps {
  walls: WallSegment[];
  fit: BackgroundFit;
  /** Walls are DM scaffolding, not map content - they only draw while a wall
   * tool is active or the DM has explicitly asked to see them. */
  visible: boolean;
  /** true while the wall eraser is selected: makes each wall clickable. */
  interactive: boolean;
  onEraseWall: (wallId: string) => void;
  /** The wall currently being dragged out, flat [x,y,...] in IMAGE space. */
  draftWall: number[] | null;
  flipPivot: StagePoint;
  flippedHorizontal?: boolean;
  flippedVertical?: boolean;
  rotation?: number;
}

export const WALL_COLOR = '#38bdf8';
export const WALL_DRAFT_COLOR = '#f5c542';
const WALL_STROKE_WIDTH = 3;
/** Generous click target - a 3px line is near-impossible to hit on a zoomed-out map. */
const WALL_HIT_WIDTH = 14;

export function MapWallsLayer({
  walls,
  fit,
  visible,
  interactive,
  onEraseWall,
  draftWall,
  flipPivot,
  flippedHorizontal,
  flippedVertical,
  rotation,
}: MapWallsLayerProps) {
  const stageWalls = useMemo(
    () => walls.map((wall) => ({ id: wall.id, points: imagePointsToStage(wall.points, fit) })),
    [walls, fit],
  );

  const draftPoints = useMemo(
    () => (draftWall && draftWall.length >= 4 ? imagePointsToStage(draftWall, fit) : null),
    [draftWall, fit],
  );

  if (!visible && !draftPoints) return <Layer listening={false} />;

  const handleErase = (wallId: string) => (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!interactive) return;
    e.cancelBubble = true;
    onEraseWall(wallId);
  };

  return (
    <Layer listening={interactive}>
      <Group
        x={flipPivot.x}
        y={flipPivot.y}
        offsetX={flipPivot.x}
        offsetY={flipPivot.y}
        rotation={rotation ?? 0}
        scaleX={flippedHorizontal ? -1 : 1}
        scaleY={flippedVertical ? -1 : 1}
      >
        {visible &&
          stageWalls.map((wall) => (
            <Line
              key={wall.id}
              points={wall.points}
              stroke={WALL_COLOR}
              strokeWidth={WALL_STROKE_WIDTH}
              hitStrokeWidth={WALL_HIT_WIDTH}
              lineCap="round"
              lineJoin="round"
              opacity={0.9}
              listening={interactive}
              onClick={handleErase(wall.id)}
              onTap={handleErase(wall.id)}
            />
          ))}

        {draftPoints && (
          <Line
            points={draftPoints}
            stroke={WALL_DRAFT_COLOR}
            strokeWidth={WALL_STROKE_WIDTH}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )}
      </Group>
    </Layer>
  );
}
