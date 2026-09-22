import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import { ChatComposer } from './ChatComposer';
import { EntityRefPreview } from './EntityRefPreview';
import { toEditorHtml } from '../world/richtext/bbcodeMigration';
import type { ChatMessage } from '../../types/sessionChat';

function formatChatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

interface ChatMessageRowProps {
  message: ChatMessage;
  worldId: string;
  campaignId: string;
  chatName: string;
  onSave: (text: string) => void;
  onDelete: () => void;
  /** Pane-sized rendering - tighter padding and a smaller body, for the Play chat pane. */
  compact?: boolean;
  /** Play-page behaviour: a single click on an "@" mention opens it in the Items window. */
  enableItemsWindowFocus?: boolean;
  /** Marks this message as a search hit. Thread search HIGHLIGHTS rather than filters, so the
   * transcript keeps its shape and its day separators while you look through it
   * (checklist I-N4). */
  highlighted?: boolean;
}

/** One chat message: its rendered body plus the hover actions that make a thread something you
 * can *revise*, not only replay. Editing swaps the body for the same "@"-mention-aware input
 * the composer uses, so a mention can be added to an old line the way it was added to a new one.
 *
 * Shared deliberately. This lived inside ChatDetailPage, which is why the Play chat pane could
 * add to a thread but never correct it - mid-session, fixing a typo meant leaving Play by hand
 * (checklist I-N3). One component, both surfaces, so an edit affordance can never exist on only
 * one of them again. */
export function ChatMessageRow({ message, worldId, campaignId, chatName, onSave, onDelete, compact, enableItemsWindowFocus, highlighted }: ChatMessageRowProps) {
  const [editing, setEditing] = useState(false);

  return (
    <Paper
      variant={compact ? undefined : 'outlined'}
      elevation={0}
      sx={{
        borderRadius: compact ? 1.25 : 2,
        bgcolor: compact ? 'action.hover' : undefined,
        px: compact ? 1.5 : 2,
        py: compact ? 1 : 1.25,
        position: 'relative',
        ...(highlighted
          ? {
              borderColor: 'primary.main',
              boxShadow: (theme) => `inset 0 0 0 1px ${theme.palette.primary.main}`,
              bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
            }
          : null),
        '&:hover .message-actions': { opacity: 1 },
        '& .message-actions:focus-within': { opacity: 1 },
      }}
    >
      {editing ? (
        <ChatComposer
          worldId={worldId}
          campaignId={campaignId}
          // A message written before chat moved to the rich editor is BBCode; toEditorHtml
          // converts it on open exactly as notes do, and it saves back as HTML (I-N5).
          initialHtml={toEditorHtml(message.text)}
          compact={compact}
          autoFocus
          onSubmit={(html) => {
            if (html !== message.text) onSave(html);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <Stack
            className="message-actions"
            direction="row"
            spacing={0.25}
            sx={{ position: 'absolute', top: 4, right: 4, opacity: 0, transition: 'opacity 120ms' }}
          >
            <Tooltip title="Edit this message">
              <IconButton size="small" aria-label="Edit this message" onClick={() => setEditing(true)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete this message">
              <IconButton size="small" aria-label="Delete this message" color="error" onClick={onDelete}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <EntityRefPreview
            body={message.text}
            worldId={worldId}
            campaignId={campaignId}
            noteName={chatName}
            enableItemsWindowFocus={enableItemsWindowFocus}
            sx={{ fontSize: compact ? 14 : 15, lineHeight: 1.65, pr: 6 }}
          />
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
            {formatChatTime(message.createdAt)}
            {message.editedAt ? ` · edited ${formatChatTime(message.editedAt)}` : ''}
          </Typography>
        </>
      )}
    </Paper>
  );
}
