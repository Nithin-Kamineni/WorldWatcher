import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { ChatComposer } from '../../components/notes/ChatComposer';
import { ChatMessageRow } from '../../components/notes/ChatMessageRow';
import { ConfirmDeleteDialog } from '../../components/dm/ConfirmDeleteDialog';
import { openChatInPlay } from '../../components/play/openChatInPlay';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';
import { useNoteStore, getNoteById } from '../../store/useNoteStore';
import { useSessionChatStore } from '../../store/useSessionChatStore';
import type { ChatMessage } from '../../types/sessionChat';
import { PageTitle } from '../../components/shell/PageTitle';

/** How many messages the transcript opens with, and how many each "show earlier" step adds. */
const TRANSCRIPT_PAGE = 50;

function formatDayLabel(ts: number): string {
  const day = new Date(ts);
  const today = new Date();
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (isSameDay(day, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(day, yesterday)) return 'Yesterday';
  return day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

/** The standalone page for one DM-notes thread - /w/:worldId/c/:campaignId/chats/:chatId.
 *
 * This exists because "view" and "edit" on a saved thread used to bounce the DM into the Play
 * page, which is the session-running workspace: it rearranges panes, anchors itself to a
 * session note and gives the thread a cramped pane with no way to touch a message once sent.
 * Reading and revising a thread is document work, so it gets a document page - full width,
 * a day-separated transcript, per-message edit and delete, search across the thread, and
 * inline rename. Running the thread live is still one click away ("Run in Play"), which is
 * now the ONLY thing that opens the Play page.
 *
 * Messages stay BBCode with `[ref]` mentions (same as the Play composer, same
 * EntityRefPreview render) - the format is shared with the Play chat pane, so a thread edited
 * here and a thread typed there are the same thread. */
export function ChatDetailPage() {
  const { worldId, campaignId, chatId } = useParams<{ worldId: string; campaignId: string; chatId: string }>();
  const navigate = useNavigate();

  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const campaign = getCampaignById(campaigns, campaignId);

  const notes = useNoteStore((s) => s.notes);
  const ensureSeeded = useNoteStore((s) => s.ensureSeeded);

  const chats = useSessionChatStore((s) => s.chats);
  const fetchChatsForCampaign = useSessionChatStore((s) => s.fetchChatsForCampaign);
  const appendMessage = useSessionChatStore((s) => s.appendMessage);
  const updateMessage = useSessionChatStore((s) => s.updateMessage);
  const deleteMessage = useSessionChatStore((s) => s.deleteMessage);
  const renameChat = useSessionChatStore((s) => s.renameChat);

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null);

  useEffect(() => {
    if (campaignId) ensureSeeded(campaignId);
  }, [campaignId, ensureSeeded]);

  // A chat page can be opened cold (a bookmark, a link out of Notes), so the whole campaign's
  // threads are loaded rather than assuming a per-note fetch already ran.
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    setLoading(true);
    fetchChatsForCampaign(campaignId).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, fetchChatsForCampaign]);

  const chat = chats.find((c) => c.id === chatId);

  /** Ids of the messages matching the current query. Search HIGHLIGHTS rather than filtering:
   * pulling the non-matching messages out threw away the day separators and the surrounding
   * lines, which are most of what makes a transcript readable (checklist I-N4). */
  const matchIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!chat || !q) return [] as string[];
    return chat.messages.filter((m) => m.text.toLowerCase().includes(q)).map((m) => m.id);
  }, [chat, query]);
  const matchSet = useMemo(() => new Set(matchIds), [matchIds]);

  /** How many of the most recent messages are rendered. A campaign-long thread is thousands of
   * lines and every one of them mounts a rich-text render, so the transcript opens on its tail
   * and loads older ones a page at a time - the same shape the Items sub-windows use. */
  const [visibleCount, setVisibleCount] = useState<number>(TRANSCRIPT_PAGE);
  useEffect(() => {
    setVisibleCount(TRANSCRIPT_PAGE);
  }, [chatId]);

  // A match hidden behind paging would look like "no results", so the window is widened to
  // reach the earliest one whenever the query changes.
  const earliestMatchIndex = useMemo(() => {
    if (!chat || matchIds.length === 0) return -1;
    return chat.messages.findIndex((m) => m.id === matchIds[0]);
  }, [chat, matchIds]);
  useEffect(() => {
    if (!chat || earliestMatchIndex < 0) return;
    const needed = chat.messages.length - earliestMatchIndex;
    setVisibleCount((current) => (needed > current ? needed : current));
  }, [chat, earliestMatchIndex]);

  const hiddenCount = chat ? Math.max(0, chat.messages.length - visibleCount) : 0;

  const days = useMemo(() => {
    if (!chat) return [];
    const visible = chat.messages.slice(Math.max(0, chat.messages.length - visibleCount));
    const groups: { label: string; messages: ChatMessage[] }[] = [];
    for (const message of visible) {
      const label = formatDayLabel(message.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.messages.push(message);
      else groups.push({ label, messages: [message] });
    }
    return groups;
  }, [chat, visibleCount]);

  /** Steps through the highlighted matches, since they now stay in place in the transcript
   * rather than being collected into a filtered list. */
  const [matchCursor, setMatchCursor] = useState(0);
  useEffect(() => {
    setMatchCursor(0);
  }, [query]);
  const goToMatch = (delta: number) => {
    if (matchIds.length === 0) return;
    const next = (matchCursor + delta + matchIds.length) % matchIds.length;
    setMatchCursor(next);
    document.getElementById(`chat-message-${matchIds[next]}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  if (!worldId || !campaignId) return <Navigate to="/dashboard" replace />;

  if (loading && !chat) {
    return (
      <SectionLayout worldId={worldId} campaignId={campaignId}>
        <Stack sx={{ alignItems: 'center', py: 8 }}>
          <CircularProgress />
        </Stack>
      </SectionLayout>
    );
  }

  if (!chat) return <Navigate to={`/w/${worldId}/c/${campaignId}/notes`} replace />;

  const anchorNote = getNoteById(notes, chat.noteId ?? undefined);
  const sessionNotes = notes.filter((n) => n.campaignId === campaignId && n.kind === 'session_prep');

  const commitRename = () => {
    const trimmed = (nameDraft ?? '').trim();
    if (trimmed && trimmed !== chat.name) renameChat(chat.id, trimmed);
    setNameDraft(null);
  };

  const messageCount = chat.messages.length;

  return (
    <SectionLayout worldId={worldId} campaignId={campaignId}>
      <Breadcrumbs
        items={[
          { label: world?.name ?? '…', to: `/w/${worldId}/home` },
          { label: campaign?.name ?? '…', to: `/w/${worldId}/c/${campaignId}/home` },
          { label: 'Notes', to: `/w/${worldId}/c/${campaignId}/notes` },
          ...(anchorNote ? [{ label: anchorNote.name, to: `/w/${worldId}/c/${campaignId}/notes/${anchorNote.id}` }] : []),
          { label: chat.name },
        ]}
      />

      <Box sx={{ maxWidth: 920 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {nameDraft !== null ? (
            <TextField
              variant="standard"
              value={nameDraft}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setNameDraft(null);
              }}
              slotProps={{ input: { sx: { fontSize: 30, fontWeight: 700 } } }}
              sx={{ flexGrow: 1, minWidth: 260 }}
            />
          ) : (
            <PageTitle sx={{ flexGrow: 1, cursor: 'text' }}>
              <Box component="span" onClick={() => setNameDraft(chat.name)}>
                {chat.name}
              </Box>
            </PageTitle>
          )}
          <Chip label={`${messageCount} note${messageCount === 1 ? '' : 's'}`} size="small" variant="outlined" />
          {anchorNote && (
            <Button
              size="small"
              startIcon={<DescriptionOutlinedIcon fontSize="small" />}
              onClick={() => navigate(`/w/${worldId}/c/${campaignId}/notes/${anchorNote.id}`)}
            >
              Session note
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<PlayArrowIcon fontSize="small" />}
            onClick={() => openChatInPlay(chat, campaignId, worldId, sessionNotes, navigate)}
          >
            Run in Play
          </Button>
        </Stack>

        {messageCount > 0 && (
          <TextField
            size="small"
            fullWidth
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this thread…"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ mb: query.trim() ? 1 : 2 }}
          />
        )}

        {messageCount > 0 && query.trim() !== '' && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
            <Chip
              size="small"
              variant="outlined"
              label={matchIds.length === 0 ? 'No matches' : `${matchCursor + 1} of ${matchIds.length} matches`}
            />
            <Tooltip title="Previous match">
              <span>
                <IconButton size="small" aria-label="Previous match" disabled={matchIds.length === 0} onClick={() => goToMatch(-1)}>
                  <KeyboardArrowUpIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Next match">
              <span>
                <IconButton size="small" aria-label="Next match" disabled={matchIds.length === 0} onClick={() => goToMatch(1)}>
                  <KeyboardArrowDownIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )}

        {messageCount === 0 ? (
          <Paper variant="outlined" sx={{ borderRadius: 3, p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              This thread is empty. Anything you write below is saved to it straight away.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {hiddenCount > 0 && (
              <Button size="small" onClick={() => setVisibleCount((c) => c + TRANSCRIPT_PAGE)}>
                Show {Math.min(TRANSCRIPT_PAGE, hiddenCount)} earlier message{Math.min(TRANSCRIPT_PAGE, hiddenCount) === 1 ? '' : 's'} ({hiddenCount} older)
              </Button>
            )}
            {days.map((day) => (
              <Box key={day.label}>
                <Divider sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {day.label}
                  </Typography>
                </Divider>
                <Stack spacing={1}>
                  {day.messages.map((message) => (
                    <Box key={message.id} id={`chat-message-${message.id}`}>
                    <ChatMessageRow
                      message={message}
                      worldId={worldId}
                      campaignId={campaignId}
                      chatName={chat.name}
                      onSave={(text) => updateMessage(chat.id, message.id, text)}
                      onDelete={() => setPendingDelete(message)}
                      highlighted={matchSet.has(message.id)}
                    />
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}

        <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5, mt: 3 }}>
          <ChatComposer
            worldId={worldId}
            campaignId={campaignId}
            placeholder='Add to this thread… type "@" to mention an NPC, place, map, encounter…'
            onSubmit={(html) => appendMessage(chat.id, html)}
          />
        </Paper>
      </Box>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        itemType="message"
        itemName={(pendingDelete?.text ?? '').slice(0, 60)}
        description="will be removed from this thread."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteMessage(chat.id, pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </SectionLayout>
  );
}
