import { useEffect, useRef, type ReactNode } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/** How many browse rows an Items sub-window renders at once, and how many more each step adds.
 *
 * The random-table library alone runs to thousands of rows and this pane is a narrow
 * session-time list, not a catalog browser - so the list grows a page at a time and the count
 * chip always states the full match total, which is what keeps the paging from hiding how big
 * the result set really is. */
export const BROWSE_PAGE = 40;

interface ItemsBrowseSectionProps {
  /** Rows matching the current query/filters. */
  matched: number;
  /** Rows available before any narrowing - the "of N" in the count chip. */
  total: number;
  /** Whether a query or filter is currently narrowing the list. */
  narrowed: boolean;
  /** Noun for the count chip and the empty lines: "tables", "encounters"… */
  noun: string;
  /** Shown instead of the list when `total` is 0 - the sub-window's own "nothing here yet". */
  emptyLabel: ReactNode;
  /** How many rows the caller is currently rendering. */
  limit: number;
  /** Asks the caller to raise `limit` by another BROWSE_PAGE. */
  onShowMore: () => void;
  /** The visible rows, already sliced to `limit` by the caller. */
  children: ReactNode;
}

/** The "Browse" heading, live count chip, paged row list and "Show N more" tail that every
 * Items sub-window ends with.
 *
 * All five sub-windows grew this shape independently and four of them then refused to list
 * anything at all until something was typed, so one opened mid-fight started blank (checklist
 * I-P8). Having it in one place is what makes "ranked by usefulness, never empty" true of all
 * five rather than of whichever one was edited last.
 *
 * The list grows a page at a time rather than offering one "Show all 2622" that mounted every
 * remaining row at once (checklist I-U4). A sentinel below the last row pulls the next page in
 * as it scrolls into view, so scrolling just works and the button is only there for anyone
 * whose browser has no IntersectionObserver - or who would rather click than scroll. */
export function ItemsBrowseSection({ matched, total, narrowed, noun, emptyLabel, limit, onShowMore, children }: ItemsBrowseSectionProps) {
  const hasMore = matched > limit;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onShowMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, limit, onShowMore]);

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pl: 0.5, mt: 1 }}>
        <Typography variant="overline" color="text.secondary">
          Browse
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          label={narrowed ? `${matched} of ${total}` : `${total} ${noun}`}
          sx={{ height: 18, fontSize: 10.5 }}
        />
      </Stack>

      {total === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          {emptyLabel}
        </Typography>
      ) : matched === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          No {noun} match.
        </Typography>
      ) : (
        <>
          {children}
          {hasMore && (
            <>
              <Button size="small" fullWidth onClick={onShowMore} sx={{ mt: 0.5 }}>
                Show {Math.min(BROWSE_PAGE, matched - limit)} more of {matched}
              </Button>
              <div ref={sentinelRef} aria-hidden />
            </>
          )}
        </>
      )}
    </>
  );
}
