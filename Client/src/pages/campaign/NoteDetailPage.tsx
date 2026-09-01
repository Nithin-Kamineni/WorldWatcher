import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Autocomplete from '@mui/material/Autocomplete';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditNoteIcon from '@mui/icons-material/EditNoteOutlined';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { BBCodeEditor } from '../../components/world/BBCodeEditor';
import { EntityRefPreview } from '../../components/notes/EntityRefPreview';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';
import { useNoteStore, getNoteById, getFoldersForCampaign } from '../../store/useNoteStore';
import { useSessionChatStore, getChatsForNote } from '../../store/useSessionChatStore';
import { usePlayUiStore } from '../../store/usePlayUiStore';
import type { Note, NoteFolder } from '../../types/note';

/** Session notes' attached DM-chat threads (issues.txt 10.b.3: "must be saved in the folders
 * section in the session folder and I must be able to see it, also edit it") - shown/renamable
 * right on the session-prep note's own page, since that's this note's real home even though
 * SessionChat rows aren't literal sibling files inside NotesFolderExplorer's own listing. */
function AttachedChatsSection({ worldId, campaignId, noteId }: { worldId: string; campaignId: string; noteId: string }) {
  const navigate = useNavigate();
  const chats = useSessionChatStore((s) => s.chats);
  const fetchChatsForNote = useSessionChatStore((s) => s.fetchChatsForNote);
  const renameChat = useSessionChatStore((s) => s.renameChat);
  const startSession = usePlayUiStore((s) => s.startSession);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    fetchChatsForNote(campaignId, noteId);
  }, [campaignId, noteId, fetchChatsForNote]);

  const threads = getChatsForNote(chats, noteId);
  if (threads.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 3 }, mt: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        DM notes threads
      </Typography>
      <Stack spacing={1}>
        {threads.map((chat) => (
          <Stack
            key={chat.id}
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', p: 1, borderRadius: 2, border: 1, borderColor: 'divider' }}
          >
            <ForumOutlinedIcon fontSize="small" color="action" />
            {editingId === chat.id ? (
              <TextField
                size="small"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = draft.trim();
                  if (trimmed) renameChat(chat.id, trimmed);
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                sx={{ flexGrow: 1 }}
              />
            ) : (
              <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 600 }}>
                {chat.name}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {chat.messages.length} note{chat.messages.length === 1 ? '' : 's'}
            </Typography>
            <IconButton
              size="small"
              onClick={() => {
                setDraft(chat.name);
                setEditingId(chat.id);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <Button
              size="small"
              startIcon={<PlayArrowIcon fontSize="small" />}
              onClick={() => {
                startSession(campaignId, noteId, chat.id);
                navigate(`/w/${worldId}/c/${campaignId}/play`);
              }}
            >
              Run
            </Button>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function TagListField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Autocomplete<string, true, false, true>
      multiple
      freeSolo
      options={[]}
      value={value}
      onChange={(_e, next) => onChange(next as string[])}
      renderValue={(vals, getItemProps) => vals.map((tag, index) => <Chip label={tag} size="small" {...getItemProps({ index })} key={tag} />)}
      renderInput={(params) => <TextField {...params} label="Tags" placeholder="Type and press Enter" />}
    />
  );
}

/** Create/edit/read page for a single Note - handles both /notes/new (create into ?folderId=)
 * and /notes/:noteId (edit an existing one). Mirrors ArticleDetailPage's shape but far
 * simpler: no type picker, no linked-entity flow, just name + tags + BBCode body, saved via
 * one explicit Save button (own state, not autosave-on-blur, so a half-edited body can't be
 * silently persisted mid-keystroke) - renaming is the one exception, committed immediately from
 * the breadcrumb pencil icon, matching NotesFolderExplorer's inline-rename convention. */
export function NoteDetailPage() {
  const { worldId, campaignId, noteId } = useParams<{ worldId: string; campaignId: string; noteId?: string }>();
  const [searchParams] = useSearchParams();
  const folderIdParam = searchParams.get('folderId');
  const navigate = useNavigate();

  const worlds = useWorldStore((s) => s.worlds);
  const world = getWorldById(worlds, worldId);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const campaign = getCampaignById(campaigns, campaignId);

  const notes = useNoteStore((s) => s.notes);
  const folders = useNoteStore((s) => s.folders);
  const ensureSeeded = useNoteStore((s) => s.ensureSeeded);
  const addNote = useNoteStore((s) => s.addNote);
  const updateNote = useNoteStore((s) => s.updateNote);

  useEffect(() => {
    if (campaignId) ensureSeeded(campaignId);
  }, [campaignId, ensureSeeded]);

  const isNew = !noteId;
  const existing = getNoteById(notes, noteId);
  const campaignFolders = getFoldersForCampaign(folders, campaignId);
  const folder = campaignFolders.find((f) => f.id === (existing?.folderId ?? folderIdParam));

  const folderPath = useMemo(() => {
    const chain: NoteFolder[] = [];
    let cursor = folder ?? null;
    while (cursor) {
      chain.unshift(cursor);
      cursor = campaignFolders.find((f) => f.id === cursor!.parentId) ?? null;
    }
    return chain;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder?.id, campaignFolders]);

  const [name, setName] = useState(existing?.name ?? 'Untitled note');
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [body, setBody] = useState(existing?.body ?? '');
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);

  useEffect(() => {
    setName(existing?.name ?? 'Untitled note');
    setTags(existing?.tags ?? []);
    setBody(existing?.body ?? '');
    setDirty(false);
    setIsEditingName(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  if (!worldId || !campaignId) return <Navigate to="/dashboard" replace />;
  if (!isNew && !existing) return <Navigate to={`/w/${worldId}/c/${campaignId}/notes`} replace />;

  const handleSave = () => {
    const trimmedName = name.trim() || 'Untitled note';
    if (isNew) {
      const note: Note = {
        id: crypto.randomUUID(),
        campaignId,
        folderId: folderIdParam,
        name: trimmedName,
        kind: null,
        body,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addNote(note);
      navigate(`/w/${worldId}/c/${campaignId}/notes/${note.id}`, { replace: true });
    } else if (existing) {
      updateNote(existing.id, { name: trimmedName, tags, body });
      setDirty(false);
    }
  };

  const startEditingName = () => {
    setNameDraft(name);
    setIsEditingName(true);
  };
  const commitNameEdit = () => {
    const trimmed = nameDraft.trim() || 'Untitled note';
    setName(trimmed);
    setIsEditingName(false);
    if (!isNew && existing) updateNote(existing.id, { name: trimmed });
  };
  const cancelNameEdit = () => setIsEditingName(false);

  return (
    <SectionLayout worldId={worldId} campaignId={campaignId}>
      <MuiBreadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component={RouterLink} to={`/w/${worldId}/home`} underline="hover" color="inherit">
          {world?.name ?? '…'}
        </Link>
        <Link component={RouterLink} to={`/w/${worldId}/c/${campaignId}/home`} underline="hover" color="inherit">
          {campaign?.name ?? '…'}
        </Link>
        <Link component={RouterLink} to={`/w/${worldId}/c/${campaignId}/notes`} underline="hover" color="inherit">
          Notes
        </Link>
        {folderPath.map((f) => (
          <Link
            key={f.id}
            component={RouterLink}
            to={`/w/${worldId}/c/${campaignId}/notes?folderId=${f.id}`}
            underline="hover"
            color="inherit"
          >
            {f.name}
          </Link>
        ))}
        {isEditingName ? (
          <Stack direction="row" spacing={0.5} component="span" sx={{ alignItems: 'center', display: 'inline-flex' }}>
            <TextField
              size="small"
              variant="standard"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitNameEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitNameEdit();
                if (e.key === 'Escape') cancelNameEdit();
              }}
              sx={{ minWidth: 180 }}
            />
            <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={commitNameEdit}>
              <CheckIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={cancelNameEdit}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        ) : (
          <Stack direction="row" spacing={0.5} component="span" sx={{ alignItems: 'center', display: 'inline-flex' }}>
            <Typography color="text.primary" sx={{ fontWeight: 700 }}>
              {name}
            </Typography>
            <IconButton size="small" onClick={startEditingName}>
              <EditIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        )}
      </MuiBreadcrumbs>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, mb: 3 }}>
          <Box sx={{ width: { xs: '100%', md: '45%' } }}>
            <TagListField
              value={tags}
              onChange={(next) => {
                setTags(next);
                setDirty(true);
              }}
            />
          </Box>

          <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_e, v) => v && setMode(v)}>
            <ToggleButton value="write">
              <EditNoteIcon fontSize="small" sx={{ mr: 0.5 }} /> Write
            </ToggleButton>
            <ToggleButton value="preview">
              <VisibilityIcon fontSize="small" sx={{ mr: 0.5 }} /> Preview
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ flexGrow: 1 }} />

          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={!isNew && !dirty}>
            Save
          </Button>
        </Stack>

        {mode === 'write' ? (
          <BBCodeEditor
            hideLabel
            value={body}
            onChange={(next) => {
              setBody(next);
              setDirty(true);
            }}
            worldId={worldId}
            campaignId={campaignId}
          />
        ) : (
          <EntityRefPreview
            body={body}
            worldId={worldId}
            campaignId={campaignId}
            noteName={name}
            sx={{
              maxWidth: 800,
              mx: 'auto',
              px: { xs: 2, sm: 5 },
              py: 4,
              fontSize: 16,
              lineHeight: 1.75,
              bgcolor: 'background.default',
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              minHeight: 400,
            }}
          />
        )}
      </Paper>

      {existing?.kind === 'session_prep' && <AttachedChatsSection worldId={worldId} campaignId={campaignId} noteId={existing.id} />}
    </SectionLayout>
  );
}
