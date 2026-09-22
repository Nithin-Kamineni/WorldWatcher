import { memo } from 'react';
import { Layer, Group, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type { BackgroundFit } from '../../utils/mapFit';
import type { StagePoint } from '../../utils/tokenDrag';

interface MapBackgroundLayerProps {
  src: string;
  /** Where the image lands in stage-local space. Computed and frozen by
   * MapCanvas, which owns it because fog and walls need the same transform -
   * see utils/mapFit.ts. Null until the image has loaded and the container
   * has been measured. */
  fit: BackgroundFit | null;
  flipPivot: StagePoint;
  flippedHorizontal?: boolean;
  flippedVertical?: boolean;
  rotation?: number;
}

/**
 * Memoised: every prop here is a primitive or a frozen object (`fit`,
 * `flipPivot`), and none of them change while a token is being moved. Without
 * this, re-rendering MapCanvas re-applied the Group's props and Konva marked
 * this layer dirty, so the full-size scaled background bitmap was redrawn on
 * every unrelated state change on the page.
 */
export const MapBackgroundLayer = memo(function MapBackgroundLayer({
  src,
  fit,
  flipPivot,
  flippedHorizontal,
  flippedVertical,
  rotation,
}: MapBackgroundLayerProps) {
  // Shares use-image's cache with MapCanvas's own useImage(src) for the same
  // URL, so this is not a second fetch.
  const [image] = useImage(src);

  if (!image || !fit) {
    return <Layer />;
  }

  return (
    <Layer listening={false}>
      <Group
        x={flipPivot.x}
        y={flipPivot.y}
        offsetX={flipPivot.x}
        offsetY={flipPivot.y}
        rotation={rotation ?? 0}
        scaleX={flippedHorizontal ? -1 : 1}
        scaleY={flippedVertical ? -1 : 1}
      >
        <KonvaImage
          image={image}
          x={fit.x}
          y={fit.y}
          width={image.width * fit.scale}
          height={image.height * fit.scale}
        />
      </Group>
    </Layer>
  );
});
