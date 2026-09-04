import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PaneSlot } from './playLayoutTrees';

/** The MIME-ish key the pane drag writes into the DataTransfer. Checked on drop so a drag that
 * started somewhere else (a file, a link, a tab strip) can never rearrange the workspace. */
export const PANE_DRAG_TYPE = 'application/x-worldwatcher-pane';

interface PaneDragContextValue {
  /** Null when nothing is being dragged. */
  draggingSlot: PaneSlot | null;
  /** The pane the pointer is currently over, i.e. the one that will receive the drop. */
  hoverSlot: PaneSlot | null;
  enabled: boolean;
  beginDrag: (slot: PaneSlot) => void;
  endDrag: () => void;
  setHoverSlot: (slot: PaneSlot | null) => void;
  /** Completes a drag: swaps the dragged pane with `target`. */
  dropOn: (target: PaneSlot) => void;
}

const NOOP_CONTEXT: PaneDragContextValue = {
  draggingSlot: null,
  hoverSlot: null,
  enabled: false,
  beginDrag: () => {},
  endDrag: () => {},
  setHoverSlot: () => {},
  dropOn: () => {},
};

const PaneDragContext = createContext<PaneDragContextValue>(NOOP_CONTEXT);

export function usePaneDrag(): PaneDragContextValue {
  return useContext(PaneDragContext);
}

interface PaneDragProviderProps {
  /** False while the layout is locked - drag handles go inert rather than disappearing. */
  enabled: boolean;
  onSwap: (a: PaneSlot, b: PaneSlot) => void;
  children: ReactNode;
}

/** Owns the "which pane is being dragged, which pane is it over" state for one Play workspace.
 * Kept in React state rather than only in the DataTransfer because every pane needs to react to
 * it - the drag source dims, and every *other* pane has to raise a drop catcher and show its
 * snap tint, which is only possible if they all know a drag is in flight. */
export function PaneDragProvider({ enabled, onSwap, children }: PaneDragProviderProps) {
  const [draggingSlot, setDraggingSlot] = useState<PaneSlot | null>(null);
  const [hoverSlot, setHoverSlot] = useState<PaneSlot | null>(null);
  /** Mirrors draggingSlot so dropOn can read the source without being re-created per drag -
   * and, more importantly, without reading it inside a state updater. The updater runs during
   * React's render phase, so swapping there wrote to the layout store mid-render and React
   * (rightly) complained about updating TopBar while rendering this provider. */
  const draggingRef = useRef<PaneSlot | null>(null);

  const beginDrag = useCallback((slot: PaneSlot) => {
    draggingRef.current = slot;
    setDraggingSlot(slot);
  }, []);

  const endDrag = useCallback(() => {
    draggingRef.current = null;
    setDraggingSlot(null);
    setHoverSlot(null);
  }, []);

  const dropOn = useCallback(
    (target: PaneSlot) => {
      const source = draggingRef.current;
      draggingRef.current = null;
      setDraggingSlot(null);
      setHoverSlot(null);
      if (source && source !== target) onSwap(source, target);
    },
    [onSwap],
  );

  const value = useMemo<PaneDragContextValue>(
    () => ({
      draggingSlot,
      hoverSlot,
      enabled,
      beginDrag,
      endDrag,
      setHoverSlot,
      dropOn,
    }),
    [draggingSlot, hoverSlot, enabled, beginDrag, endDrag, dropOn],
  );

  return <PaneDragContext.Provider value={value}>{children}</PaneDragContext.Provider>;
}
