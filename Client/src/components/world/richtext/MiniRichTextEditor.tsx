import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Box from '@mui/material/Box';

/** A small, self-contained rich text editor used for a Button block's popup content - kept
 * deliberately separate from TipTapArticleEditor (rather than nesting the full article editor,
 * which would need the custom Collapsible/Secret/Button node types and create a circular
 * import back to this file). Popup blurbs are meant to be short, so only basic formatting is
 * offered here - no tables/custom blocks. */
interface MiniRichTextEditorProps {
  value: string;
  onChange?: (html: string) => void;
  editable?: boolean;
}

export function MiniRichTextEditor({ value, onChange, editable = true }: MiniRichTextEditorProps) {
  const editor = useEditor({
    editable,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          protocols: ['http', 'https'],
          isAllowedUri: (url, ctx) => /^https?:\/\//i.test(url) && ctx.defaultValidate(url),
        },
      }),
    ],
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

  return (
    <Box
      sx={{
        '& .ProseMirror': {
          outline: 'none',
          minHeight: editable ? 100 : 'auto',
          fontSize: 14,
          lineHeight: 1.6,
        },
      }}
    >
      <EditorContent editor={editor} />
    </Box>
  );
}
