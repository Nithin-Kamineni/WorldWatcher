import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

/** Shared chrome for CollapsibleBlock and SecretBlock - both are "titled card whose body can
 * be toggled shut" node views, differing only in default openness and color treatment (Secret
 * reads as a spoiler/GM-only card, matching the amber "GM only" color ArticleContentView
 * already uses for Article.visibility). Toggling works identically in edit and read mode so a
 * reader can expand a Secret without needing edit access - there's no real permission system
 * in this app (single local user), so this is a spoiler aid, not access control. */
export function CollapsibleCardView({ node, updateAttributes, editor }: NodeViewProps & { variant?: 'collapsible' | 'secret' }) {
  const variant = (node.attrs.variant as 'collapsible' | 'secret') ?? 'collapsible';
  const { title, open } = node.attrs as { title: string; open: boolean };
  const isSecret = variant === 'secret';

  return (
    <NodeViewWrapper
      className="ww-card-block"
      style={{
        margin: '12px 0',
        border: `1px ${isSecret ? 'dashed' : 'solid'} ${isSecret ? 'var(--ww-secret-border, #c8873a)' : 'var(--ww-divider, rgba(0,0,0,0.15))'}`,
        borderRadius: 10,
        overflow: 'hidden',
        background: isSecret ? 'var(--ww-secret-bg, rgba(200,135,58,0.06))' : 'transparent',
      }}
    >
      <Box
        contentEditable={false}
        onClick={() => updateAttributes({ open: !open })}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.25,
          py: 0.75,
          bgcolor: isSecret ? 'transparent' : 'action.hover',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            updateAttributes({ open: !open });
          }}
        >
          {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
        {isSecret && <LockOutlinedIcon fontSize="small" sx={{ color: 'warning.main' }} />}
        <InputBase
          value={title}
          placeholder={isSecret ? 'Secret title' : 'Section title'}
          onChange={(e) => updateAttributes({ title: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          readOnly={!editor.isEditable}
          sx={{ fontWeight: 600, flex: 1, fontSize: 14 }}
        />
        {isSecret && !open && (
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', mr: 0.5 }}>
            GM only - click to reveal
          </Box>
        )}
      </Box>
      <NodeViewContent style={{ display: open ? 'block' : 'none', padding: '4px 16px 12px' }} />
    </NodeViewWrapper>
  );
}
