import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import SendIcon from '@mui/icons-material/Send';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import { EntityRefNode } from '../world/richtext/EntityRefNode';
import { useTipTapMentions } from '../../hooks/useTipTapMentions';

/** Enter submits, Shift+Enter adds a line, Escape cancels.
 *
 * A ProseMirror keymap rather than a React onKeyDown, so it sits in the same priority chain as
 * everything else the editor binds. It runs BEHIND the mention picker on purpose: the picker
 * listens in the capture phase and stops the event when it has a highlighted entry, so pressing
 * Enter to accept a mention can never also send the message. */
const SubmitKeys = Extension.create<{ onSubmit: () => boolean; onCancel: () => boolean }>({
  name: 'chatSubmitKeys',
  addOptions() {
    return { onSubmit: () => false, onCancel: () => false };
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => this.options.onSubmit(),
      Escape: () => this.options.onCancel(),
    };
  },
});

interface ChatComposerProps {
  worldId: string;
  campaignId: string;
  /** Seeds the editor - used when editing an existing message. */
  initialHtml?: string;
  placeholder?: string;
  /** Pane-sized rendering: tighter padding, no keyboard hint line. */
  compact?: boolean;
  autoFocus?: boolean;
  /** Called with the message HTML. The editor clears itself afterwards. */
  onSubmit: (html: string) => void;
  /** Renders Cancel and binds Escape. Omit when composing a new message. */
  onCancel?: () => void;
}

/** The one chat input: composing a new message and editing an existing one both render this.
 *
 * Chat messages used to be plain text with BBCode `[ref]` mentions typed into a textarea, while
 * every other body in the app had moved to the rich text editor - two body formats, and the one
 * surface with no formatting affordance at all (checklist I-N5). This closes that: messages are
 * HTML like everything else, with the same "@" mention picker and the same EntityRefNode.
 *
 * Deliberately a SMALL subset of the article toolbar - bold, italic, strikethrough, a bullet
 * list. A chat message is a jot, not a document; headings, tables and custom blocks would be
 * noise, so StarterKit's are switched off rather than merely left out of the toolbar. */
export function ChatComposer({
  worldId,
  campaignId,
  initialHtml = '',
  placeholder = 'Quick note… type "@" to mention',
  compact,
  autoFocus,
  onSubmit,
  onCancel,
}: ChatComposerProps) {
  // The handlers are inline arrows at every call site; held in refs so the extension can be
  // configured once and the editor is never torn down mid-typing.
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);

  const submitEditor = () => {
    const current = editorRef.current;
    if (!current || current.isEmpty) return;
    submitRef.current(current.getHTML());
    current.commands.clearContent(true);
  };

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
        link: false,
      }),
      Placeholder.configure({ placeholder }),
      EntityRefNode,
      SubmitKeys.configure({
        onSubmit: () => {
          submitEditor();
          return true;
        },
        onCancel: () => {
          if (!cancelRef.current) return false;
          cancelRef.current();
          return true;
        },
      }),
    ],
    // Only the placeholder is a real input - the handlers are read through refs, so the editor
    // must not be rebuilt when a parent re-renders with a new arrow function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placeholder],
  );

  const editor = useEditor({ extensions, content: initialHtml, immediatelyRender: false });
  editorRef.current = editor;

  const { MentionPickerElement } = useTipTapMentions({ editor, worldId, campaignId });

  useEffect(() => {
    if (editor && autoFocus) editor.commands.focus('end');
  }, [editor, autoFocus]);

  if (!editor) return null;

  const isEmpty = editor.isEmpty;

  const mark = (label: string, active: boolean, onClick: () => void, icon: ReactNode) => (
    <Tooltip key={label} title={label}>
      <ToggleButton
        size="small"
        value={label}
        aria-label={label}
        aria-pressed={active}
        selected={active}
        onChange={onClick}
        sx={{ border: 0, p: 0.4 }}
      >
        {icon}
      </ToggleButton>
    </Tooltip>
  );

  return (
    <Stack spacing={0.75} sx={{ width: '100%' }}>
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          px: compact ? 1 : 1.5,
          py: compact ? 0.5 : 0.75,
          bgcolor: 'background.paper',
          '& .ProseMirror': {
            outline: 'none',
            fontSize: compact ? 14 : 15,
            lineHeight: 1.6,
            maxHeight: compact ? 140 : 220,
            overflowY: 'auto',
            '& p': { margin: '0.15em 0' },
            '& ul': { paddingLeft: '1.3em', margin: '0.25em 0' },
          },
          '& .ProseMirror p.is-editor-empty:first-of-type::before': {
            content: 'attr(data-placeholder)',
            color: 'text.disabled',
            float: 'left',
            height: 0,
            pointerEvents: 'none',
          },
          '& .ProseMirror .ww-ref': {
            color: 'primary.main',
            fontWeight: 600,
            borderBottom: '1px dashed',
            borderColor: 'primary.main',
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>

      <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
        {mark('Bold', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <FormatBoldIcon fontSize="small" />)}
        {mark('Italic', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <FormatItalicIcon fontSize="small" />)}
        {mark('Strikethrough', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), <StrikethroughSIcon fontSize="small" />)}
        {mark('Bulleted list', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <FormatListBulletedIcon fontSize="small" />)}

        {!compact && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            Enter sends · Shift+Enter adds a line{onCancel ? ' · Esc cancels' : ''}
          </Typography>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {onCancel && (
          <Button size="small" color="inherit" startIcon={<CloseIcon fontSize="small" />} onClick={onCancel}>
            Cancel
          </Button>
        )}
        {onCancel ? (
          <Button size="small" variant="contained" startIcon={<CheckIcon fontSize="small" />} disabled={isEmpty} onClick={submitEditor}>
            Save
          </Button>
        ) : (
          <Tooltip title="Send">
            <span>
              <IconButton color="primary" aria-label="Send" disabled={isEmpty} onClick={submitEditor}>
                <SendIcon />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>

      {MentionPickerElement}
    </Stack>
  );
}
