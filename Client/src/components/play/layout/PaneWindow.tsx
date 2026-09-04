import Box from '@mui/material/Box';
import { SessionNotesPanel } from '../SessionNotesPanel';
import { ChatPanel } from '../ChatPanel';
import { ItemsWindow } from '../items/ItemsWindow';
import { WindowKindSwitcher, KIND_LABELS, type ContentWindowKind } from './WindowKindSwitcher';
import { CollapsedChatStrip } from './CollapsedChatStrip';
import { EmptyPaneWindow } from './EmptyPaneWindow';
import { PaneDropZone } from './PaneDropZone';
import { usePaneDrag } from './paneDrag';
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
  /** Closes this window, leaving its space behind as an empty placeholder. */
  onClose: () => void;
  /** Hands an empty pane's space back to its neighbours. */
  onDismiss: () => void;
  /** False when this is the only pane on screen - it has nowhere to hand its space to. */
  canClose: boolean;

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
 * (issues.txt 10.1), a close button, and the pane drop target that makes header drag-and-drop
 * swap two windows. Chat's collapsed state is owned here since collapsing swaps out the whole
 * component for a thin strip rather than something ChatPanel itself needs to know how to draw. */
export function PaneWindow({
  slot,
  kind,
  parentDirection,
  collapsed,
  locked,
  onSetKind,
  onToggleCollapse,
  onClose,
  onDismiss,
  canClose,
  worldId,
  campaignId,
  displayedNote,
  switchableNotes,
  onSwitchNote,
  onOpenSituationalTable,
  sessionNoteId,
  chatId,
}: PaneWindowProps) {
  const { draggingSlot } = usePaneDrag();

  const switcher =
    kind === 'empty' ? undefined : <WindowKindSwitcher kind={kind as ContentWindowKind} onSetKind={onSetKind} disabled={locked} />;

  // Always rendered, disabled with a reason rather than silently vanishing. Closing a pane is
  // a layout change, so the layout lock has to block it too - otherwise "lock layout" fails at
  // the one thing it is for.
  const closeTooltip = locked
    ? 'Unlock the layout to close windows'
    : canClose
      ? 'Close this window'
      : 'The last window cannot be closed';
  const closeProps = { onClose, closeDisabled: locked || !canClose, closeTooltip };

  const content =
    kind === 'empty' ? (
      <EmptyPaneWindow
        onPickKind={onSetKind}
        onDismiss={canClose ? onDismiss : undefined}
        dragActive={draggingSlot !== null}
        locked={locked}
      />
    ) : kind === 'chat' && collapsed ? (
      <CollapsedChatStrip direction={parentDirection} onExpand={onToggleCollapse} />
    ) : kind === 'session' ? (
      <SessionNotesPanel
        slot={slot}
        worldId={worldId}
        campaignId={campaignId}
        note={displayedNote}
        switchableNotes={switchableNotes}
        onSwitchNote={onSwitchNote}
        onOpenSituationalTable={onOpenSituationalTable}
        kindSwitcher={switcher}
        {...closeProps}
      />
    ) : kind === 'chat' ? (
      <ChatPanel
        slot={slot}
        worldId={worldId}
        campaignId={campaignId}
        noteId={sessionNoteId}
        chatId={chatId}
        kindSwitcher={switcher}
        onCollapse={onToggleCollapse}
        parentDirection={parentDirection}
        {...closeProps}
      />
    ) : (
      <ItemsWindow slot={slot} worldId={worldId} campaignId={campaignId} kindSwitcher={switcher} {...closeProps} />
    );

  return (
    <Box sx={{ position: 'relative', display: 'flex', width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
      {content}
      <PaneDropZone slot={slot} label={kind === 'empty' ? 'this empty space' : KIND_LABELS[kind as ContentWindowKind]} />
    </Box>
  );
}
