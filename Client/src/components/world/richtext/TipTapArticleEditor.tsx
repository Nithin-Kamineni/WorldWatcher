import { useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
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
import { SecretBlock } from './SecretBlockNode';
import { ButtonBlock } from './ButtonBlockNode';
import { ArticleEditorToolbar } from './ArticleEditorToolbar';

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Extensions shared by every article body/preview instance - kept in one place so the write
 * (editable) and read (view) renders of an article always support exactly the same content,
 * including the custom Collapsible/Secret/Button blocks. Deliberately NOT reused by
 * MiniRichTextEditor (Button block's popup editor) - see that file for why. */
function useArticleExtensions(placeholder?: string) {
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
      Subscript,
      Superscript,
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
      CollapsibleBlock,
      SecretBlock,
      ButtonBlock,
    ],
    [placeholder],
  );
}

/** Shared ProseMirror content styling for both edit and read renders - headings, lists,
 * blockquote, table borders, the Placeholder extension's empty-state text, and the Docs-style
 * page canvas (only applied while editable; the read view keeps ArticleContentView's existing
 * flowing-text look instead of nesting another "page" inside the article page). */
function editorContentSx(editable: boolean) {
  return {
    '& .ProseMirror': {
      outline: 'none',
      minHeight: editable ? 420 : 'auto',
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
    '& .ProseMirror img': { display: 'block', maxWidth: '100%', margin: '0.5em 0', borderRadius: 8 },
    '& .ProseMirror a': { color: 'primary.main' },
    '& .ProseMirror table': { borderCollapse: 'collapse', margin: '0.6em 0' },
    '& .ProseMirror td, & .ProseMirror th': { border: '1px solid', borderColor: 'divider', padding: '4px 8px' },
    '& .ProseMirror th': { fontWeight: 700, bgcolor: 'action.hover' },
    '& .ProseMirror pre': { bgcolor: 'action.hover', borderRadius: 6, padding: '0.6em 0.8em', overflowX: 'auto' },
  } as const;
}

interface TipTapArticleEditorProps {
  value: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
}

/** Replaces BBCodeEditor for article bodies: a Google Docs/Word-style rich text editor (write
 * mode) or the equivalent read-only render (used by ArticleContentView), sharing the same
 * extensions/NodeViews so Collapsible/Secret/Button blocks behave identically either way. The
 * `value` passed in must already be HTML - see bbcodeMigration.ts for converting a legacy
 * BBCode article body once, at the two call sites (ArticleForm, ArticleContentView). */
export function TipTapArticleEditor({ value, onChange, editable = true, placeholder }: TipTapArticleEditorProps) {
  const extensions = useArticleExtensions(placeholder);

  const editor = useEditor({
    editable,
    immediatelyRender: false,
    extensions,
    content: value,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
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
      <Box sx={{ px: { xs: 2.5, sm: 5 }, py: 3, ...editorContentSx(true) }}>
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
