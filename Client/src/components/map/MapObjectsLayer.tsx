import { Layer, Group, Image as KonvaImage, Circle, Text } from 'react-konva';
import useImage from 'use-image';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { PlacedToken } from '../../types/token';
import { TOKEN_OUTLINE_WIDTH } from '../../types/token';
import type { StagePoint } from '../../utils/tokenDrag';

interface MapObjectsLayerProps {
  tokens: PlacedToken[];
  onTokenMove: (id: string, x: number, y: number) => void;
  onTokenContextMenu: (token: PlacedToken, clientX: number, clientY: number) => void;
  onTokenStatsRequest: (token: PlacedToken) => void;
  flipPivot: StagePoint;
  flippedHorizontal?: boolean;
  flippedVertical?: boolean;
  rotation?: number;
}

function PlacedTokenNode({
  token,
  onTokenMove,
  onTokenContextMenu,
  onTokenStatsRequest,
  flippedHorizontal,
  flippedVertical,
}: {
  token: PlacedToken;
  onTokenMove: MapObjectsLayerProps['onTokenMove'];
  onTokenContextMenu: MapObjectsLayerProps['onTokenContextMenu'];
  onTokenStatsRequest: MapObjectsLayerProps['onTokenStatsRequest'];
  flippedHorizontal?: boolean;
  flippedVertical?: boolean;
}) {
  const [image] = useImage(token.imageSrc);
  const radius = token.size / 2;
  const isBloodied = !!token.hp && token.hp.max > 0 && token.hp.current <= token.hp.max / 2;
  const relationTint = token.relationTint;
  const isCurrentTurn = !!token.isCurrentTurn;

  const handleContextMenu = (e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    onTokenContextMenu(token, e.evt.clientX, e.evt.clientY);
  };

  return (
    <Group
      x={token.x}
      y={token.y}
      draggable
      onDragEnd={(e) => onTokenMove(token.id, e.target.x(), e.target.y())}
      onContextMenu={handleContextMenu}
      onDblClick={() => onTokenStatsRequest(token)}
      onDblTap={() => onTokenStatsRequest(token)}
    >
      {/* counter-scale so token art/labels stay upright even when the map is flipped
          (rotation is intentionally NOT counter-applied here - tokens rotate with the board) */}
      <Group scaleX={flippedHorizontal ? -1 : 1} scaleY={flippedVertical ? -1 : 1}>
        {image ? (
          <KonvaImage
            image={image}
            width={token.size}
            height={token.size}
            offsetX={radius}
            offsetY={radius}
            cornerRadius={radius}
          />
        ) : (
          <>
            <Circle radius={radius} fill="#546e7a" />
            <Text
              text={token.name.charAt(0).toUpperCase() || '?'}
              width={token.size}
              height={token.size}
              offsetX={radius}
              offsetY={radius}
              align="center"
              verticalAlign="middle"
              fontSize={radius}
              fontStyle="bold"
              fill="#ffffff"
              listening={false}
            />
          </>
        )}
        {/* bloodied wash - barely-there red tint over the art, never hides the token */}
        {isBloodied && <Circle radius={radius} fill="#ff1744" opacity={0.1} listening={false} />}
        {/* relation tint (e.g. blue/green for a Player token) - same barely-there wash technique */}
        {relationTint && <Circle radius={radius} fill={relationTint} opacity={0.16} listening={false} />}
        <Circle radius={radius} stroke={token.outlineColor} strokeWidth={TOKEN_OUTLINE_WIDTH} />
        {/* current-turn highlight - a noticeable golden ring just outside the token's own outline */}
        {isCurrentTurn && (
          <Circle radius={radius + 4} stroke="#ffd700" strokeWidth={3} opacity={0.9} listening={false} />
        )}
        <Text
          text={token.name}
          y={radius + 4}
          width={Math.max(token.size, 80)}
          offsetX={Math.max(token.size, 80) / 2}
          align="center"
          fontSize={12}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={0.75}
          fillAfterStrokeEnabled
          listening={false}
        />
        {token.effects.length > 0 && (
          <Group x={radius * 0.7} y={-radius * 0.7} listening={false}>
            <Circle radius={8} fill="#c0392b" stroke="#ffffff" strokeWidth={1} />
            <Text
              text={String(token.effects.length)}
              width={16}
              height={16}
              offsetX={8}
              offsetY={8}
              align="center"
              verticalAlign="middle"
              fontSize={10}
              fontStyle="bold"
              fill="#ffffff"
            />
          </Group>
        )}
        {token.concentrating && (
          <Group x={radius * 0.7} y={radius * 0.7} listening={false}>
            <Circle radius={8} fill="#1e88e5" stroke="#ffffff" strokeWidth={1} />
          </Group>
        )}
      </Group>
    </Group>
  );
}

export function MapObjectsLayer({
  tokens,
  onTokenMove,
  onTokenContextMenu,
  onTokenStatsRequest,
  flipPivot,
  flippedHorizontal,
  flippedVertical,
  rotation,
}: MapObjectsLayerProps) {
  return (
    <Layer>
      <Group
        x={flipPivot.x}
        y={flipPivot.y}
        offsetX={flipPivot.x}
        offsetY={flipPivot.y}
        rotation={rotation ?? 0}
        scaleX={flippedHorizontal ? -1 : 1}
        scaleY={flippedVertical ? -1 : 1}
      >
        {tokens.map((token) => (
          <PlacedTokenNode
            key={token.id}
            token={token}
            onTokenMove={onTokenMove}
            onTokenContextMenu={onTokenContextMenu}
            onTokenStatsRequest={onTokenStatsRequest}
            flippedHorizontal={flippedHorizontal}
            flippedVertical={flippedVertical}
          />
        ))}
      </Group>
    </Layer>
  );
}
