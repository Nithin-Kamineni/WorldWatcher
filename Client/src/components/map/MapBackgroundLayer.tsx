import { useRef } from 'react';
import { Layer, Group, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type { StagePoint } from '../../utils/tokenDrag';

interface MapBackgroundLayerProps {
  src: string;
  stageWidth: number;
  stageHeight: number;
  flipPivot: StagePoint;
  flippedHorizontal?: boolean;
  flippedVertical?: boolean;
  rotation?: number;
  /** Bump to force the frozen fit to recompute against the current stageWidth/stageHeight
   * and rotation even though `src` hasn't changed - used by "Reset View" to truly re-fit
   * to the live viewport (including a rotation change) without affecting ordinary
   * container resizes or single Rotate clicks, which must keep the frozen scale to avoid
   * placed tokens drifting relative to the background. */
  fitResetEpoch?: number;
}

interface BackgroundFit {
  src: string;
  epoch: number;
  scale: number;
  x: number;
  y: number;
}

export function MapBackgroundLayer({
  src,
  stageWidth,
  stageHeight,
  flipPivot,
  flippedHorizontal,
  flippedVertical,
  rotation,
  fitResetEpoch = 0,
}: MapBackgroundLayerProps) {
  const [image] = useImage(src);
  // Tokens/grid/shapes live in raw stage-pixel space and never move on their own, so the
  // background's fit-to-container scale must be computed once per image and then frozen -
  // otherwise every container resize (e.g. opening/closing the sidebar) re-fits the image
  // to the new size while tokens stay put, making them appear to drift off their squares.
  const fitRef = useRef<BackgroundFit | null>(null);

  if (
    image &&
    stageWidth > 0 &&
    stageHeight > 0 &&
    (fitRef.current?.src !== src || fitRef.current?.epoch !== fitResetEpoch)
  ) {
    // The pre-rotation image is always centered on `flipPivot` (see the Group below), so
    // rotating it in place keeps it centered - only the scale needs to account for the
    // on-screen bounding box swapping width/height at 90/270.
    const rotated = rotation === 90 || rotation === 270;
    const effW = rotated ? image.height : image.width;
    const effH = rotated ? image.width : image.height;
    const scale = Math.min(stageWidth / effW, stageHeight / effH);
    fitRef.current = {
      src,
      epoch: fitResetEpoch,
      scale,
      x: (stageWidth - image.width * scale) / 2,
      y: (stageHeight - image.height * scale) / 2,
    };
  }

  const fit = fitRef.current?.src === src && fitRef.current?.epoch === fitResetEpoch ? fitRef.current : null;
  if (!image || !fit) {
    return <Layer />;
  }

  const width = image.width * fit.scale;
  const height = image.height * fit.scale;
  const x = fit.x;
  const y = fit.y;

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
        <KonvaImage image={image} x={x} y={y} width={width} height={height} />
      </Group>
    </Layer>
  );
}
