import { useEffect, useMemo, useState } from 'react';
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
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EventNoteIcon from '@mui/icons-material/EventNoteOutlined';
import AutoStoriesIcon from '@mui/icons-material/AutoStoriesOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import HomeIcon from '@mui/icons-material/HomeOutlined';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewComfyIcon from '@mui/icons-material/ViewComfy';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import TableRowsIcon from '@mui/icons-material/TableRows';
import { ConfirmDeleteDialog } from '../dm/ConfirmDeleteDialog';
import { useNoteStore, getFoldersForCampaign, getNotesForCampaign } from '../../store/useNoteStore';
import type { Note, NoteFolder } from '../../types/note';
import { SESSION_TEMPLATES, NARRATIVE_TEMPLATES, type NoteTemplate } from '../../types/noteTemplates';

interface NotesFolderExplorerProps {
  campaignId: string;
}

type EditingTarget = { type: 'folder' | 'note'; id: string } | null;
type DeleteTarget = { type: 'folder' | 'note'; id: string; name: string } | null;
type ViewMode = 'large' | 'medium' | 'small' | 'tiles' | 'details';

const VIEW_MODE_STORAGE_KEY = 'worldwatcher.notes.viewMode';

const VIEW_MODES: { value: ViewMode; label: string; icon: JSX.Element }[] = [
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
  const deleteNote = useNoteStore((s) => s.deleteNote);
  const updateNote = useNoteStore((s) => s.updateNote);

  useEffect(() => {
    ensureSeeded(campaignId);
  }, [campaignId, ensureSeeded]);

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

  const goToNote = (noteId: string) => navigate(`/w/${worldId}/c/${campaignId}/notes/${noteId}`);

  const startRename = (target: { type: 'folder' | 'note'; id: string; name: string }) => {
    setEditing({ type: target.type, id: target.id });
    setEditingValue(target.name);
  };
  const commitRename = () => {
    const name = editingValue.trim();
    if (editing && name) {
      if (editing.type === 'folder') renameFolder(editing.id, name);
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

  const handleNewNote = () => {
    const note: Note = {
      id: crypto.randomUUID(),
      campaignId,
      folderId: currentFolderId,
      name: 'Untitled note',
      kind: null,
      body: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addNote(note);
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
      body: SESSION_TEMPLATES[0].build(name),
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
      body: template.build(name),
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
    else deleteNote(deleteTarget.id);
    setDeleteTarget(null);
  };

  const kindLabel = (note: Note) => (note.kind === 'session_prep' ? 'Session' : note.kind === 'narrative' ? 'Narrative' : 'Note');

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

  const isEmpty = childFolders.length === 0 && childNotes.length === 0;

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
        {/* Breadcrumb path + directory toolbar */}
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
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
            <Button size="small" startIcon={<CreateNewFolderIcon fontSize="small" />} onClick={() => { setAddingKind('folder'); setAddingValue(''); }}>
              New folder
            </Button>
            <Button size="small" startIcon={<NoteAddIcon fontSize="small" />} onClick={handleNewNote}>
              New note
            </Button>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <ToggleButtonGroup size="small" exclusive value={viewMode} onChange={(_e, v) => v && setViewMode(v)}>
              {VIEW_MODES.map((m) => (
                <ToggleButton key={m.value} value={m.value}>
                  <Tooltip title={m.label}>{m.icon}</Tooltip>
                </ToggleButton>
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
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              This folder is empty. Use "New folder" or "New note" above to add something.
            </Typography>
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
                              <Stack direction="row" justifyContent="flex-end">
                                <IconButton size="small" onClick={commitRename}>
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => setEditing(null)}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            ) : (
                              <Stack direction="row" justifyContent="flex-end">
                                <Tooltip title={locked ? "Sessions and Narratives can't be renamed or deleted" : 'Rename'}>
                                  <span>
                                    <IconButton size="small" disabled={locked} onClick={() => startRename({ type: 'folder', id: folder.id, name: folder.name })}>
                                      <EditIcon sx={{ fontSize: 15 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Tooltip title={locked ? "Sessions and Narratives can't be renamed or deleted" : 'Delete'}>
                                  <span>
                                    <IconButton size="small" disabled={locked} onClick={() => setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name })}>
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
                              <DescriptionIcon color="action" fontSize="small" />
                              {isEditing ? renameField(editingValue, commitRename, () => setEditing(null)) : (
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {note.name}
                                </Typography>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>{kindLabel(note)}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>{formatModified(note.updatedAt)}</TableCell>
                          <TableCell>{formatBytes(note.body.length)}</TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            {isEditing ? (
                              <Stack direction="row" justifyContent="flex-end">
                                <IconButton size="small" onClick={commitRename}>
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => setEditing(null)}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            ) : (
                              <Stack direction="row" justifyContent="flex-end">
                                <Tooltip title="Rename">
                                  <IconButton size="small" onClick={() => startRename({ type: 'note', id: note.id, name: note.name })}>
                                    <EditIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton size="small" onClick={() => setDeleteTarget({ type: 'note', id: note.id, name: note.name })}>
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
                          <Tooltip title={locked ? "Sessions and Narratives can't be renamed or deleted" : 'Rename'}>
                            <span>
                              <IconButton
                                size="small"
                                disabled={locked}
                                onClick={(e) => { e.stopPropagation(); startRename({ type: 'folder', id: folder.id, name: folder.name }); }}
                              >
                                <EditIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={locked ? "Sessions and Narratives can't be renamed or deleted" : 'Delete'}>
                            <span>
                              <IconButton
                                size="small"
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
                        <DescriptionIcon color="action" sx={{ fontSize: config.iconSize }} />
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
                              onClick={(e) => { e.stopPropagation(); startRename({ type: 'note', id: note.id, name: note.name }); }}
                            >
                              <EditIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
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
                      note.kind && (
                        <Chip
                          label={kindLabel(note)}
                          size="small"
                          color={note.kind === 'session_prep' ? 'primary' : 'secondary'}
                          variant="outlined"
                          sx={{ mt: 1 }}
                        />
                      )
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
