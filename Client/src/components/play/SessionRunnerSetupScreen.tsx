import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import AddCommentIcon from '@mui/icons-material/AddCommentOutlined';
import ForumIcon from '@mui/icons-material/ForumOutlined';
import NotesDisabledIcon from '@mui/icons-material/BlockOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useSessionChatStore, getChatsForNote } from '../../store/useSessionChatStore';
import type { Note } from '../../types/note';
import type { SessionChat } from '../../types/sessionChat';

interface SessionRunnerSetupScreenProps {
  worldId: string;
  campaignId: string;
  sessionNotes: Note[];
  onComplete: (noteId: string, chatId: string | null) => void;
}

type ChatChoice = { kind: 'existing'; chatId: string } | { kind: 'new' } | { kind: 'none' };

function stripBBCode(body: string): string {
  return body
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function relativeLabel(ts: number): string {
  const diffDays = Math.floor((Date.now() - ts) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function newChatName(): string {
  return `Chat — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/** Single-page session picker (issues.txt 1.1/1.2) - two columns, session prep on the left and
 * its notes thread on the right, both pre-selected to their most-recently-updated item (the
 * right column falls back to "No notes thread" when none exist yet). One "Start running"
 * button commits both picks - as few clicks as possible for the common case of just accepting
 * the defaults. */
export function SessionRunnerSetupScreen({ worldId, campaignId, sessionNotes, onComplete }: SessionRunnerSetupScreenProps) {
  const navigate = useNavigate();
  const chats = useSessionChatStore((s) => s.chats);
  const fetchChatsForNote = useSessionChatStore((s) => s.fetchChatsForNote);
  const addChat = useSessionChatStore((s) => s.addChat);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(sessionNotes[0]?.id ?? null);
  const [chatChoice, setChatChoice] = useState<ChatChoice | null>(null);

  useEffect(() => {
    if (selectedNoteId) fetchChatsForNote(campaignId, selectedNoteId);
  }, [selectedNoteId, campaignId, fetchChatsForNote]);

  const existingChats = useMemo(() => getChatsForNote(chats, selectedNoteId ?? undefined), [chats, selectedNoteId]);

  // Default the right column once chats for the selected note are known - most recent
  // existing chat, or "No notes thread" when there aren't any (issues.txt 1.2).
  useEffect(() => {
    setChatChoice(existingChats.length > 0 ? { kind: 'existing', chatId: existingChats[0].id } : { kind: 'none' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId, existingChats.length]);

  const handleStart = () => {
    if (!selectedNoteId || !chatChoice) return;
    if (chatChoice.kind === 'existing') {
      onComplete(selectedNoteId, chatChoice.chatId);
      return;
    }
    if (chatChoice.kind === 'none') {
      onComplete(selectedNoteId, null);
      return;
    }
    const now = Date.now();
    const chat: SessionChat = {
      id: crypto.randomUUID(),
      campaignId,
      noteId: selectedNoteId,
      name: newChatName(),
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    addChat(chat);
    onComplete(selectedNoteId, chat.id);
  };

  if (sessionNotes.length === 0) {
    return (
      <Box sx={{ maxWidth: 640, mx: 'auto', py: 4 }}>
        <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', mb: 3 }}>
          <SportsEsportsIcon sx={{ fontSize: 48, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            What are you running today?
          </Typography>
        </Stack>
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 4, borderStyle: 'dashed', borderColor: 'divider' }}>
          <DescriptionIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            No session prep notes yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create one in Notes → Folders → Sessions, then come back here to run it.
          </Typography>
          <Button variant="contained" onClick={() => navigate(`/w/${worldId}/c/${campaignId}/notes?tab=folders`)}>
            Go to Notes
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1040, mx: 'auto', py: 4 }}>
      <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', mb: 4 }}>
        <SportsEsportsIcon sx={{ fontSize: 44, color: 'primary.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Run your session
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Run picks up your last session automatically - this screen is only for switching.
        </Typography>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 4 }}>
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Session prep
          </Typography>
          <Stack spacing={1.25}>
            {sessionNotes.map((note, idx) => {
              const isLatest = idx === 0;
              const selected = note.id === selectedNoteId;
              return (
                <Paper
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  elevation={selected ? 3 : 1}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: selected ? 'primary.main' : 'transparent',
                    transition: 'transform .15s, box-shadow .15s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 },
                  }}
                >
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                    <DescriptionIcon color={selected ? 'primary' : 'action'} fontSize="small" />
                    {isLatest && <Chip label="Most recent" size="small" color="primary" />}
                  </Stack>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.25 }} noWrap>
                    {note.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                    {relativeLabel(note.updatedAt)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                  >
                    {stripBBCode(note.body) || 'No content yet.'}
                  </Typography>
                </Paper>
              );
            })}
          </Stack>
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Notes thread
          </Typography>
          <Stack spacing={1.25}>
            <Paper
              onClick={() => setChatChoice({ kind: 'new' })}
              elevation={chatChoice?.kind === 'new' ? 3 : 1}
              sx={{
                p: 1.75,
                borderRadius: 3,
                cursor: 'pointer',
                border: '2px solid',
                borderColor: chatChoice?.kind === 'new' ? 'primary.main' : 'divider',
                borderStyle: chatChoice?.kind === 'new' ? 'solid' : 'dashed',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                transition: 'transform .15s, box-shadow .15s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
              }}
            >
              <AddCommentIcon color="primary" />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Start a fresh thread
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  New DM notes for tonight
                </Typography>
              </Box>
            </Paper>

            {existingChats.map((chat, idx) => {
              const selected = chatChoice?.kind === 'existing' && chatChoice.chatId === chat.id;
              return (
                <Paper
                  key={chat.id}
                  onClick={() => setChatChoice({ kind: 'existing', chatId: chat.id })}
                  elevation={selected ? 3 : 1}
                  sx={{
                    p: 1.75,
                    borderRadius: 3,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: selected ? 'primary.main' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    transition: 'transform .15s, box-shadow .15s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                  }}
                >
                  <ForumIcon color="action" />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                        {chat.name}
                      </Typography>
                      {idx === 0 && <Chip label="Most recent" size="small" variant="outlined" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {relativeLabel(chat.updatedAt)} · {chat.messages.length} note{chat.messages.length === 1 ? '' : 's'}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}

            <Divider sx={{ my: 0.5 }} />

            <Paper
              onClick={() => setChatChoice({ kind: 'none' })}
              elevation={chatChoice?.kind === 'none' ? 3 : 1}
              sx={{
                p: 1.75,
                borderRadius: 3,
                cursor: 'pointer',
                border: '2px solid',
                borderColor: chatChoice?.kind === 'none' ? 'primary.main' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                transition: 'transform .15s, box-shadow .15s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
              }}
            >
              <NotesDisabledIcon color="action" />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  No notes thread
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Skip DM notes for this session
                </Typography>
              </Box>
            </Paper>
          </Stack>
        </Box>
      </Box>

      <Button
        variant="contained"
        size="large"
        fullWidth
        startIcon={<PlayArrowIcon />}
        disabled={!selectedNoteId || !chatChoice}
        onClick={handleStart}
        sx={{ py: 1.5, borderRadius: 3, fontWeight: 700 }}
      >
        Start running
      </Button>
    </Box>
  );
}
