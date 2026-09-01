import { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import SmartButtonIcon from '@mui/icons-material/SmartButton';
import { MiniRichTextEditor } from './MiniRichTextEditor';

interface ButtonBlockAttrs {
  label: string;
  mode: 'link' | 'popup';
  url: string;
  popupTitle: string;
  popupBody: string;
}

function ButtonBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const { label, mode, url, popupTitle, popupBody } = node.attrs as ButtonBlockAttrs;
  const [editingContent, setEditingContent] = useState(false);
  const [viewingPopup, setViewingPopup] = useState(false);

  if (!editor.isEditable) {
    return (
      <NodeViewWrapper style={{ display: 'inline-block', margin: '4px 0' }}>
        <Button
          variant="contained"
          startIcon={<SmartButtonIcon />}
          onClick={() => {
            if (mode === 'link') {
              if (url) window.open(url, '_blank', 'noopener,noreferrer');
            } else {
              setViewingPopup(true);
            }
          }}
        >
          {label || 'Button'}
        </Button>
        <Dialog open={viewingPopup} onClose={() => setViewingPopup(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{popupTitle || label || 'Details'}</DialogTitle>
          <DialogContent>
            <MiniRichTextEditor value={popupBody} editable={false} />
          </DialogContent>
        </Dialog>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      contentEditable={false}
      style={{ margin: '12px 0', border: '1px dashed rgba(0,0,0,0.25)', borderRadius: 10, padding: 12 }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <SmartButtonIcon fontSize="small" color="action" />
          <TextField
            size="small"
            label="Button label"
            value={label}
            onChange={(e) => updateAttributes({ label: e.target.value })}
            sx={{ flex: 1 }}
          />
          <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_e, v) => v && updateAttributes({ mode: v })}>
            <ToggleButton value="link">Open link</ToggleButton>
            <ToggleButton value="popup">Show popup</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {mode === 'link' ? (
          <TextField
            size="small"
            label="URL (opens in a new tab)"
            placeholder="https://…"
            value={url}
            onChange={(e) => updateAttributes({ url: e.target.value })}
            fullWidth
          />
        ) : (
          <Button size="small" variant="outlined" onClick={() => setEditingContent(true)} sx={{ alignSelf: 'flex-start' }}>
            Edit popup content
          </Button>
        )}

        <Box>
          <Button variant="contained" disabled startIcon={<SmartButtonIcon />}>
            {label || 'Button'}
          </Button>
        </Box>
      </Stack>

      <Dialog open={editingContent} onClose={() => setEditingContent(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <TextField
            variant="standard"
            label="Popup title"
            value={popupTitle}
            onChange={(e) => updateAttributes({ popupTitle: e.target.value })}
            fullWidth
          />
        </DialogTitle>
        <DialogContent>
          <MiniRichTextEditor value={popupBody} onChange={(html) => updateAttributes({ popupBody: html })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingContent(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </NodeViewWrapper>
  );
}

/** A clickable button the reader can insert inline - "Open link" opens a URL in a new browser
 * tab, "Show popup" shows a small rich-text blurb in an in-app dialog (more reliable than a
 * literal window.open() popup, which browsers routinely block). Deliberately an atom node:
 * the popup's body is edited via its own small MiniRichTextEditor dialog rather than living as
 * real nested ProseMirror content, both to keep this node simple and to avoid a circular import
 * with TipTapArticleEditor (which needs to register this node as one of its extensions). */
export const ButtonBlock = Node.create({
  name: 'buttonBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      label: {
        default: 'Button',
        parseHTML: (el) => el.getAttribute('data-label') ?? 'Button',
        renderHTML: (attrs) => ({ 'data-label': attrs.label }),
      },
      mode: {
        default: 'popup',
        parseHTML: (el) => (el.getAttribute('data-mode') === 'link' ? 'link' : 'popup'),
        renderHTML: (attrs) => ({ 'data-mode': attrs.mode }),
      },
      url: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-url') ?? '',
        renderHTML: (attrs) => ({ 'data-url': attrs.url }),
      },
      popupTitle: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-popup-title') ?? '',
        renderHTML: (attrs) => ({ 'data-popup-title': attrs.popupTitle }),
      },
      popupBody: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-popup-body') ?? '',
        renderHTML: (attrs) => ({ 'data-popup-body': attrs.popupBody }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="button-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'button-block' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ButtonBlockView);
  },
});
