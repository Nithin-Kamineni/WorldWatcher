import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneIcon from '@mui/icons-material/Tune';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import EditNoteIcon from '@mui/icons-material/EditNoteOutlined';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNewOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { useUnsavedDraft } from '../../hooks/useUnsavedDraft';
import { TipTapArticleEditor } from '../../components/world/richtext/TipTapArticleEditor';
import { toEditorHtml } from '../../components/world/richtext/bbcodeMigration';
import { NoteContentView } from '../../components/notes/NoteContentView';
import { NoteTagsField } from '../../components/notes/NoteTagsField';
import { CanvasNoteWorkspace } from '../../components/notes/canvas/CanvasNoteWorkspace';
import { useWorldStore, getWorldById } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';
import { useNoteStore, getNoteById, getFoldersForCampaign } from '../../store/useNoteStore';
import { useSessionChatStore, getChatsForNote } from '../../store/useSessionChatStore';
import { openChatInPlay } from '../../components/play/openChatInPlay';
import type { Note, NoteFolder } from '../../types/note';

/** Session notes' attached DM-chat threads (issues.txt 10.b.3: "must be saved in the folders
 * section in the session folder and I must be able to see it, also edit it") - shown right on
 * the session-prep note's own page, since that's this note's real home even though
 * SessionChat rows aren't literal sibling files inside NotesFolderExplorer's own listing.
 *
 * Opening one goes to the standalone chat page (ChatDetailPage), NOT the Play page: reading
 * or editing a saved thread is a documents job, and the Play page is for running a session.
 * "Run in Play" is still here as its own explicit action for the latter. */
function AttachedChatsSection({ worldId, campaignId, noteId }: { worldId: string; campaignId: string; noteId: string }) {
  const navigate = useNavigate();
  const chats = useSessionChatStore((s) => s.chats);
  const fetchChatsForNote = useSessionChatStore((s) => s.fetchChatsForNote);
  const notes = useNoteStore((s) => s.notes);

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
            sx={{
              alignItems: 'center',
              p: 1,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
            onClick={() => navigate(`/w/${worldId}/c/${campaignId}/chats/${chat.id}`)}
          >
            <ForumOutlinedIcon fontSize="small" color="action" />
            <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 600 }}>
              {chat.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {chat.messages.length} note{chat.messages.length === 1 ? '' : 's'}
            </Typography>
            <Tooltip title="Open the thread to read and edit its messages">
              <IconButton
                size="small"
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/w/${worldId}/c/${campaignId}/chats/${chat.id}`);
                }}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              startIcon={<PlayArrowIcon fontSize="small" />}
              // The one action that still belongs on the Play page: run this thread beside the
              // session notes, in a real Chat window.
              onClick={(e) => {
                e.stopPropagation();
                openChatInPlay(
                  chat,
                  campaignId,
                  worldId,
                  notes.filter((n) => n.campaignId === campaignId && n.kind === 'session_prep'),
                  navigate,
                );
              }}
            >
              Run in Play
            </Button>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

/** "3 minutes ago" for the draft-recovery bar - deliberately coarse, since the only question it
 * has to answer is "is this the edit I just lost, or something older?". */
function formatDraftAge(savedAt: number | null): string {
  if (!savedAt) return 'a moment ago';
  const minutes = Math.round((Date.now() - savedAt) / 60000);
  if (minutes < 1) return 'moments ago';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Create/read/edit page for a single Note - handles both /notes/new (create into ?folderId=)
 * and /notes/:noteId.
 *
 * Built to the same shape as ArticleDetailPage + ArticleForm, deliberately, because a session
 * or narrative note is the same kind of document an article is and had no business being
 * edited in a raw-BBCode textarea while articles got a real editor:
 *
 *   - three modes, not two: a saved note OPENS in a reading view (NoteContentView) and only
 *     becomes editable on Edit, exactly like an article; Preview shows the unsaved draft
 *     through that same reading view.
 *   - the body is the rich text editor (TipTapArticleEditor) with "@"-mentions turned on, so
 *     bold/headings/lists/tables/collapsible+secret blocks all work here too. Legacy BBCode
 *     bodies are converted once on open (toEditorHtml) and saved back as HTML - the mention
 *     tags survive that conversion as entityRef nodes, see EntityRefNode.
 *   - the title is edited in place at the top of the canvas rather than through a breadcrumb
 *     pencil, and everything secondary (folder, tags) moved into "More options".
 *
 * Saving is still one explicit Save (no autosave-on-blur), so a half-written body is never
 * silently persisted mid-keystroke. */
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
  const loadedCampaignIds = useNoteStore((s) => s.loadedCampaignIds);
  const ensureSeeded = useNoteStore((s) => s.ensureSeeded);
  const addNote = useNoteStore((s) => s.addNote);
  const updateNote = useNoteStore((s) => s.updateNote);

  useEffect(() => {
    if (campaignId) ensureSeeded(campaignId);
  }, [campaignId, ensureSeeded]);

  const isNew = !noteId;
  const existing = getNoteById(notes, noteId);
  const campaignFolders = getFoldersForCampaign(folders, campaignId);

  /** view = the saved note as it reads; write = the editor; preview = the DRAFT as it reads. */
  const [mode, setMode] = useState<'view' | 'write' | 'preview'>(isNew ? 'write' : 'view');
  const [name, setName] = useState(existing?.name ?? '');
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [folderId, setFolderId] = useState<string | null>(existing?.folderId ?? folderIdParam);
  const [body, setBody] = useState(() => toEditorHtml(existing?.body ?? ''));
  const [dirty, setDirty] = useState(false);

  /** Mirrors the in-progress edit so leaving by the breadcrumb or the icon rail no longer
   * throws it away silently, and warns before the tab closes on top of it (checklist I-N6). */
  const draftGuard = useUnsavedDraft(
    `worldwatcher:note-draft:${campaignId ?? 'none'}:${noteId ?? 'new'}`,
    { name, tags, folderId, body },
    dirty,
  );

  useEffect(() => {
    setName(existing?.name ?? '');
    setTags(existing?.tags ?? []);
    setFolderId(existing?.folderId ?? folderIdParam);
    setBody(toEditorHtml(existing?.body ?? ''));
    setDirty(false);
    setMode(noteId ? 'view' : 'write');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  /** Adopts the recovered draft into the editor and opens Write on it. */
  const restoreDraft = () => {
    const draft = draftGuard.recovered;
    if (!draft) return;
    setName(draft.name);
    setTags(draft.tags);
    setFolderId(draft.folderId);
    setBody(draft.body);
    setDirty(true);
    setMode('write');
    draftGuard.discardRecovered();
  };

  const folder = campaignFolders.find((f) => f.id === folderId);
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

  if (!worldId || !campaignId) return <Navigate to="/dashboard" replace />;
  // "This note does not exist" and "the notes have not arrived yet" look identical from
  // here, and on a fresh page load it is always the second one - ensureSeeded runs in an
  // effect, so the first render of a deep link (a reload, a bookmark, a link from elsewhere)
  // has an empty store. Redirecting on that render threw the user back to the folder list
  // every time they reloaded a note. Wait for the campaign's notes to actually be loaded
  // before deciding the note is missing.
  if (!isNew && !existing) {
    if (!loadedCampaignIds.includes(campaignId)) {
      return (
        <SectionLayout worldId={worldId} campaignId={campaignId}>
          <Stack sx={{ alignItems: 'center', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={28} />
          </Stack>
        </SectionLayout>
      );
    }
    return <Navigate to={`/w/${worldId}/c/${campaignId}/notes`} replace />;
  }

  // A whiteboard or a content tree is not a written page and does not open in this editor -
  // it gets the full-bleed canvas workspace instead, which has no Write/Preview/Save because
  // a canvas has nothing to preview and saves itself. Everything below here is the text
  // document editor, unchanged.
  if (existing && existing.docType !== 'text') {
    return (
      <SectionLayout worldId={worldId} campaignId={campaignId} disableContentPadding>
        <CanvasNoteWorkspace key={existing.id} worldId={worldId} campaignId={campaignId} note={existing} />
      </SectionLayout>
    );
  }

  const markDirty = () => setDirty(true);


  const handleSave = () => {
    const trimmedName = name.trim() || 'Untitled note';
    if (isNew) {
      const note: Note = {
        id: crypto.randomUUID(),
        campaignId,
        folderId,
        name: trimmedName,
        kind: null,
        docType: 'text',
        body,
        canvas: null,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addNote(note);
      draftGuard.clear();
      setDirty(false);
      navigate(`/w/${worldId}/c/${campaignId}/notes/${note.id}`, { replace: true });
    } else if (existing) {
      updateNote(existing.id, { name: trimmedName, tags, body, folderId });
      draftGuard.clear();
      setDirty(false);
      setMode('view');
    }
  };

  const handleCancel = () => {
    // An explicit Cancel is the DM saying "throw this away" - the recovery draft goes with it,
    // or the next visit would offer back exactly what they just discarded.
    draftGuard.clear();
    setDirty(false);
    if (isNew) {
      navigate(`/w/${worldId}/c/${campaignId}/notes${folderIdParam ? `?folderId=${folderIdParam}` : ''}`);
      return;
    }
    setName(existing?.name ?? '');
    setTags(existing?.tags ?? []);
    setFolderId(existing?.folderId ?? null);
    setBody(toEditorHtml(existing?.body ?? ''));
    setDirty(false);
    setMode('view');
  };

  const displayName = name.trim() || 'Untitled note';

  return (
    <SectionLayout worldId={worldId} campaignId={campaignId}>
      <MuiBreadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
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
        <Typography color="text.primary" sx={{ fontWeight: 700 }}>
          {displayName}
        </Typography>
      </MuiBreadcrumbs>

      <Box sx={{ maxWidth: 920 }}>
        {draftGuard.recovered && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <>
                <Button color="inherit" size="small" onClick={restoreDraft}>
                  Restore
                </Button>
                <Button color="inherit" size="small" onClick={draftGuard.discardRecovered}>
                  Discard
                </Button>
              </>
            }
          >
            You have unsaved edits to this note from {formatDraftAge(draftGuard.recoveredAt)}.
          </Alert>
        )}
        {mode === 'view' && existing ? (
          <NoteContentView
            worldId={worldId}
            campaignId={campaignId}
            name={existing.name}
            kind={existing.kind}
            tags={existing.tags}
            body={existing.body}
            onBodyChange={(html) => updateNote(existing.id, { body: html })}
            headerActions={
              <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => setMode('write')}>
                Edit
              </Button>
            }
          />
        ) : (
          <>
            <Stack
              direction="row"
              sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 2,
                bgcolor: 'background.default',
                py: 1.5,
                mb: 2,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_e, v) => v && setMode(v)}>
                <ToggleButton value="write">
                  <EditNoteIcon fontSize="small" sx={{ mr: 0.5 }} /> Write
                </ToggleButton>
                <ToggleButton value="preview">
                  <VisibilityIcon fontSize="small" sx={{ mr: 0.5 }} /> Preview
                </ToggleButton>
              </ToggleButtonGroup>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                {dirty && (
                  <Typography variant="caption" color="text.secondary">
                    Unsaved changes
                  </Typography>
                )}
                <Button onClick={handleCancel} color="inherit">
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={!isNew && !dirty}
                >
                  {isNew ? 'Create note' : 'Save changes'}
                </Button>
              </Stack>
            </Stack>

            {mode === 'preview' ? (
              <NoteContentView
                worldId={worldId}
                campaignId={campaignId}
                name={displayName}
                kind={existing?.kind ?? null}
                tags={tags}
                body={body}
              />
            ) : (
              <Stack spacing={2.5}>
                <TextField
                  variant="standard"
                  placeholder="Note title…"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    markDirty();
                  }}
                  fullWidth
                  autoFocus={isNew}
                  slotProps={{ input: { disableUnderline: true, sx: { fontSize: 34, fontWeight: 700 } } }}
                />

                <TipTapArticleEditor
                  value={body}
                  onChange={(next) => {
                    setBody(next);
                    markDirty();
                  }}
                  placeholder='Write this note… type "@" to mention an NPC, place, encounter…'
                  mentions={{ worldId, campaignId }}
                />

                <Accordion disableGutters sx={{ '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <TuneIcon fontSize="small" color="action" />
                      <Typography sx={{ fontWeight: 600 }}>More options</Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2.5}>
                      <TextField
                        select
                        label="Folder"
                        value={folderId ?? ''}
                        onChange={(e) => {
                          setFolderId(e.target.value || null);
                          markDirty();
                        }}
                        fullWidth
                      >
                        <MenuItem value="">(none)</MenuItem>
                        {campaignFolders.map((f) => (
                          <MenuItem key={f.id} value={f.id}>
                            {f.name}
                          </MenuItem>
                        ))}
                      </TextField>

                      <NoteTagsField
                        value={tags}
                        onChange={(next) => {
                          setTags(next);
                          markDirty();
                        }}
                      />
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Stack>
            )}
          </>
        )}
      </Box>

      {existing?.kind === 'session_prep' && <AttachedChatsSection worldId={worldId} campaignId={campaignId} noteId={existing.id} />}
    </SectionLayout>
  );
}
