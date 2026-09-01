import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { buildEntityRefTag } from '../utils/bbcode';
import { getCaretCoordinates } from '../utils/caretPosition';
import { useMentionableEntities, type MentionableEntity } from './useMentionableEntities';
import { MentionPicker, type MentionPickerHandle } from '../components/notes/MentionPicker';

/** Scans back from the cursor for an unbroken "@query" token - "@" must start the campaign
 * (string start or preceded by whitespace) so ordinary text/emails never trigger it. Extracted
 * here (rather than duplicated per caller) since both BBCodeEditor and any other "@"-mention
 * text input share this exact detection rule. */
export function detectMentionQuery(value: string, cursor: number): { start: number; query: string } | null {
  let i = cursor - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === '@') {
      const before = value[i - 1];
      if (i === 0 || /\s/.test(before)) {
        return { start: i, query: value.slice(i + 1, cursor) };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

interface UseMentionInputOptions {
  value: string;
  onChange: (value: string) => void;
  /** When both are set, typing "@" opens the entity-mention picker (NPCs/Creatures/Spells/
   * Encounters/Places/Factions/Situational Tables) scoped to this world/campaign. Omit to
   * leave mentions off. */
  worldId?: string;
  campaignId?: string;
  /** MUI TextField's `inputRef` target - must point at the underlying `<textarea>` DOM node
   * (multiline TextField), since caret-coordinate math and selection APIs only exist there. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

interface UseMentionInputResult {
  mentionsEnabled: boolean;
  mentionableEntities: MentionableEntity[];
  mentionStart: number | null;
  mentionQuery: string;
  anchorPosition: { top: number; left: number; height: number } | null;
  pickerRef: RefObject<MentionPickerHandle | null>;
  /** Wire directly to the textarea/TextField's onChange - it both propagates the new value via
   * `onChange` and runs mention detection. Callers must not call `onChange` a second time. */
  handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** ArrowUp/Down/Enter/Tab/Escape handling for the picker while it's open; a no-op otherwise
   * so it's safe to wire unconditionally to the textarea's onKeyDown. */
  handleKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  handleSelectMention: (entity: MentionableEntity) => void;
  closeMention: () => void;
  /** The <MentionPicker ref={pickerRef} ... /> element, pre-wired to this hook's state - render
   * it wherever the caller wants it positioned in the tree instead of importing MentionPicker
   * directly. Null when mentions aren't enabled (worldId/campaignId missing). */
  MentionPickerElement: ReactNode;
}

/** Extracts the "@"-mention state/handlers that used to live inline in BBCodeEditor so a
 * second caller (a compact chat input, per the Play page groundwork) can get identical mention
 * behavior without duplicating it. Behavior is unchanged from the original inline version -
 * this is a pure extraction. */
export function useMentionInput(options: UseMentionInputOptions): UseMentionInputResult {
  const { value, onChange, worldId, campaignId, textareaRef } = options;
  const pickerRef = useRef<MentionPickerHandle>(null);
  const mentionsEnabled = Boolean(worldId && campaignId);
  const mentionableEntities = useMentionableEntities(worldId, campaignId);

  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [anchorPosition, setAnchorPosition] = useState<{ top: number; left: number; height: number } | null>(null);

  useEffect(() => {
    if (mentionStart === null || !textareaRef.current) {
      setAnchorPosition(null);
      return;
    }
    setAnchorPosition(getCaretCoordinates(textareaRef.current, mentionStart));
  }, [mentionStart, textareaRef]);

  const closeMention = () => {
    setMentionStart(null);
    setMentionQuery('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    onChange(nextValue);
    if (!mentionsEnabled) return;
    const cursor = e.target.selectionStart ?? nextValue.length;
    const match = detectMentionQuery(nextValue, cursor);
    if (match) {
      setMentionStart(match.start);
      setMentionQuery(match.query);
    } else {
      closeMention();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (mentionStart === null || !pickerRef.current) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      pickerRef.current.moveHighlight(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      pickerRef.current.moveHighlight(-1);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (pickerRef.current.confirmHighlighted()) e.preventDefault();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMention();
    }
  };

  const handleSelectMention = (entity: MentionableEntity) => {
    const el = textareaRef.current;
    if (!el || mentionStart === null) return;
    const cursor = el.selectionStart;
    const tag = buildEntityRefTag(entity.type, entity.id, entity.name);
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor ?? mentionStart);
    const next = `${before}${tag} ${after}`;
    onChange(next);
    closeMention();
    requestAnimationFrame(() => {
      el.focus();
      const newCursor = before.length + tag.length + 1;
      el.setSelectionRange(newCursor, newCursor);
    });
  };

  const MentionPickerElement = mentionsEnabled ? (
    <MentionPicker
      ref={pickerRef}
      open={mentionStart !== null}
      anchorPosition={anchorPosition}
      query={mentionQuery}
      entities={mentionableEntities}
      onSelect={handleSelectMention}
      onClose={closeMention}
    />
  ) : null;

  return {
    mentionsEnabled,
    mentionableEntities,
    mentionStart,
    mentionQuery,
    anchorPosition,
    pickerRef,
    handleChange,
    handleKeyDown,
    handleSelectMention,
    closeMention,
    MentionPickerElement,
  };
}
