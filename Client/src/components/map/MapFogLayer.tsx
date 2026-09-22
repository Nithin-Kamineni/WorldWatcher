import { useMemo } from 'react';
import { Layer, Group, Rect, Line, Circle, Image as KonvaImage } from 'react-konva';
import type { FogState } from '../../types/fog';
import { FOG_COLOR, FOG_DM_OPACITY, FOG_EXPLORED_OPACITY, FOG_PLAYER_OPACITY } from '../../types/fog';
import { decodeFogGrid } from '../../utils/fogMask';
import { imagePointsToStage, type BackgroundFit } from '../../utils/mapFit';
import type { StagePoint } from '../../utils/tokenDrag';

/** The in-progress reveal/hide brush drag, in image space. Not committed to
 * the mask until the pointer is released - see MapCanvas's handleMouseUp. */
export interface FogBrushStroke {
  points: StagePoint[];
  radius: number;
  reveal: boolean;
}

interface MapFogLayerProps {
  fog: FogState;
  fit: BackgroundFit;
  /** Each token's line-of-sight polygon, flat [x,y,...] in IMAGE space. */
  visionPolygons: number[][];
  brushPreview: FogBrushStroke | null;
  /** false renders the translucent DM view, true the opaque player view. */
  playerPreview: boolean;
  flipPivot: StagePoint;
  flippedHorizontal?: boolean;
  flippedVertical?: boolean;
  rotation?: number;
}

/**
 * Fog of war, drawn as a single sheet with holes punched in it.
 *
 * The whole image gets covered, then two rounds of `destination-out` cut it
 * back: the explored mask partially (leaving FOG_EXPLORED_OPACITY behind - the
 * "you have been here but cannot see it now" tier), and the live
 * line-of-sight polygons completely. Order matters: the vision polygons run
 * second so an area that is both explored and currently visible ends up
 * fully clear rather than dimmed.
 *
 * This works because the fog owns its own Konva Layer, i.e. its own canvas:
 * `destination-out` only erases fog, never the background or the tokens
 * underneath.
 */
export function MapFogLayer({
  fog,
  fit,
  visionPolygons,
  brushPreview,
  playerPreview,
  flipPivot,
  flippedHorizontal,
  flippedVertical,
  rotation,
}: MapFogLayerProps) {
  const { imageWidth, imageHeight, scale } = fit;

  /**
   * The explored mask as ONE bitmap rather than one Konva node per cell.
   *
   * This started out merging set cells into horizontal runs and drawing a Rect
   * per run. On a real map that was ~350 Rects, each with its own
   * `destination-out`, reconciled and redrawn every time a token moved - which
   * cost a ~260ms frame and made dragging a token unusable. The mask is only
   * 90x120 cells, so painting it into a canvas that size and letting the GPU
   * scale it up is one node and one composite operation instead.
   *
   * Scaling a 90x120 bitmap up to the full map also interpolates, which softens
   * the reveal boundary - the blocky cell edges the Rect version had are gone.
   */
  const exploredMask = useMemo(() => {
    const grid = decodeFogGrid(fog);
    if (!grid) return null;

    const canvas = document.createElement('canvas');
    canvas.width = grid.cols;
    canvas.height = grid.rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const image = ctx.createImageData(grid.cols, grid.rows);
    // createImageData zeroes every channel, so leaving RGB at 0 and setting
    // only alpha gives the black-with-alpha that destination-out wants.
    const alpha = Math.round((1 - FOG_EXPLORED_OPACITY) * 255);
    let any = false;
    for (let i = 0; i < grid.cells.length; i += 1) {
      if (grid.cells[i]) {
        image.data[i * 4 + 3] = alpha;
        any = true;
      }
    }
    if (!any) return null;
    ctx.putImageData(image, 0, 0);
    return canvas;
  }, [fog]);

  const stagePolygons = useMemo(
    () => visionPolygons.filter((p) => p.length >= 6).map((p) => imagePointsToStage(p, fit)),
    [visionPolygons, fit],
  );

  if (!fog.enabled || !(fog.cols > 0)) return <Layer listening={false} />;

  return (
    <Layer listening={false} opacity={playerPreview ? FOG_PLAYER_OPACITY : FOG_DM_OPACITY}>
      <Group
        x={flipPivot.x}
        y={flipPivot.y}
        offsetX={flipPivot.x}
        offsetY={flipPivot.y}
        rotation={rotation ?? 0}
        scaleX={flippedHorizontal ? -1 : 1}
        scaleY={flippedVertical ? -1 : 1}
      >
        <Rect
          x={fit.x}
          y={fit.y}
          width={imageWidth * scale}
          height={imageHeight * scale}
          fill={FOG_COLOR}
        />

        {exploredMask && (
          <KonvaImage
            image={exploredMask}
            x={fit.x}
            y={fit.y}
            width={imageWidth * scale}
            height={imageHeight * scale}
            globalCompositeOperation="destination-out"
          />
        )}

        {stagePolygons.map((points, i) => (
          <Line
            key={`vision-${i}`}
            points={points}
            closed
            fill="#000"
            globalCompositeOperation="destination-out"
          />
        ))}

        {/* Live brush feedback, drawn last so a hide stroke can put fog back
            over an area the committed mask and line of sight already cleared. */}
        {brushPreview?.points.map((point, i) => (
          <Circle
            key={`brush-${i}`}
            x={fit.x + point.x * scale}
            y={fit.y + point.y * scale}
            radius={brushPreview.radius * scale}
            fill={brushPreview.reveal ? '#000' : FOG_COLOR}
            globalCompositeOperation={brushPreview.reveal ? 'destination-out' : 'source-over'}
          />
        ))}
      </Group>
    </Layer>
  );
}
