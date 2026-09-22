import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolderOutlined';
import NoteAddIcon from '@mui/icons-material/NoteAddOutlined';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import AccountTreeIcon from '@mui/icons-material/AccountTreeOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EventNoteIcon from '@mui/icons-material/EventNoteOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import AddCommentIcon from '@mui/icons-material/AddCommentOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrowRounded';
import OpenInNewIcon from '@mui/icons-material/OpenInNewOutlined';
import AutoStoriesIcon from '@mui/icons-material/AutoStoriesOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import HomeIcon from '@mui/icons-material/HomeOutlined';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewComfyIcon from '@mui/icons-material/ViewComfy';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import TableRowsIcon from '@mui/icons-material/TableRows';
import { ConfirmDeleteDialog } from '../dm/ConfirmDeleteDialog';
import { SECTION_HEADER_HEIGHT } from '../../theme/headerScale';
import { useNoteStore, getFoldersForCampaign, getNotesForCampaign } from '../../store/useNoteStore';
import { useSessionChatStore, getChatsForCampaign } from '../../store/useSessionChatStore';
import { openChatInPlay } from '../play/openChatInPlay';
import type { SessionChat } from '../../types/sessionChat';
import type { Note, NoteFolder } from '../../types/note';
import {
  NOTE_DOC_TYPES,
  NOTE_DOC_TYPE_META,
  canvasItemCount,
  emptyWhiteboard,
  seedTree,
  type NoteCanvas,
  type NoteDocType,
} from '../../types/noteCanvas';
import { SESSION_TEMPLATES, NARRATIVE_TEMPLATES, type NoteTemplate } from '../../types/noteTemplates';

interface NotesFolderExplorerProps {
  campaignId: string;
}

type EditingTarget = { type: 'folder' | 'note' | 'chat'; id: string } | null;
type DeleteTarget = { type: 'folder' | 'note' | 'chat'; id: string; name: string } | null;
type ViewMode = 'large' | 'medium' | 'small' | 'tiles' | 'details';

const VIEW_MODE_STORAGE_KEY = 'worldwatcher.notes.viewMode';

const VIEW_MODES: { value: ViewMode; label: string; icon: ReactElement }[] = [
  { value: 'large', label: 'Large icons', icon: <GridViewIcon fontSize="small" /> },
  { value: 'medium', label: 'Medium icons', icon: <ViewModuleIcon fontSize="small" /> },
  { value: 'small', label: 'Small icons', icon: <ViewComfyIcon fontSize="small" /> },
  { value: 'tiles', label: 'Tiles', icon: <ViewAgendaIcon fontSize="small" /> },
  { value: 'details', label: 'Detailed list', icon: <TableRowsIcon fontSize="small" /> },
];

const GRID_CONFIG: Record<Exclude<ViewMode, 'details'>, { minWidth: number; iconSize: number; padding: number; gap: number; showSubtitle: boolean }> = {
  large: { minWidth: 220, iconSize: 40, padding: 2, gap: 2, showSubtitle: true },
  medium: { minWidth: 180, iconSize: 24, padding: 1.5, gap: 1.5, showSubtitle: false },
  small: { minWidth: 130, iconSize: 18, padding: 1, gap: 1, showSubtitle: false },
  tiles: { minWidth: 260, iconSize: 32, padding: 1.5, gap: 1.5, showSubtitle: true },
};

/** One icon per file type, used by every view mode - a board and a tree have to be
 * distinguishable from a written page at a glance in the listing, the same way a folder is. */
const DOC_TYPE_ICON: Record<NoteDocType, typeof DescriptionIcon> = {
  text: DescriptionIcon,
  whiteboard: DashboardCustomizeIcon,
  tree: AccountTreeIcon,
};

/** What a new file of each type starts out as. A whiteboard opens empty (its toolbar is the
 * first thing to use); a tree opens with one root, because an empty tree canvas gives you
 * nothing to grow from. */
function newFileContent(docType: NoteDocType, name: string): { body: string; canvas: NoteCanvas | null } {
  if (docType === 'whiteboard') return { body: '', canvas: emptyWhiteboard() };
  if (docType === 'tree') return { body: '', canvas: seedTree(name) };
  return { body: '', canvas: null };
}

const NEW_FILE_NAME: Record<NoteDocType, string> = {
  text: 'Untitled note',
  whiteboard: 'Untitled board',
  tree: 'Untitled tree',
};

function todayLabel(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function formatModified(ts: number | null): string {
  if (ts === null) return '—';
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function collectDescendantFolderIds(folderId: string, folders: NoteFolder[]): string[] {
  const direct = folders.filter((f) => f.parentId === folderId);
  return direct.flatMap((f) => [f.id, ...collectDescendantFolderIds(f.id, folders)]);
}

/** Stats shown in "Tiles" and "Detailed list" views - folders don't carry their own byte size
 * (there's nothing to size), so folders report a recursive document count instead, mirroring
 * how Windows Explorer leaves a folder's Size column blank and shows item count elsewhere. */
function getFolderStats(folder: NoteFolder, folders: NoteFolder[], notes: Note[]) {
  const descendantFolderIds = collectDescendantFolderIds(folder.id, folders);
  const allIds = [folder.id, ...descendantFolderIds];
  const containedNotes = notes.filter((n) => n.folderId && allIds.includes(n.folderId));
  const lastModified = containedNotes.reduce((max, n) => Math.max(max, n.updatedAt), folder.updatedAt);
  return {
    docCount: containedNotes.length,
    lastModified,
  };
}

/** File-explorer-style browser for a campaign's Notes (session-prep sheets, narrative/arc
 * planning entries, and freeform notes) - a single-pane breadcrumb-navigated directory view,
 * distinct from ArticleFolderTree's always-visible sidebar tree, since Notes needs a bigger,
 * more "professional" main-content browsing surface plus two prominent quick-create actions. */
export function NotesFolderExplorer({ campaignId }: NotesFolderExplorerProps) {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();

  const allFolders = useNoteStore((s) => s.folders);
  const allNotes = useNoteStore((s) => s.notes);
  const ensureSeeded = useNoteStore((s) => s.ensureSeeded);
  const addFolder = useNoteStore((s) => s.addFolder);
  const renameFolder = useNoteStore((s) => s.renameFolder);
  const deleteFolder = useNoteStore((s) => s.deleteFolder);
  const addNote = useNoteStore((s) => s.addNote);
  const allChats = useSessionChatStore((s) => s.chats);
  const fetchChatsForCampaign = useSessionChatStore((s) => s.fetchChatsForCampaign);
  const addChat = useSessionChatStore((s) => s.addChat);
  const renameChat = useSessionChatStore((s) => s.renameChat);
  const deleteChat = useSessionChatStore((s) => s.deleteChat);
  const deleteNote = useNoteStore((s) => s.deleteNote);
  const updateNote = useNoteStore((s) => s.updateNote);

  useEffect(() => {
    ensureSeeded(campaignId);
    void fetchChatsForCampaign(campaignId);
  }, [campaignId, ensureSeeded, fetchChatsForCampaign]);

  const folders = getFoldersForCampaign(allFolders, campaignId);
  const notes = getNotesForCampaign(allNotes, campaignId);

  // Kept in the URL (rather than plain useState) so a note's breadcrumb can deep-link back
  // into the exact folder it lives in - see NoteDetailPage's ancestor breadcrumb links.
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get('folderId');
  const setCurrentFolderId = (id: string | null) => {
    setSearchParams((prev) => {
      if (id) prev.set('folderId', id);
      else prev.delete('folderId');
      return prev;
    });
  };

  const [editing, setEditing] = useState<EditingTarget>(null);
  const [editingValue, setEditingValue] = useState('');
  const [addingKind, setAddingKind] = useState<'folder' | null>(null);
  const [addingValue, setAddingValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [narrativeMenuAnchor, setNarrativeMenuAnchor] = useState<HTMLElement | null>(null);
  const [newFileMenuAnchor, setNewFileMenuAnchor] = useState<HTMLElement | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      return (VIEW_MODES.find((m) => m.value === stored)?.value ?? 'medium');
    } catch {
      return 'medium';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // localStorage unavailable (private browsing, etc.) - view mode just won't persist.
    }
  }, [viewMode]);

  const path = useMemo(() => {
    const chain: NoteFolder[] = [];
    let cursor = folders.find((f) => f.id === currentFolderId) ?? null;
    while (cursor) {
      chain.unshift(cursor);
      cursor = folders.find((f) => f.id === cursor!.parentId) ?? null;
    }
    return chain;
  }, [folders, currentFolderId]);

  const childFolders = folders.filter((f) => f.parentId === currentFolderId);
  const childNotes = notes.filter((n) => n.folderId === currentFolderId);

  // issues.txt 10.b.3 - "DM Notes" is a protected folder inside Sessions whose contents are
  // the DM's chat threads, not Notes. SessionChat has no folder_id of its own (a chat belongs
  // to a NOTE), and deliberately still doesn't: this ONE folder is the view onto them, which
  // avoids giving a chat a second, competing owner. Every other folder lists notes as before.
  const currentFolder = folders.find((f) => f.id === currentFolderId);
  const isDmNotesFolder = currentFolder?.defaultKind === 'dm_notes';
  const childChats = isDmNotesFolder ? getChatsForCampaign(allChats, campaignId) : [];
  const sessionNotes = notes.filter((n) => n.kind === 'session_prep').sort((a, b) => b.updatedAt - a.updatedAt);

  const goToNote = (noteId: string) => navigate(`/w/${worldId}/c/${campaignId}/notes/${noteId}`);
  /** Opening a thread from the folder tree is reading/editing a document, so it lands on the
   * thread's own page (ChatDetailPage), the same way opening a note lands on the note's page.
   * The Play page is a separate, explicit action - see runChatInPlay. */
  const goToChat = (chat: SessionChat) => navigate(`/w/${worldId}/c/${campaignId}/chats/${chat.id}`);
  /** Runs the thread live: a real Chat window on the Play page, beside the session notes -
   * see openChatInPlay for why that's more than a bare navigate. */
  const runChatInPlay = (chat: SessionChat) => openChatInPlay(chat, campaignId, worldId, sessionNotes, navigate);

  const handleNewChat = () => {
    const now = Date.now();
    const chat: SessionChat = {
      id: crypto.randomUUID(),
      campaignId,
      // A thread started here still belongs to a session note - the newest one - so it shows up
      // in that session's Attached chats and in the Chat window's thread menu.
      noteId: sessionNotes[0]?.id ?? null,
      name: `Chat — ${todayLabel()}`,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    addChat(chat);
    goToChat(chat);
  };

  const startRename = (target: { type: 'folder' | 'note' | 'chat'; id: string; name: string }) => {
    setEditing({ type: target.type, id: target.id });
    setEditingValue(target.name);
  };
  const commitRename = () => {
    const name = editingValue.trim();
    if (editing && name) {
      if (editing.type === 'folder') renameFolder(editing.id, name);
      else if (editing.type === 'chat') renameChat(editing.id, name);
      else updateNote(editing.id, { name });
    }
    setEditing(null);
  };

  const commitAddFolder = () => {
    const name = addingValue.trim();
    if (name) {
      addFolder({
        id: crypto.randomUUID(),
        campaignId,
        parentId: currentFolderId,
        name,
        isDefault: false,
        defaultKind: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    setAddingKind(null);
    setAddingValue('');
  };

  /** The one create path for all three file types - the "New" button's menu picks the
   * docType, everything else about making a file is identical. */
  const handleNewFile = (docType: NoteDocType) => {
    const name = NEW_FILE_NAME[docType];
    const note: Note = {
      id: crypto.randomUUID(),
      campaignId,
      folderId: currentFolderId,
      name,
      kind: null,
      docType,
      ...newFileContent(docType, name),
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addNote(note);
    setNewFileMenuAnchor(null);
    goToNote(note.id);
  };

  const handleNewSessionPrep = () => {
    const targetFolder = folders.find((f) => f.isDefault && f.defaultKind === 'session');
    const name = `Session — ${todayLabel()}`;
    const note: Note = {
      id: crypto.randomUUID(),
      campaignId,
      folderId: targetFolder?.id ?? null,
      name,
      kind: 'session_prep',
      docType: 'text',
      body: SESSION_TEMPLATES[0].build(name),
      canvas: null,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addNote(note);
    goToNote(note.id);
  };

  const handleNewNarrativeEntry = (template: NoteTemplate) => {
    const targetFolder = folders.find((f) => f.isDefault && f.defaultKind === 'narrative');
    const existingCount = notes.filter((n) => n.folderId === targetFolder?.id && n.kind === 'narrative').length;
    const name = `${template.label} ${existingCount + 1}`;
    const note: Note = {
      id: crypto.randomUUID(),
      campaignId,
      folderId: targetFolder?.id ?? null,
      name,
      kind: 'narrative',
      docType: 'text',
      body: template.build(name),
      canvas: null,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addNote(note);
    setNarrativeMenuAnchor(null);
    goToNote(note.id);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'folder') deleteFolder(deleteTarget.id);
    else if (deleteTarget.type === 'chat') deleteChat(deleteTarget.id);
    else deleteNote(deleteTarget.id);
    setDeleteTarget(null);
  };

  /** The "Type" a file reports in the listing: its doc type, except that a plain text note
   * still reports the template it was made from, which is the more useful thing to know. */
  const kindLabel = (note: Note) => {
    if (note.docType !== 'text') return NOTE_DOC_TYPE_META[note.docType].label;
    return note.kind === 'session_prep' ? 'Session' : note.kind === 'narrative' ? 'Narrative' : 'Note';
  };

  /** A canvas note's content is its JSON document, not its (empty) body - the "Documents"
   * column already carries how many items are on it, so this stays a real size. */
  const noteSizeLabel = (note: Note) =>
    formatBytes(note.docType === 'text' ? note.body.length : JSON.stringify(note.canvas ?? {}).length);

  const renameField = (value: string, onCommit: () => void, onCancel: () => void) => (
    <TextField
      size="small"
      autoFocus
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setEditingValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit();
        if (e.key === 'Escape') onCancel();
      }}
    />
  );

  const isEmpty = childFolders.length === 0 && childNotes.length === 0 && childChats.length === 0;

  return (
    <Box>
      {/* Quick-create - separate from the folder-browsing chrome below */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<EventNoteIcon />}
          onClick={handleNewSessionPrep}
          sx={{ borderRadius: 2, py: 1, px: 2.5 }}
        >
          New session prep
        </Button>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<AutoStoriesIcon />}
          endIcon={<KeyboardArrowDownIcon />}
          onClick={(e) => setNarrativeMenuAnchor(e.currentTarget)}
          sx={{ borderRadius: 2, py: 1, px: 2.5 }}
        >
          New narrative entry
        </Button>
        <Menu anchorEl={narrativeMenuAnchor} open={narrativeMenuAnchor !== null} onClose={() => setNarrativeMenuAnchor(null)}>
          {NARRATIVE_TEMPLATES.map((template) => (
            <MenuItem key={template.id} onClick={() => handleNewNarrativeEntry(template)} sx={{ maxWidth: 360 }}>
              <ListItemText
                primary={template.label}
                secondary={template.description}
                slotProps={{ secondary: { sx: { whiteSpace: 'normal' } } }}
              />
            </MenuItem>
          ))}
        </Menu>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {/* Breadcrumb path + directory toolbar. On the app's one header scale (checklist
            I-U1) - a minimum rather than a fixed height, because this row is allowed to wrap
            onto a second line when the folder path and the actions cannot share one. */}
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
            px: 1.25,
            py: 0.5,
            minHeight: SECTION_HEADER_HEIGHT,
            bgcolor: 'action.hover',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <MuiBreadcrumbs aria-label="notes folder path">
            <Link
              component="button"
              underline={currentFolderId === null ? 'none' : 'hover'}
              color={currentFolderId === null ? 'text.primary' : 'inherit'}
              onClick={() => setCurrentFolderId(null)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: currentFolderId === null ? 700 : 400 }}
            >
              <HomeIcon sx={{ fontSize: 16 }} />
              Notes
            </Link>
            {path.map((folder, index) => {
              const isLast = index === path.length - 1;
              return (
                <Link
                  key={folder.id}
                  component="button"
                  underline={isLast ? 'none' : 'hover'}
                  color={isLast ? 'text.primary' : 'inherit'}
                  onClick={() => setCurrentFolderId(folder.id)}
                  sx={{ fontWeight: isLast ? 700 : 400 }}
                >
                  {folder.name}
                </Link>
              );
            })}
          </MuiBreadcrumbs>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {/* The DM Notes folder holds chat threads, not notes or subfolders, so it offers the
                one action that belongs there instead of two that would file things it can't show. */}
            {isDmNotesFolder ? (
              <Button size="small" color="secondary" startIcon={<AddCommentIcon fontSize="small" />} onClick={handleNewChat}>
                New chat
              </Button>
            ) : (
              <>
                <Button size="small" startIcon={<CreateNewFolderIcon fontSize="small" />} onClick={() => { setAddingKind('folder'); setAddingValue(''); }}>
                  New folder
                </Button>
                <Button
                  size="small"
                  startIcon={<NoteAddIcon fontSize="small" />}
                  endIcon={<KeyboardArrowDownIcon fontSize="small" />}
                  onClick={(e) => setNewFileMenuAnchor(e.currentTarget)}
                >
                  New note
                </Button>
                {/* A Notes folder holds three kinds of file, so creating one asks which -
                    same menu-button shape as "New narrative entry" above. */}
                <Menu
                  anchorEl={newFileMenuAnchor}
                  open={newFileMenuAnchor !== null}
                  onClose={() => setNewFileMenuAnchor(null)}
                >
                  {NOTE_DOC_TYPES.map((docType) => {
                    const Icon = DOC_TYPE_ICON[docType];
                    return (
                      <MenuItem key={docType} onClick={() => handleNewFile(docType)} sx={{ maxWidth: 360 }}>
                        <Icon fontSize="small" color="action" sx={{ mr: 1.5 }} />
                        <ListItemText
                          primary={NOTE_DOC_TYPE_META[docType].label}
                          secondary={NOTE_DOC_TYPE_META[docType].description}
                          slotProps={{ secondary: { sx: { whiteSpace: 'normal' } } }}
                        />
                      </MenuItem>
                    );
                  })}
                </Menu>
              </>
            )}
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <ToggleButtonGroup size="small" exclusive value={viewMode} onChange={(_e, v) => v && setViewMode(v)}>
              {VIEW_MODES.map((m) => (
                // The Tooltip wraps the BUTTON, not the icon inside it - the other way round
                // renders a visual label while leaving the control itself unnamed (I-U6).
                <Tooltip key={m.value} title={m.label}>
                  <ToggleButton value={m.value} aria-label={m.label} aria-pressed={viewMode === m.value}>
                    {m.icon}
                  </ToggleButton>
                </Tooltip>
              ))}
            </ToggleButtonGroup>
          </Stack>
        </Stack>

        <Box sx={{ p: 2 }}>
          {addingKind === 'folder' && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 1.5 }}>
              <TextField
                size="small"
                autoFocus
                placeholder="Folder name"
                value={addingValue}
                onChange={(e) => setAddingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitAddFolder();
                  if (e.key === 'Escape') setAddingKind(null);
                }}
              />
              <IconButton size="small" onClick={commitAddFolder}>
                <CheckIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => setAddingKind(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}

          {isEmpty && addingKind !== 'folder' && (
            <Stack spacing={1} sx={{ py: 4, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                {isDmNotesFolder
                  ? 'No DM notes yet. A chat thread started here opens on its own page, and can be run in the Play page beside your session notes.'
                  : 'This folder is empty. Use "New folder" above, or "New note" to add a text document, a whiteboard or a content tree.'}
              </Typography>
              {isDmNotesFolder && (
                <Button size="small" variant="outlined" color="secondary" startIcon={<AddCommentIcon />} onClick={handleNewChat}>
                  Start a chat
                </Button>
              )}
            </Stack>
          )}

          {viewMode === 'details' ? (
            !isEmpty && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Documents</TableCell>
                      <TableCell>Last modified</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {childFolders.map((folder) => {
                      const isEditing = editing?.type === 'folder' && editing.id === folder.id;
                      const locked = folder.isDefault;
                      const stats = getFolderStats(folder, folders, notes);
                      return (
                        <TableRow
                          key={folder.id}
                          hover
                          sx={{ cursor: isEditing ? 'default' : 'pointer' }}
                          onClick={() => !isEditing && setCurrentFolderId(folder.id)}
                        >
                          <TableCell>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <FolderIcon color="primary" fontSize="small" />
                              {isEditing ? renameField(editingValue, commitRename, () => setEditing(null)) : (
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {folder.name}
                                </Typography>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>Folder</TableCell>
                          <TableCell>{stats.docCount}</TableCell>
                          <TableCell>{formatModified(stats.lastModified)}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            {isEditing ? (
                              <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                                <IconButton size="small" onClick={commitRename}>
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => setEditing(null)}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            ) : (
                              <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                                <Tooltip title={locked ? "Sessions, Narratives and DM Notes can't be renamed or deleted" : 'Rename'}>
                                  <span>
                                    <IconButton size="small" aria-label={`Rename folder ${folder.name}`} disabled={locked} onClick={() => startRename({ type: 'folder', id: folder.id, name: folder.name })}>
                                      <EditIcon sx={{ fontSize: 15 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Tooltip title={locked ? "Sessions, Narratives and DM Notes can't be renamed or deleted" : 'Delete'}>
                                  <span>
                                    <IconButton size="small" aria-label={`Delete folder ${folder.name}`} disabled={locked} onClick={() => setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name })}>
                                      <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Stack>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {childNotes.map((note) => {
                      const isEditing = editing?.type === 'note' && editing.id === note.id;
                      return (
                        <TableRow
                          key={note.id}
                          hover
                          sx={{ cursor: isEditing ? 'default' : 'pointer' }}
                          onClick={() => !isEditing && goToNote(note.id)}
                        >
                          <TableCell>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              {(() => {
                                const Icon = DOC_TYPE_ICON[note.docType];
                                return <Icon color={note.docType === 'text' ? 'action' : 'primary'} fontSize="small" />;
                              })()}
                              {isEditing ? renameField(editingValue, commitRename, () => setEditing(null)) : (
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {note.name}
                                </Typography>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>{kindLabel(note)}</TableCell>
                          <TableCell>{note.docType === 'text' ? '—' : canvasItemCount(note.docType, note.canvas)}</TableCell>
                          <TableCell>{formatModified(note.updatedAt)}</TableCell>
                          <TableCell>{noteSizeLabel(note)}</TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            {isEditing ? (
                              <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                                <IconButton size="small" onClick={commitRename}>
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => setEditing(null)}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            ) : (
                              <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                                <Tooltip title="Rename">
                                  <IconButton size="small" aria-label={`Rename note ${note.name}`} onClick={() => startRename({ type: 'note', id: note.id, name: note.name })}>
                                    <EditIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton size="small" aria-label={`Delete note ${note.name}`} onClick={() => setDeleteTarget({ type: 'note', id: note.id, name: note.name })}>
                                    <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {childChats.map((chat) => {
                      const isEditing = editing?.type === 'chat' && editing.id === chat.id;
                      return (
                        <TableRow
                          key={chat.id}
                          hover
                          sx={{ cursor: isEditing ? 'default' : 'pointer' }}
                          onClick={() => !isEditing && goToChat(chat)}
                        >
                          <TableCell>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <ForumOutlinedIcon color="secondary" fontSize="small" />
                              {isEditing ? renameField(editingValue, commitRename, () => setEditing(null)) : (
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {chat.name}
                                </Typography>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>DM notes</TableCell>
                          <TableCell>{chat.messages.length}</TableCell>
                          <TableCell>{formatModified(chat.updatedAt)}</TableCell>
                          <TableCell>{formatBytes(chat.messages.reduce((total, m) => total + m.text.length, 0))}</TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            {isEditing ? (
                              <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                                <IconButton size="small" onClick={commitRename}>
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => setEditing(null)}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            ) : (
                              <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                                <Tooltip title="Open the thread - read and edit its messages">
                                  <IconButton size="small" color="primary" onClick={() => goToChat(chat)}>
                                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Run in the Play page chat window">
                                  <IconButton size="small" onClick={() => runChatInPlay(chat)}>
                                    <PlayArrowIcon sx={{ fontSize: 17 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Rename">
                                  <IconButton size="small" aria-label={`Rename chat ${chat.name}`} onClick={() => startRename({ type: 'chat', id: chat.id, name: chat.name })}>
                                    <EditIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton size="small" aria-label={`Delete chat ${chat.name}`} onClick={() => setDeleteTarget({ type: 'chat', id: chat.id, name: chat.name })}>
                                    <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_CONFIG[viewMode].minWidth}px, 1fr))`,
                gap: GRID_CONFIG[viewMode].gap,
              }}
            >
              {childFolders.map((folder) => {
                const isEditing = editing?.type === 'folder' && editing.id === folder.id;
                const locked = folder.isDefault;
                const config = GRID_CONFIG[viewMode];
                const stats = config.showSubtitle ? getFolderStats(folder, folders, notes) : null;
                return (
                  <Paper
                    key={folder.id}
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      p: config.padding,
                      cursor: isEditing ? 'default' : 'pointer',
                      position: 'relative',
                      '&:hover .note-tile-actions': { opacity: 1 },
                      transition: 'box-shadow 0.15s, border-color 0.15s',
                      '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
                    }}
                    onClick={() => !isEditing && setCurrentFolderId(folder.id)}
                  >
                    <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                        <FolderIcon color="primary" sx={{ fontSize: config.iconSize }} />
                        <Box sx={{ minWidth: 0 }}>
                          {isEditing ? renameField(editingValue, commitRename, () => setEditing(null)) : (
                            <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {folder.name}
                            </Typography>
                          )}
                          {stats && !isEditing && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {stats.docCount} doc{stats.docCount === 1 ? '' : 's'} · {formatModified(stats.lastModified)}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                      {!isEditing && (
                        <Stack direction="row" className="note-tile-actions" sx={{ opacity: 0, transition: 'opacity 0.1s' }}>
                          <Tooltip title={locked ? "Sessions, Narratives and DM Notes can't be renamed or deleted" : 'Rename'}>
                            <span>
                              <IconButton
                                size="small"
                                aria-label={`Rename folder ${folder.name}`}
                                disabled={locked}
                                onClick={(e) => { e.stopPropagation(); startRename({ type: 'folder', id: folder.id, name: folder.name }); }}
                              >
                                <EditIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={locked ? "Sessions, Narratives and DM Notes can't be renamed or deleted" : 'Delete'}>
                            <span>
                              <IconButton
                                size="small"
                                aria-label={`Delete folder ${folder.name}`}
                                disabled={locked}
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name }); }}
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      )}
                    </Stack>
                    {isEditing && (
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); commitRename(); }}>
                          <CheckIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditing(null); }}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </Paper>
                );
              })}

              {childNotes.map((note) => {
                const isEditing = editing?.type === 'note' && editing.id === note.id;
                const config = GRID_CONFIG[viewMode];
                return (
                  <Paper
                    key={note.id}
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      p: config.padding,
                      cursor: isEditing ? 'default' : 'pointer',
                      position: 'relative',
                      '&:hover .note-tile-actions': { opacity: 1 },
                      transition: 'box-shadow 0.15s, border-color 0.15s',
                      '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
                    }}
                    onClick={() => !isEditing && goToNote(note.id)}
                  >
                    <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                        {(() => {
                          const Icon = DOC_TYPE_ICON[note.docType];
                          return <Icon color={note.docType === 'text' ? 'action' : 'primary'} sx={{ fontSize: config.iconSize }} />;
                        })()}
                        <Box sx={{ minWidth: 0 }}>
                          {isEditing ? renameField(editingValue, commitRename, () => setEditing(null)) : (
                            <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {note.name}
                            </Typography>
                          )}
                          {config.showSubtitle && !isEditing && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {kindLabel(note)} · {formatModified(note.updatedAt)}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                      {!isEditing && (
                        <Stack direction="row" className="note-tile-actions" sx={{ opacity: 0, transition: 'opacity 0.1s' }}>
                          <Tooltip title="Rename">
                            <IconButton
                              size="small"
                              aria-label={`Rename note ${note.name}`}
                              onClick={(e) => { e.stopPropagation(); startRename({ type: 'note', id: note.id, name: note.name }); }}
                            >
                              <EditIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              aria-label={`Delete note ${note.name}`}
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'note', id: note.id, name: note.name }); }}
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )}
                    </Stack>
                    {isEditing ? (
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); commitRename(); }}>
                          <CheckIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditing(null); }}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ) : (
                      !config.showSubtitle &&
                      (note.kind || note.docType !== 'text') && (
                        <Chip
                          label={kindLabel(note)}
                          size="small"
                          color={note.docType !== 'text' ? 'default' : note.kind === 'session_prep' ? 'primary' : 'secondary'}
                          variant="outlined"
                          sx={{ mt: 1 }}
                        />
                      )
                    )}
                  </Paper>
                );
              })}

              {childChats.map((chat) => {
                const isEditing = editing?.type === 'chat' && editing.id === chat.id;
                const config = GRID_CONFIG[viewMode];
                return (
                  <Paper
                    key={chat.id}
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      p: config.padding,
                      cursor: isEditing ? 'default' : 'pointer',
                      position: 'relative',
                      borderLeft: 3,
                      borderLeftColor: 'secondary.main',
                      '&:hover .note-tile-actions': { opacity: 1 },
                      transition: 'box-shadow 0.15s, border-color 0.15s',
                      '&:hover': { borderColor: 'secondary.main', boxShadow: 1 },
                    }}
                    onClick={() => !isEditing && goToChat(chat)}
                  >
                    <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                        <ForumOutlinedIcon color="secondary" sx={{ fontSize: config.iconSize }} />
                        <Box sx={{ minWidth: 0 }}>
                          {isEditing ? renameField(editingValue, commitRename, () => setEditing(null)) : (
                            <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {chat.name}
                            </Typography>
                          )}
                          {config.showSubtitle && !isEditing && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {chat.messages.length} note{chat.messages.length === 1 ? '' : 's'} · {formatModified(chat.updatedAt)}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                      {!isEditing && (
                        <Stack direction="row" className="note-tile-actions" sx={{ opacity: 0, transition: 'opacity 0.1s' }}>
                          <Tooltip title="Open the thread - read and edit its messages">
                            <IconButton size="small" color="primary" aria-label={`Open chat ${chat.name}`} onClick={(e) => { e.stopPropagation(); goToChat(chat); }}>
                              <OpenInNewIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Run in the Play page chat window">
                            <IconButton size="small" aria-label={`Run ${chat.name} in Play`} onClick={(e) => { e.stopPropagation(); runChatInPlay(chat); }}>
                              <PlayArrowIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Rename">
                            <IconButton size="small" aria-label={`Rename chat ${chat.name}`} onClick={(e) => { e.stopPropagation(); startRename({ type: 'chat', id: chat.id, name: chat.name }); }}>
                              <EditIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" aria-label={`Delete chat ${chat.name}`} onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'chat', id: chat.id, name: chat.name }); }}>
                              <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )}
                    </Stack>
                    {isEditing && (
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); commitRename(); }}>
                          <CheckIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditing(null); }}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      </Paper>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        itemName={deleteTarget?.name ?? ''}
        itemType={deleteTarget?.type === 'folder' ? 'folder' : 'note'}
        description={
          deleteTarget?.type === 'folder'
            ? 'Any subfolders will be deleted too, and notes directly inside will move to the Notes root.'
            : undefined
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
}
