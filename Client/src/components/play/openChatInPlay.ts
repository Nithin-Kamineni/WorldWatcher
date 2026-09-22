import type { NavigateFunction } from 'react-router-dom';
import { usePlayUiStore } from '../../store/usePlayUiStore';
import { usePlayLayoutStore, getPlayLayoutState, getLayoutSlots } from '../../store/usePlayLayoutStore';
import type { PaneSlot } from './layout/playLayoutTrees';
import type { Note } from '../../types/note';
import type { SessionChat } from '../../types/sessionChat';

/** Opens one DM-notes thread in the Play page's Chat window (issues.txt 10.b.3).
 *
 * The point of this over a bare navigate: a DM-notes thread is a document, and opening a
 * document should put it in front of you. Landing on the Play page with whatever layout was
 * left over - possibly a single Session pane, possibly a Chat pane that is collapsed or
 * closed - is "open the Play page again", not "open this thread". So this guarantees three
 * things before navigating:
 *
 *   1. a Chat window exists, is un-collapsed and is un-dismissed (ensurePaneOfKind),
 *   2. it sits BESIDE the notes rather than replacing them - a single-pane layout is widened
 *      to two, and ensurePaneOfKind never claims the Session pane,
 *   3. the workspace opens on this thread, anchored to a real session note.
 *
 * Both callers of "open a chat" go through here - the DM Notes folder and the session note's
 * own Attached chats list - so the two behave identically.
 */
export function openChatInPlay(
  chat: SessionChat,
  campaignId: string,
  worldId: string | undefined,
  sessionNotes: Note[],
  navigate: NavigateFunction,
): void {
  const layoutStore = usePlayLayoutStore.getState();
  const layoutState = getPlayLayoutState(layoutStore.byCampaignId, campaignId);

  // How many panes the DM can actually see right now - dismissed slots have had their space
  // handed back, so they don't count (see SessionRunnerWorkspace.pruneDismissed).
  const dismissed = layoutState.dismissedPanes[layoutState.layoutId] ?? {};
  const liveSlots = getLayoutSlots(layoutState, layoutState.layoutId).filter((slot: PaneSlot) => !dismissed[slot]);

  // "The DM notes window could also be opened next to the session or narrative notes" - with
  // only one pane to work with there is nowhere to put it beside them, so widen to the
  // default two-up layout rather than evicting the notes.
  const layoutId = liveSlots.length < 2 ? 'double-row' : layoutState.layoutId;
  if (layoutId !== layoutState.layoutId) layoutStore.setLayout(campaignId, layoutId);
  layoutStore.ensurePaneOfKind(campaignId, layoutId, getLayoutSlots(layoutState, layoutId), 'chat');

  // The workspace is anchored to a session-prep note, and the Chat panel lists the threads of
  // whichever note that is. Prefer the chat's own note so the thread is actually in that list;
  // fall back to the most recent session note for an orphaned thread (SessionChat.note_id is
  // SET NULL when its note is deleted).
  const anchorNote = sessionNotes.find((note) => note.id === chat.noteId) ?? sessionNotes[0];
  if (anchorNote) usePlayUiStore.getState().startSession(campaignId, anchorNote.id, chat.id);

  navigate(`/w/${worldId}/c/${campaignId}/play`);
}
