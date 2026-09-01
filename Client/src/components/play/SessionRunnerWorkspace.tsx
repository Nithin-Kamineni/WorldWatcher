import { useState } from 'react';
import Box from '@mui/material/Box';
import { PaneWindow } from './layout/PaneWindow';
import { SplitPane } from './layout/SplitPane';
import { PLAY_LAYOUTS } from './layout/playLayoutTrees';
import type { PaneSlot } from './layout/playLayoutTrees';
import { usePlayLayoutStore, getPlayLayoutState } from '../../store/usePlayLayoutStore';
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

/** The running-a-session screen: a SplitPane rendering of whichever of the 6 layouts is
 * active, with each leaf resolved to a Session/Chat/Items pane via PaneWindow. The layout
 * picker/lock/reset controls and the "back to setup" button now live in TopBar (issues.txt
 * main-page point 10 - reclaims the vertical space this used to cost as its own toolbar row).
 * All layout/pane state lives in usePlayLayoutStore, persisted per campaign. */
export function SessionRunnerWorkspace({ worldId, campaignId, sessionNote, switchableNotes, chatId }: SessionRunnerWorkspaceProps) {
  const byCampaignId = usePlayLayoutStore((s) => s.byCampaignId);
  const setPaneSizes = usePlayLayoutStore((s) => s.setPaneSizes);
  const toggleCollapsed = usePlayLayoutStore((s) => s.toggleCollapsed);
  const setWindowKind = usePlayLayoutStore((s) => s.setWindowKind);

  const layoutState = getPlayLayoutState(byCampaignId, campaignId);
  const { layoutId, locked, paneSizes, collapsedPanes, windowAssignment } = layoutState;
  const layoutDef = PLAY_LAYOUTS[layoutId];
  const assignment = windowAssignment[layoutId] ?? {};

  const [displayedNoteId, setDisplayedNoteId] = useState<string>(sessionNote.id);
  const displayedNote = switchableNotes.find((n) => n.id === displayedNoteId) ?? sessionNote;

  const openTableFromRef = (tableId: string) => {
    // Session/Narrative notes render situational-table mentions inline via EntityRefPreview;
    // rather than guessing which pane (if any) currently has an Items window open on the
    // Random Tables tab, jump straight to the full reference page, scrolled to that table (see
    // SituationalTablesView's `?table=` support).
    window.open(`/w/${worldId}/c/${campaignId}/encounters?view=situational_tables&table=${tableId}`, '_blank');
  };

  const collapsedSlots = new Set<PaneSlot>(
    (Object.entries(collapsedPanes) as [PaneSlot, boolean | undefined][])
      .filter(([slot, isCollapsed]) => isCollapsed && assignment[slot] === 'chat')
      .map(([slot]) => slot),
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <SplitPane
          layoutId={layoutId}
          node={layoutDef.root}
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
              onSetKind={(kind) => setWindowKind(campaignId, layoutId, slot, kind)}
              onToggleCollapse={() => toggleCollapsed(campaignId, slot)}
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
      </Box>
    </Box>
  );
}
