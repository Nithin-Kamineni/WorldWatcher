import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import { PaneWindow } from './layout/PaneWindow';
import { SplitPane } from './layout/SplitPane';
import { PaneDragProvider } from './layout/paneDrag';
import { PLAY_LAYOUTS } from './layout/playLayoutTrees';
import type { LayoutNode, PaneSlot } from './layout/playLayoutTrees';
import { usePlayLayoutStore, getPlayLayoutState } from '../../store/usePlayLayoutStore';
import { usePlayItemsStore } from '../../store/usePlayItemsStore';
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
  const swapItemsSlots = usePlayItemsStore((s) => s.swapSlots);

  const layoutState = getPlayLayoutState(byCampaignId, campaignId);
  const { layoutId, locked, paneSizes, collapsedPanes, windowAssignment, dismissedPanes } = layoutState;
  const layoutDef = PLAY_LAYOUTS[layoutId];
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

  const tree = useMemo(() => pruneDismissed(layoutDef.root, dismissed) ?? layoutDef.root, [layoutDef.root, dismissed]);
  const liveSlots = useMemo(() => visibleSlots(tree), [tree]);
  const canClose = liveSlots.length > 1;

  const [displayedNoteId, setDisplayedNoteId] = useState<string>(sessionNote.id);
  const displayedNote = switchableNotes.find((n) => n.id === displayedNoteId) ?? sessionNote;

  const openTableFromRef = (_tableId: string) => {
    // Session/Narrative notes render situational-table mentions inline via EntityRefPreview.
    // The old dedicated "Roleplay & Exploration" view is gone - situational tables are now
    // just random tables (unified system), browsed from the "Random Tables" tile. There's no
    // scroll-to-this-table deep link into that browse view yet (the old `?table=` support was
    // specific to the now-removed SituationalTablesView), so this just lands on the browse
    // screen rather than the specific table - a TODO for whoever wires up random-table mention
    // deep-linking end to end.
    window.open(`/w/${worldId}/c/${campaignId}/encounters?view=random_tables`, '_blank');
  };

  const collapsedSlots = new Set<PaneSlot>(
    (Object.entries(collapsedPanes) as [PaneSlot, boolean | undefined][])
      .filter(([slot, isCollapsed]) => isCollapsed && assignment[slot] === 'chat')
      .map(([slot]) => slot),
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <PaneDragProvider
          enabled={!locked}
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
                onSetKind={(kind) => setWindowKind(campaignId, layoutId, slot, kind)}
                onToggleCollapse={() => toggleCollapsed(campaignId, slot)}
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
