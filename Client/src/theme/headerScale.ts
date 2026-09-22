import { useEffect, useRef, useState, type RefObject } from 'react';
import { su } from './uiScale';

/** THE header scale, for the whole app.
 *
 * The Play page settled on 40px for every pane header (PaneHeader.tsx) and that is what makes
 * its panes read as one grid rather than three differently-chromed boxes. Every other panel in
 * the app had been styled independently - the map sidebar's three panels each used a `p: 2`
 * block with a subtitle1, one of them with a Divider under it and two without, sitting directly
 * beside the Reference panel's 40px PaneHeader. So the number lives here, PaneHeader derives
 * PANE_HEADER_HEIGHT from it, and any panel that wants a header row renders
 * <SectionHeader/> (components/shell/SectionHeader.tsx) instead of rolling its own
 * (checklist I-U1). */
export const SECTION_HEADER_HEIGHT = su(40);

/** Whether an element's text is actually clipped right now.
 *
 * Re-measured whenever `dep` changes and on every resize, since dragging a divider is the usual
 * way a title starts or stops fitting. Shared by PaneHeader and SectionHeader so a truncated
 * title gets a tooltip - and an untruncated one does not sprout a redundant hover label -
 * identically wherever it is rendered (checklist I-P12). */
export function useIsTruncated<T extends HTMLElement>(dep: unknown): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [dep]);
  return [ref, truncated];
}
