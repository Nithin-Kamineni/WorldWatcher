import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { detectMentionQuery } from './useMentionInput';
import { useMentionableEntities, type MentionableEntity } from './useMentionableEntities';
import { MentionPicker, type MentionPickerHandle } from '../components/notes/MentionPicker';

interface UseTipTapMentionsOptions {
  editor: Editor | null;
  /** Both must be set for mentions to be active - same contract as useMentionInput. */
  worldId?: string;
  campaignId?: string;
}

interface UseTipTapMentionsResult {
  mentionsEnabled: boolean;
  /** Render anywhere in the tree - the popover positions itself at the caret. */
  MentionPickerElement: ReactNode;
}

/** The "@"-mention picker for a TipTap editor - the rich-text sibling of useMentionInput,
 * which does the same job for a plain textarea. Deliberately not TipTap's own Suggestion
 * utility: the app already has one mention UI (MentionPicker, with its category chips and
 * imperative keyboard handle) and one detection rule (detectMentionQuery), and both are
 * reused verbatim here so a mention behaves identically in Notes and in an article body. The
 * only TipTap-specific parts are reading the query out of the current text block and
 * inserting an entityRef node instead of a `[ref]` string.
 *
 * Keyboard handling hangs off a CAPTURE-phase native listener on the editor's contenteditable
 * rather than a React onKeyDown: ProseMirror listens on that same element in the bubble phase
 * and does not consult event.defaultPrevented, so anything less would let Enter split the
 * paragraph before the picker ever saw the key. */
export function useTipTapMentions({ editor, worldId, campaignId }: UseTipTapMentionsOptions): UseTipTapMentionsResult {
  const pickerRef = useRef<MentionPickerHandle>(null);
  const mentionsEnabled = Boolean(worldId && campaignId);
  const mentionableEntities = useMentionableEntities(worldId, campaignId);

  /** Document position of the "@" that opened the picker - null while it's closed. Mirrored
   * into a ref for the native keydown listener, which is registered once per editor. */
  const [mentionFrom, setMentionFrom] = useState<number | null>(null);
  const mentionFromRef = useRef<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [anchorPosition, setAnchorPosition] = useState<{ top: number; left: number; height: number } | null>(null);

  const setMentionAt = (pos: number | null) => {
    mentionFromRef.current = pos;
    setMentionFrom(pos);
  };

  const closeMention = () => {
    setMentionAt(null);
    setMentionQuery('');
    setAnchorPosition(null);
  };

  useEffect(() => {
    if (!editor || !mentionsEnabled) return;

    const sync = () => {
      const { state } = editor;
      const { from, empty } = state.selection;
      if (!empty) {
        closeMention();
        return;
      }
      const $from = state.selection.$from;
      const blockStart = $from.start();
      // "￼" (object replacement char) keeps an existing mention node one character wide, so a
      // preceding mention can't swallow the "@" scan the way an empty string would.
      const textBefore = state.doc.textBetween(blockStart, from, '\n', '￼');
      const match = detectMentionQuery(textBefore, textBefore.length);
      if (!match) {
        closeMention();
        return;
      }
      const atPos = from - (textBefore.length - match.start);
      setMentionAt(atPos);
      setMentionQuery(match.query);
      const coords = editor.view.coordsAtPos(atPos);
      setAnchorPosition({ top: coords.top, left: coords.left, height: coords.bottom - coords.top });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (mentionFromRef.current === null || !pickerRef.current) return;
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === 'ArrowDown') {
        stop();
        pickerRef.current.moveHighlight(1);
      } else if (e.key === 'ArrowUp') {
        stop();
        pickerRef.current.moveHighlight(-1);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (pickerRef.current.confirmHighlighted()) stop();
      } else if (e.key === 'Escape') {
        stop();
        closeMention();
      }
    };

    const dom = editor.view.dom;
    editor.on('transaction', sync);
    dom.addEventListener('keydown', handleKeyDown, true);
    return () => {
      editor.off('transaction', sync);
      dom.removeEventListener('keydown', handleKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, mentionsEnabled]);

  const handleSelectMention = (entity: MentionableEntity) => {
    if (!editor || mentionFrom === null) return;
    const to = editor.state.selection.from;
    editor
      .chain()
      .focus()
      .deleteRange({ from: mentionFrom, to })
      .insertContent([
        { type: 'entityRef', attrs: { refType: entity.type, refId: entity.id, label: entity.name } },
        { type: 'text', text: ' ' },
      ])
      .run();
    closeMention();
  };

  const MentionPickerElement = mentionsEnabled ? (
    <MentionPicker
      ref={pickerRef}
      open={mentionFrom !== null}
      anchorPosition={anchorPosition}
      query={mentionQuery}
      entities={mentionableEntities}
      onSelect={handleSelectMention}
      onClose={closeMention}
    />
  ) : null;

  return { mentionsEnabled, MentionPickerElement };
}
