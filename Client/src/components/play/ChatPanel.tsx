import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCommentIcon from '@mui/icons-material/AddCommentOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNewOutlined';
import { PaneHeader, type PaneCloseProps } from './layout/PaneHeader';
import type { PaneSlot } from './layout/playLayoutTrees';
import { ChatComposer } from '../notes/ChatComposer';
import { ChatMessageRow } from '../notes/ChatMessageRow';
import { ConfirmDeleteDialog } from '../dm/ConfirmDeleteDialog';
import { useSessionChatStore, getChatsForNote } from '../../store/useSessionChatStore';
import { usePlayUiStore } from '../../store/usePlayUiStore';
import { thinScrollbarSx, FLOATING_SCROLLBAR_CLASS } from '../../theme/scrollbarSx';
import type { ChatMessage, SessionChat } from '../../types/sessionChat';

interface ChatPanelProps extends PaneCloseProps {
  /** Which pane this panel occupies - the header uses it as its drag handle identity. */
  slot: PaneSlot;
  worldId: string;
  campaignId: string;
  noteId: string;
  chatId: string | null;
  /** Quarter-height layout (dense layouts) - tightens padding, nothing else changes. */
  compact?: boolean;
  kindSwitcher?: ReactNode;
}

function newChatName(): string {
  return `Chat — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/** The DM's own running scratchpad for a session - not a player-facing chat. Anything worth
 * remembering mid-scene gets typed here and is saved to this note's session folder
 * (SessionChat, campaign+note scoped) as soon as it's sent; "@" mentions work the same as in
 * Notes (reuses useMentionInput/EntityRefPreview). When no chat has been picked yet (the setup
 * screen's "No notes thread" option, or a window freshly switched to this kind), renders a
 * blurred placeholder prompting the DM to choose or start one instead of an empty message list. */
export function ChatPanel({
  slot,
  worldId,
  campaignId,
  noteId,
  chatId,
  compact,
  kindSwitcher,
  ...closeProps
}: ChatPanelProps) {
  const chats = useSessionChatStore((s) => s.chats);
  const fetchChatsForNote = useSessionChatStore((s) => s.fetchChatsForNote);
  const addChat = useSessionChatStore((s) => s.addChat);
  const appendMessage = useSessionChatStore((s) => s.appendMessage);
  const updateMessage = useSessionChatStore((s) => s.updateMessage);
  const deleteMessage = useSessionChatStore((s) => s.deleteMessage);
  const setChat = usePlayUiStore((s) => s.setChat);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChatsForNote(campaignId, noteId);
  }, [campaignId, noteId, fetchChatsForNote]);

  const threads = getChatsForNote(chats, noteId);
  const activeChat = chatId ? chats.find((c) => c.id === chatId) : undefined;

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' });
  }, [activeChat?.messages.length]);

  const handleNewChat = () => {
    const now = Date.now();
    const chat: SessionChat = {
      id: crypto.randomUUID(),
      campaignId,
      noteId,
      name: newChatName(),
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    addChat(chat);
    setChat(campaignId, chat.id);
    setAnchorEl(null);
  };

  const noChatPicked = !chatId || !activeChat;

  return (
    <Paper
      variant="outlined"
      sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 1.5, overflow: 'hidden' }}
    >
      <PaneHeader
        slot={slot}
        leading={kindSwitcher ?? <ForumOutlinedIcon fontSize="small" color="action" />}
        title={activeChat?.name ?? 'DM Notes'}
        {...closeProps}
        actions={
          <>
            {/* Mid-session the DM could add to a thread here but had to find their way to the
                thread page by hand to do anything else with it (checklist I-N3). */}
            {activeChat && (
              <Tooltip title="Open this thread as a page">
                <IconButton
                  size="small"
                  aria-label="Open this thread as a page"
                  onClick={() => navigate(`/w/${worldId}/c/${campaignId}/chats/${activeChat.id}`)}
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Switch or start a chat">
              <IconButton size="small" aria-label="Switch or start a chat" onClick={(e) => setAnchorEl(e.currentTarget)}>
                <ExpandMoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        }
      />

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={handleNewChat}>
          <AddCommentIcon fontSize="small" sx={{ mr: 1 }} />
          Start a new chat
        </MenuItem>
        {threads.length > 0 && <Divider />}
        {threads.map((t) => (
          <MenuItem
            key={t.id}
            selected={t.id === chatId}
            onClick={() => {
              setChat(campaignId, t.id);
              setAnchorEl(null);
            }}
          >
            <ListItemText primary={t.name} secondary={`${t.messages.length} note${t.messages.length === 1 ? '' : 's'}`} />
          </MenuItem>
        ))}
      </Menu>

      {noChatPicked ? (
        <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              filter: 'blur(3px)',
              opacity: 0.4,
              px: 2,
              py: 1.5,
              pointerEvents: 'none',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Jot down anything worth remembering mid-session…
            </Typography>
          </Box>
          <Stack
            spacing={1.5}
            sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', px: 3, textAlign: 'center' }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              No notes thread selected
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={(e) => setAnchorEl(e.currentTarget)}>
                Choose a chat
              </Button>
              <Button size="small" variant="contained" onClick={handleNewChat}>
                Start a new chat
              </Button>
            </Stack>
          </Stack>
        </Box>
      ) : (
        <>
          <Box
            className={FLOATING_SCROLLBAR_CLASS}
            sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0, px: compact ? 1.25 : 2, py: compact ? 1 : 1.5, display: 'flex', flexDirection: 'column', gap: 1, ...thinScrollbarSx }}
          >
            {activeChat.messages.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ m: 'auto', textAlign: 'center', maxWidth: 260 }}>
                Jot down anything worth remembering mid-session - it's saved here automatically.
              </Typography>
            ) : (
              activeChat.messages.map((m) => (
                <ChatMessageRow
                  key={m.id}
                  message={m}
                  worldId={worldId}
                  campaignId={campaignId}
                  chatName={activeChat.name}
                  onSave={(text) => updateMessage(activeChat.id, m.id, text)}
                  onDelete={() => setPendingDelete(m)}
                  compact
                  enableItemsWindowFocus
                />
              ))
            )}
            <div ref={listEndRef} />
          </Box>

          <Box sx={{ p: compact ? 1 : 1.5, borderTop: 1, borderColor: 'divider' }}>
            <ChatComposer
              worldId={worldId}
              campaignId={campaignId}
              compact
              onSubmit={(html) => appendMessage(activeChat.id, html)}
            />
          </Box>
        </>
      )}
      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        itemType="message"
        itemName={(pendingDelete?.text ?? '').slice(0, 60)}
        description="will be removed from this thread."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete && activeChat) deleteMessage(activeChat.id, pendingDelete.id);
          setPendingDelete(null);
        }}
      />

    </Paper>
  );
}
