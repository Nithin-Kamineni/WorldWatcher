import Box from '@mui/material/Box';
import { PLAY_LAYOUTS, type LayoutNode, type PaneSlot, type PlayLayoutId } from './playLayoutTrees';

const VIEW = 20;
const PAD = 1;
const GAP = 2.2;
const RADIUS = 1.4;

interface Rect {
  slot: PaneSlot;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Walks a layout tree into the rectangles it actually draws on screen. The glyph is therefore
 * derived from the same definition SplitPane renders, which is the whole point: a layout added
 * to playLayoutTrees.ts gets a correct icon for free, and no icon can drift out of sync with
 * the layout it labels (the old MUI View*Outlined icons did exactly that - the "two windows
 * side by side" button showed three columns). */
function collectRects(node: LayoutNode, x: number, y: number, w: number, h: number, out: Rect[]): void {
  if (node.type === 'leaf') {
    out.push({ slot: node.slot, x, y, w, h });
    return;
  }
  const count = node.children.length;
  if (node.direction === 'row') {
    const each = (w - GAP * (count - 1)) / count;
    node.children.forEach((child, i) => collectRects(child, x + i * (each + GAP), y, each, h, out));
  } else {
    const each = (h - GAP * (count - 1)) / count;
    node.children.forEach((child, i) => collectRects(child, x, y + i * (each + GAP), w, each, out));
  }
}

export function layoutGlyphRects(layoutId: PlayLayoutId): Rect[] {
  const out: Rect[] = [];
  collectRects(PLAY_LAYOUTS[layoutId].root, PAD, PAD, VIEW - PAD * 2, VIEW - PAD * 2, out);
  return out;
}

interface LayoutGlyphProps {
  layoutId: PlayLayoutId;
  /** Pane slots to draw hollow rather than solid - used to show which windows a layout
   * currently has closed. */
  emptySlots?: PaneSlot[];
  size?: number;
}

/** A pane-accurate icon for one Play layout, drawn straight from its split tree. */
export function LayoutGlyph({ layoutId, emptySlots, size = 18 }: LayoutGlyphProps) {
  const rects = layoutGlyphRects(layoutId);
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      sx={{ width: size, height: size, display: 'block', flexShrink: 0, color: 'inherit' }}
      aria-hidden
    >
      {rects.map((rect) => {
        const hollow = emptySlots?.includes(rect.slot);
        return (
          <rect
            key={rect.slot}
            x={rect.x}
            y={rect.y}
            width={Math.max(rect.w, 0.5)}
            height={Math.max(rect.h, 0.5)}
            rx={RADIUS}
            ry={RADIUS}
            fill={hollow ? 'none' : 'currentColor'}
            fillOpacity={hollow ? 0 : 0.9}
            stroke="currentColor"
            strokeOpacity={hollow ? 0.55 : 0}
            strokeWidth={hollow ? 1.1 : 0}
            strokeDasharray={hollow ? '2 1.6' : undefined}
          />
        );
      })}
    </Box>
  );
}
