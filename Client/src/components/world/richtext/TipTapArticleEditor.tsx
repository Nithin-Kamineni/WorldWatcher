import { useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Box from '@mui/material/Box';
import { CollapsibleBlock } from './CollapsibleBlockNode';
import { EntityRefNode } from './EntityRefNode';
import { SecretBlock } from './SecretBlockNode';
import { ButtonBlock } from './ButtonBlockNode';
import { ArticleEditorToolbar } from './ArticleEditorToolbar';
import { useTipTapMentions } from '../../../hooks/useTipTapMentions';

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Lets a checkbox be ticked in a READ-ONLY render, and persists the tick.
 *
 * This is what makes a session-prep checklist actually a checklist (checklist I-N2 / F2.2): the
 * DM reads the note during play, not in the editor, so a box that can only be ticked in Write
 * mode is a styled bullet. TaskItem's own node view refuses to change a read-only document and
 * has no way to hand us the item's position, so the work is split: `onReadOnlyChecked` returns
 * true purely to stop it reverting the visual tick, and this plugin does the real document
 * edit, resolving the item from the checkbox's own DOM node. The resulting transaction goes
 * through the editor's normal onUpdate, so the new HTML reaches the caller like any other edit.
 *
 * Only added when the caller supplied an onChange for a non-editable render - a genuinely
 * read-only render still refuses the tick rather than showing one it cannot save. */
const ReadOnlyTaskToggle = Extension.create({
  name: 'readOnlyTaskToggle',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            change: (view, event) => {
              const target = event.target;
              if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return false;
              const item = target.closest('li');
              if (!item) return false;
              const $pos = view.state.doc.resolve(view.posAtDOM(item, 0));
              for (let depth = $pos.depth; depth > 0; depth--) {
                const node = $pos.node(depth);
                if (node.type.name !== 'taskItem') continue;
                view.dispatch(view.state.tr.setNodeMarkup($pos.before(depth), undefined, { ...node.attrs, checked: target.checked }));
                return true;
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});

/** Extensions shared by every article body/preview instance - kept in one place so the write
 * (editable) and read (view) renders of an article always support exactly the same content,
 * including the custom Collapsible/Secret/Button blocks. Deliberately NOT reused by
 * MiniRichTextEditor (Button block's popup editor) - see that file for why. */
function useArticleExtensions(placeholder?: string, readOnlyTaskToggle = false) {
  return useMemo(
    () => [
      StarterKit.configure({
        link: {
          openOnClick: false,
          protocols: ['http', 'https'],
          isAllowedUri: (url, ctx) => isSafeUrl(url) && ctx.defaultValidate(url),
        },
      }),
      TextStyleKit.configure({ backgroundColor: false }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image,
      TableKit.configure({ table: { resizable: false } }),
      // Not part of StarterKit despite living in the same @tiptap/extension-list package, so
      // both halves are declared here.
      TaskList,
      TaskItem.configure({
        nested: true,
        onReadOnlyChecked: readOnlyTaskToggle ? () => true : undefined,
      }),
      Subscript,
      Superscript,
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
      CollapsibleBlock,
      SecretBlock,
      ButtonBlock,
      EntityRefNode,
      ...(readOnlyTaskToggle ? [ReadOnlyTaskToggle] : []),
    ],
    [placeholder, readOnlyTaskToggle],
  );
}

/** Shared ProseMirror content styling for both edit and read renders - headings, lists,
 * blockquote, table borders, the Placeholder extension's empty-state text, and the Docs-style
 * page canvas (only applied while editable; the read view keeps ArticleContentView's existing
 * flowing-text look instead of nesting another "page" inside the article page). */
function editorContentSx(editable: boolean, minHeight = 420) {
  return {
    '& .ProseMirror': {
      outline: 'none',
      minHeight: editable ? minHeight : 'auto',
      fontSize: editable ? 15 : 16,
      lineHeight: 1.7,
      color: editable ? 'text.primary' : 'text.secondary',
    },
    '& .ProseMirror p.is-editor-empty:first-of-type::before': {
      content: 'attr(data-placeholder)',
      color: 'text.disabled',
      float: 'left',
      height: 0,
      pointerEvents: 'none',
    },
    '& .ProseMirror h1, & .ProseMirror h2, & .ProseMirror h3': { fontWeight: 700, margin: '0.7em 0 0.4em' },
    '& .ProseMirror blockquote': {
      margin: '0.5em 0',
      padding: '0.5em 1em',
      borderLeft: '3px solid currentColor',
      opacity: 0.85,
    },
    '& .ProseMirror ul, & .ProseMirror ol': { paddingLeft: '1.4em', margin: '0.4em 0' },
    // Task lists (TaskItem's node view renders li > label > input + div). The checkbox is its
    // own column so a wrapped item's second line lines up with its text, not under the box.
    '& .ProseMirror ul[data-type="taskList"]': { listStyle: 'none', paddingLeft: 0 },
    '& .ProseMirror ul[data-type="taskList"] li': { display: 'flex', alignItems: 'flex-start', gap: '0.55em' },
    '& .ProseMirror ul[data-type="taskList"] li > label': { flexShrink: 0, marginTop: '0.2em', userSelect: 'none' },
    '& .ProseMirror ul[data-type="taskList"] li > div': { flexGrow: 1, minWidth: 0, '& p': { margin: 0 } },
    '& .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div': { textDecoration: 'line-through', opacity: 0.6 },
    '& .ProseMirror ul[data-type="taskList"] input[type="checkbox"]': { cursor: 'pointer', accentColor: 'currentColor' },
    '& .ProseMirror img': { display: 'block', maxWidth: '100%', margin: '0.5em 0', borderRadius: 8 },
    '& .ProseMirror a': { color: 'primary.main' },
    '& .ProseMirror table': { borderCollapse: 'collapse', margin: '0.6em 0' },
    '& .ProseMirror td, & .ProseMirror th': { border: '1px solid', borderColor: 'divider', padding: '4px 8px' },
    '& .ProseMirror th': { fontWeight: 700, bgcolor: 'action.hover' },
    '& .ProseMirror pre': { bgcolor: 'action.hover', borderRadius: 6, padding: '0.6em 0.8em', overflowX: 'auto' },
    // Entity mentions (EntityRefNode) - same look the read-side EntityRefPreview gives them,
    // so a mention doesn't change appearance when the DM flips between Write and Preview.
    '& .ProseMirror .ww-ref': {
      color: 'primary.main',
      fontWeight: 600,
      borderBottom: '1px dashed',
      borderColor: 'primary.main',
      cursor: editable ? 'text' : 'pointer',
    },
  } as const;
}

interface TipTapArticleEditorProps {
  value: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  /** Turns on "@"-mentions of NPCs/Creatures/Spells/Encounters/Places/Factions, scoped to this
   * world+campaign (Notes and the Play quick-editor pass it; articles don't). The mention
   * NODE is always in the schema either way, so a body written with mentions still renders
   * them wherever it is shown. */
  mentions?: { worldId: string; campaignId: string };
  /** Editing-canvas height, in px. The default suits a full page; a pane-sized editor (the
   * Play page's quick edit) wants a shorter one so its own scroll container still works. */
  minHeight?: number;
}

/** A read-only render is togglable exactly when its caller gave it somewhere to save to - see
 * ReadOnlyTaskToggle. */

/** The app's one rich text body editor - articles, notes (NoteDetailPage) and Play's quick
 * edit (SessionNotesPanel) all render this, which is what keeps a note's formatting and an
 * article's identical. Replaces BBCodeEditor: a Google Docs/Word-style editor (write
 * mode) or the equivalent read-only render (used by ArticleContentView), sharing the same
 * extensions/NodeViews so Collapsible/Secret/Button blocks behave identically either way. The
 * `value` passed in must already be HTML - see bbcodeMigration.ts for converting a legacy
 * BBCode article body once, at the two call sites (ArticleForm, ArticleContentView). */
export function TipTapArticleEditor({ value, onChange, editable = true, placeholder, mentions, minHeight }: TipTapArticleEditorProps) {
  const readOnlyTaskToggle = !editable && !!onChange;
  const extensions = useArticleExtensions(placeholder, readOnlyTaskToggle);

  // onChange is usually an inline arrow - held in a ref so the editor is not torn down and
  // rebuilt (losing the caret) every time the parent re-renders.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    editable,
    immediatelyRender: false,
    extensions,
    content: value,
    onUpdate: ({ editor }) => onChangeRef.current?.(editor.getHTML()),
  });

  const { MentionPickerElement } = useTipTapMentions({
    editor,
    worldId: mentions?.worldId,
    campaignId: mentions?.campaignId,
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return null;

  if (!editable) {
    return (
      <Box sx={editorContentSx(false)}>
        <EditorContent editor={editor} />
      </Box>
    );
  }

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}>
      <ArticleEditorToolbar editor={editor} />
      <Box sx={{ px: { xs: 2.5, sm: 5 }, py: 3, ...editorContentSx(true, minHeight) }}>
        <EditorContent editor={editor} />
      </Box>
      {MentionPickerElement}
    </Box>
  );
}
