import { SessionNotesPanel } from '../SessionNotesPanel';
import { ChatPanel } from '../ChatPanel';
import { ItemsWindow } from '../items/ItemsWindow';
import { WindowKindSwitcher } from './WindowKindSwitcher';
import { CollapsedChatStrip } from './CollapsedChatStrip';
import type { PlayWindowKind } from '../../../store/usePlayLayoutStore';
import type { PaneSlot, SplitDirection } from './playLayoutTrees';
import type { Note } from '../../../types/note';

interface PaneWindowProps {
  slot: PaneSlot;
  kind: PlayWindowKind;
  parentDirection: SplitDirection;
  collapsed: boolean;
  locked: boolean;
  onSetKind: (kind: PlayWindowKind) => void;
  onToggleCollapse: () => void;

  worldId: string;
  campaignId: string;
  displayedNote: Note;
  switchableNotes: Note[];
  onSwitchNote: (noteId: string) => void;
  onOpenSituationalTable: (tableId: string) => void;
  sessionNoteId: string;
  chatId: string | null;
}

/** One leaf of the Play workspace's layout tree - resolves a slot's assigned window kind to
 * the right content component and gives it the elegant "change window type" header switcher
 * (issues.txt 10.1). Chat's collapsed state is owned here since collapsing swaps out the whole
 * component for a thin strip rather than something ChatPanel itself needs to know how to draw. */
export function PaneWindow({
  slot,
  kind,
  parentDirection,
  collapsed,
  locked,
  onSetKind,
  onToggleCollapse,
  worldId,
  campaignId,
  displayedNote,
  switchableNotes,
  onSwitchNote,
  onOpenSituationalTable,
  sessionNoteId,
  chatId,
}: PaneWindowProps) {
  if (kind === 'chat' && collapsed) {
    return <CollapsedChatStrip direction={parentDirection} onExpand={onToggleCollapse} />;
  }

  const switcher = <WindowKindSwitcher kind={kind} onSetKind={onSetKind} disabled={locked} />;

  if (kind === 'session') {
    return (
      <SessionNotesPanel
        worldId={worldId}
        campaignId={campaignId}
        note={displayedNote}
        switchableNotes={switchableNotes}
        onSwitchNote={onSwitchNote}
        onOpenSituationalTable={onOpenSituationalTable}
        kindSwitcher={switcher}
      />
    );
  }

  if (kind === 'chat') {
    return (
      <ChatPanel
        worldId={worldId}
        campaignId={campaignId}
        noteId={sessionNoteId}
        chatId={chatId}
        kindSwitcher={switcher}
        onCollapse={onToggleCollapse}
        parentDirection={parentDirection}
      />
    );
  }

  return <ItemsWindow worldId={worldId} campaignId={campaignId} slot={slot} kindSwitcher={switcher} />;
}
