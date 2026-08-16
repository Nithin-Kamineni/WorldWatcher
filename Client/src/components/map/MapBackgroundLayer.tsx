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
}

interface BackgroundFit {
  src: string;
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
}: MapBackgroundLayerProps) {
  const [image] = useImage(src);
  // Tokens/grid/shapes live in raw stage-pixel space and never move on their own, so the
  // background's fit-to-container scale must be computed once per image and then frozen -
  // otherwise every container resize (e.g. opening/closing the sidebar) re-fits the image
  // to the new size while tokens stay put, making them appear to drift off their squares.
  const fitRef = useRef<BackgroundFit | null>(null);

  if (image && stageWidth > 0 && stageHeight > 0 && fitRef.current?.src !== src) {
    const scale = Math.min(stageWidth / image.width, stageHeight / image.height);
    fitRef.current = {
      src,
      scale,
      x: (stageWidth - image.width * scale) / 2,
      y: (stageHeight - image.height * scale) / 2,
    };
  }

  const fit = fitRef.current?.src === src ? fitRef.current : null;
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
