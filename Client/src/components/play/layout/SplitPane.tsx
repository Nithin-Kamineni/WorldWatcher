import { useCallback, useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import type { LayoutNode, PaneSlot, SplitDirection } from './playLayoutTrees';

const DIVIDER_HIT_SIZE = 10;
/**
 * Dividers overhang their track by half the hit size, so an outer divider's grab strip bleeds
 * a few pixels into the track holding a nested split - and where a vertical and a horizontal
 * divider cross, those strips overlap. Every divider used to sit at the same z-index, so DOM
 * order decided the winner, and the nested one is always later: grabbing the crossing point
 * silently resized the wrong axis. Outer dividers now stack above inner ones, which matches
 * what the pointer is on (the outer divider runs through that pixel; the inner one only
 * reaches it via its overhang) and makes the hover tint show which axis you are about to drag.
 */
const DIVIDER_BASE_Z = 10;
const COLLAPSED_SIZE = 44;
const MIN_TRACK_PX = 160;

interface SplitPaneProps {
  layoutId: string;
  node: LayoutNode;
  paneSizes: Record<string, number[]>;
  collapsedSlots: Set<PaneSlot>;
  locked: boolean;
  onResize: (key: string, sizes: number[]) => void;
  renderLeaf: (slot: PaneSlot, parentDirection: SplitDirection) => ReactNode;
  /** How deep this node sits in the layout tree; 0 at the root. Only drives divider stacking. */
  depth?: number;
}

function isCollapsedNode(node: LayoutNode, collapsedSlots: Set<PaneSlot>): boolean {
  return node.type === 'leaf' && collapsedSlots.has(node.slot);
}

/** One generic recursive renderer for all 6 Play-page layouts (see playLayoutTrees.ts) - walks
 * a static row/column split tree, rendering a draggable divider between each pair of adjacent,
 * non-collapsed children. Sizes are flex-grow weights (not required to sum to 1); a collapsed
 * leaf (see usePlayLayoutStore.collapsedPanes) gets a fixed pixel flex-basis instead
 * and its dividers are hidden, since a fixed-size pane has nothing to drag. */
export function SplitPane({ layoutId, node, paneSizes, collapsedSlots, locked, onResize, renderLeaf, depth = 0 }: SplitPaneProps) {
  if (node.type === 'leaf') return <>{renderLeaf(node.slot, 'row')}</>;
  return (
    <SplitContainer
      layoutId={layoutId}
      node={node}
      paneSizes={paneSizes}
      collapsedSlots={collapsedSlots}
      locked={locked}
      onResize={onResize}
      renderLeaf={renderLeaf}
      depth={depth}
    />
  );
}

function SplitContainer({
  layoutId,
  node,
  paneSizes,
  collapsedSlots,
  locked,
  onResize,
  renderLeaf,
  depth = 0,
}: Omit<SplitPaneProps, 'node'> & { node: Extract<LayoutNode, { type: 'split' }> }) {
  const key = `${layoutId}:${node.path}`;
  const storedSizes = paneSizes[key];
  const sizes = storedSizes && storedSizes.length === node.children.length ? storedSizes : node.children.map(() => 1);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dragSizes, setDragSizes] = useState<number[] | null>(null);
  const effectiveSizes = dragSizes ?? sizes;

  const startDrag = useCallback(
    (i: number, e: React.MouseEvent) => {
      if (locked) return;
      e.preventDefault();
      const elA = trackRefs.current[i];
      const elB = trackRefs.current[i + 1];
      if (!elA || !elB) return;
      const rectA = elA.getBoundingClientRect();
      const rectB = elB.getBoundingClientRect();
      const startA = node.direction === 'row' ? rectA.width : rectA.height;
      const startB = node.direction === 'row' ? rectB.width : rectB.height;
      const startPos = node.direction === 'row' ? e.clientX : e.clientY;
      const startSizes = [...effectiveSizes];
      const perUnitPx = (startA + startB) / (startSizes[i] + startSizes[i + 1]);

      const handleMove = (moveEvent: MouseEvent) => {
        const pos = node.direction === 'row' ? moveEvent.clientX : moveEvent.clientY;
        const deltaPx = pos - startPos;
        let newA = startA + deltaPx;
        let newB = startB - deltaPx;
        if (newA < MIN_TRACK_PX) {
          newB -= MIN_TRACK_PX - newA;
          newA = MIN_TRACK_PX;
        }
        if (newB < MIN_TRACK_PX) {
          newA -= MIN_TRACK_PX - newB;
          newB = MIN_TRACK_PX;
        }
        newA = Math.max(newA, 20);
        newB = Math.max(newB, 20);
        const next = [...startSizes];
        next[i] = newA / perUnitPx;
        next[i + 1] = newB / perUnitPx;
        setDragSizes(next);
      };
      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        setDragSizes((current) => {
          if (current) onResize(key, current);
          return null;
        });
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [locked, node.direction, effectiveSizes, key, onResize],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: node.direction === 'row' ? 'row' : 'column',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {node.children.map((child, i) => {
        const collapsed = isCollapsedNode(child, collapsedSlots);
        const nextCollapsed = i < node.children.length - 1 && isCollapsedNode(node.children[i + 1], collapsedSlots);
        const showDivider = i < node.children.length - 1 && !collapsed && !nextCollapsed && !locked;
        return (
          <Box
            key={i}
            ref={(el: HTMLDivElement | null) => {
              trackRefs.current[i] = el;
            }}
            sx={{
              flex: collapsed ? `0 0 ${COLLAPSED_SIZE}px` : `${effectiveSizes[i]} 1 0%`,
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              position: 'relative',
            }}
          >
            <SplitPane
              layoutId={layoutId}
              node={child}
              paneSizes={paneSizes}
              collapsedSlots={collapsedSlots}
              locked={locked}
              onResize={onResize}
              renderLeaf={(slot) => renderLeaf(slot, node.direction)}
              depth={depth + 1}
            />
            {showDivider && (
              <Box
                onMouseDown={(e) => startDrag(i, e)}
                sx={{
                  position: 'absolute',
                  zIndex: DIVIDER_BASE_Z - depth,
                  cursor: node.direction === 'row' ? 'col-resize' : 'row-resize',
                  '&:hover': { bgcolor: 'primary.main', opacity: 0.5 },
                  ...(node.direction === 'row'
                    ? { top: 0, bottom: 0, right: -DIVIDER_HIT_SIZE / 2, width: DIVIDER_HIT_SIZE }
                    : { left: 0, right: 0, bottom: -DIVIDER_HIT_SIZE / 2, height: DIVIDER_HIT_SIZE }),
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
