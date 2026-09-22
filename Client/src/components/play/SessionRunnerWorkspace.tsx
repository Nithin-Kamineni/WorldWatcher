import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import { PaneWindow } from './layout/PaneWindow';
import { SplitPane } from './layout/SplitPane';
import { PaneDragProvider } from './layout/paneDrag';
import { KIND_LABELS } from './layout/WindowKindSwitcher';
import { getLayoutTree } from '../../store/usePlayLayoutStore';
import type { LayoutNode, PaneSlot } from './layout/playLayoutTrees';
import { usePlayLayoutStore, getPlayLayoutState } from '../../store/usePlayLayoutStore';
import { usePlayItemsStore } from '../../store/usePlayItemsStore';
import { RIGHT_PANEL_HANDLE_WIDTH } from '../../theme/layout';
import type { Note } from '../../types/note';

interface SessionRunnerWorkspaceProps {
  worldId: string;
  campaignId: string;
  /** The anchor session-prep note for this run - owns the chat's note scoping even if the
   * Notes panel is currently displaying something else via the switcher. */
  sessionNote: Note;
  /** Session + Narrative notes for this campaign, for SessionNotesPanel's switcher. */
  switchableNotes: Note[];
  chatId: string | null;
}

/** Drops the panes a DM has dismissed out of the layout tree, collapsing any split left with a
 * single child. This is what makes "close a window and give its space back" change the layout
 * for real - dismissing one half of a two-window layout leaves the other half full-width -
 * without needing a separate layout id for every subset of every tree. Returns null when
 * nothing is left, which the caller prevents by never letting the last pane be dismissed. */
function pruneDismissed(node: LayoutNode, dismissed: Set<PaneSlot>): LayoutNode | null {
  if (node.type === 'leaf') return dismissed.has(node.slot) ? null : node;
  const children = node.children.map((child) => pruneDismissed(child, dismissed)).filter((child): child is LayoutNode => !!child);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { ...node, children };
}

function visibleSlots(node: LayoutNode, out: PaneSlot[] = []): PaneSlot[] {
  if (node.type === 'leaf') out.push(node.slot);
  else node.children.forEach((child) => visibleSlots(child, out));
  return out;
}

/** The running-a-session screen: a SplitPane rendering of whichever of the 6 layouts is
 * active, with each leaf resolved to a Session/Chat/Items/empty pane via PaneWindow. The layout
 * picker/lock/reset controls and the "back to setup" button now live in TopBar (issues.txt
 * main-page point 10 - reclaims the vertical space this used to cost as its own toolbar row).
 * All layout/pane state lives in usePlayLayoutStore, persisted per campaign. */
export function SessionRunnerWorkspace({ worldId, campaignId, sessionNote, switchableNotes, chatId }: SessionRunnerWorkspaceProps) {
  const byCampaignId = usePlayLayoutStore((s) => s.byCampaignId);
  const setPaneSizes = usePlayLayoutStore((s) => s.setPaneSizes);
  const toggleCollapsed = usePlayLayoutStore((s) => s.toggleCollapsed);
  const setWindowKind = usePlayLayoutStore((s) => s.setWindowKind);
  const closePane = usePlayLayoutStore((s) => s.closePane);
  const dismissPane = usePlayLayoutStore((s) => s.dismissPane);
  const swapPanes = usePlayLayoutStore((s) => s.swapPanes);
  const splitPane = usePlayLayoutStore((s) => s.splitPane);
  const swapItemsSlots = usePlayItemsStore((s) => s.swapSlots);

  const layoutState = getPlayLayoutState(byCampaignId, campaignId);
  const { layoutId, locked, paneSizes, collapsedPanes, windowAssignment, dismissedPanes, lastKindBySlot } = layoutState;
  // The DM's edited tree when there is one, else the preset - see getLayoutTree. The six
  // layouts are starting points now, not the only reachable shapes (checklist I-P1).
  const baseTree = getLayoutTree(layoutState, layoutId);
  const assignment = windowAssignment[layoutId] ?? {};

  const dismissed = useMemo(
    () =>
      new Set<PaneSlot>(
        (Object.entries(dismissedPanes[layoutId] ?? {}) as [PaneSlot, boolean | undefined][])
          .filter(([, isDismissed]) => isDismissed)
          .map(([slot]) => slot),
      ),
    [dismissedPanes, layoutId],
  );

  const tree = useMemo(() => pruneDismissed(baseTree, dismissed) ?? baseTree, [baseTree, dismissed]);
  const liveSlots = useMemo(() => visibleSlots(tree), [tree]);
  const canClose = liveSlots.length > 1;

  const [displayedNoteId, setDisplayedNoteId] = useState<string>(sessionNote.id);
  const displayedNote = switchableNotes.find((n) => n.id === displayedNoteId) ?? sessionNote;

  const openTableFromRef = (tableId: string) => {
    // Session/Narrative notes render random-table mentions inline via EntityRefPreview. This
    // used to land on the browse screen and make the DM find the table again, because the old
    // `?table=` support belonged to the since-removed SituationalTablesView. The browse view
    // carries its own `openTableId` now (it opens that table's roll view directly), and random
    // tables have their own page since checklist R4 - so the mention can open the actual table.
    window.open(`/w/${worldId}/c/${campaignId}/tables?table=${tableId}`, '_blank');
  };

  // Collapse used to be chat-only. It applies to every window kind now (checklist I-P11), but
  // never to an empty placeholder - there is nothing there to shrink - and a slot that is no
  // longer in the layout must not keep a stale collapsed flag.
  const collapsible = liveSlots.filter((slot) => (assignment[slot] ?? 'session') !== 'empty');
  const requestedCollapsed = collapsible.filter((slot) => collapsedPanes[layoutId]?.[slot]);

  // THE INVARIANT IS ENFORCED ON READ, NOT ONLY ON WRITE. collapsedPanes is now stored per
  // layout (it used to be one flat per-campaign map, which is what let a stale flag collapse an
  // entire two-pane workspace into two 44px strips - a Play page that looks blank), but a
  // belt-and-braces floor here means no persisted state, however it got written, can ever leave
  // the DM with nothing to read.
  const collapsedSlots = new Set<PaneSlot>(
    requestedCollapsed.length >= collapsible.length ? requestedCollapsed.slice(1) : requestedCollapsed,
  );
  /** Collapsing the last expanded pane would leave a workspace of strips with nothing in it. */
  const canCollapse = collapsible.filter((slot) => !collapsedSlots.has(slot)).length > 1;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* The details panel's floating handle is pinned to the viewport's right edge and takes no
          layout space, so without this inset it lands on top of the rightmost pane's close
          button - which, in the triple and quad layouts, is exactly where a pane header sits. */}
      <Box sx={{ flexGrow: 1, minHeight: 0, pr: `${RIGHT_PANEL_HANDLE_WIDTH}px` }}>
        <PaneDragProvider
          enabled={!locked}
          slots={liveSlots}
          labelForSlot={(slot) => {
            const kind = assignment[slot] ?? 'session';
            return kind === 'empty' ? 'Empty window' : KIND_LABELS[kind];
          }}
          onSplit={(slot, side) => splitPane(campaignId, layoutId, slot, side)}
          onSwap={(a, b) => {
            swapPanes(campaignId, layoutId, a, b);
            // An Items window's tab set, pins and open rows belong to the window, not to the
            // screen position - they travel with it.
            swapItemsSlots(campaignId, a, b);
          }}
        >
          <SplitPane
            layoutId={layoutId}
            node={tree}
            paneSizes={paneSizes}
            collapsedSlots={collapsedSlots}
            locked={locked}
            onResize={(key, sizes) => setPaneSizes(campaignId, key, sizes)}
            renderLeaf={(slot, parentDirection) => (
              <PaneWindow
                slot={slot}
                kind={assignment[slot] ?? 'session'}
                parentDirection={parentDirection}
                collapsed={collapsedSlots.has(slot)}
                locked={locked}
                canClose={canClose}
                canCollapse={canCollapse}
                onSetKind={(kind) => setWindowKind(campaignId, layoutId, slot, kind)}
                onToggleCollapse={() => toggleCollapsed(campaignId, layoutId, slot)}
                rememberedKind={lastKindBySlot[layoutId]?.[slot]}
                onClose={() => closePane(campaignId, layoutId, slot)}
                onDismiss={() => dismissPane(campaignId, layoutId, slot)}
                worldId={worldId}
                campaignId={campaignId}
                displayedNote={displayedNote}
                switchableNotes={switchableNotes}
                onSwitchNote={setDisplayedNoteId}
                onOpenSituationalTable={openTableFromRef}
                sessionNoteId={sessionNote.id}
                chatId={chatId}
              />
            )}
          />
        </PaneDragProvider>
      </Box>
    </Box>
  );
}
