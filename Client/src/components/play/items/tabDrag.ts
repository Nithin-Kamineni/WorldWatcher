import { ITEMS_TAB_KINDS, type ItemsTabKind } from '../../../store/usePlayItemsStore';
import type { ItemsSurface } from '../layout/playLayoutTrees';

/** Data type for dragging an Items sub-tab. Deliberately different from PANE_DRAG_TYPE so a tab
 * drag can never be mistaken for a whole-pane drag (and the pane drop zones ignore it).
 *
 * The payload is `${sourceSlot}:${kind}`, not just the kind: a tab can be dropped on ANOTHER
 * Items window's strip, or on an empty pane to tear it off into a window of its own, and the
 * receiving surface has no other way to know where the tab came from - a window's own
 * `draggingTab` state only ever describes a drag that started in itself (checklist I-P3).
 *
 * Its own module rather than an export from ItemsWindow.tsx so the three surfaces that speak
 * this protocol (the tab strip, the other Items window, the empty-pane placeholder) share one
 * definition without a component file exporting non-components. */
export const TAB_DRAG_TYPE = 'application/x-worldwatcher-items-tab';

export function encodeTabDrag(slot: ItemsSurface, kind: ItemsTabKind): string {
  return `${slot}:${kind}`;
}

export function decodeTabDrag(payload: string): { slot: ItemsSurface; kind: ItemsTabKind } | null {
  const [slot, kind] = payload.split(':');
  if (!slot || !kind || !ITEMS_TAB_KINDS.includes(kind as ItemsTabKind)) return null;
  return { slot: slot as ItemsSurface, kind: kind as ItemsTabKind };
}
