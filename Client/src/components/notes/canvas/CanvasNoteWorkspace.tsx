import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Popover from '@mui/material/Popover';
import TuneIcon from '@mui/icons-material/Tune';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import AccountTreeIcon from '@mui/icons-material/AccountTreeOutlined';
import { WhiteboardEditor } from './WhiteboardEditor';
import { ContentTreeEditor } from './ContentTreeEditor';
import { NoteTagsField } from '../NoteTagsField';
import { useNoteStore, getFoldersForCampaign } from '../../../store/useNoteStore';
import { NOTE_DOC_TYPE_META } from '../../../types/noteCanvas';
import type { Note, NoteFolder } from '../../../types/note';

interface CanvasNoteWorkspaceProps {
  worldId: string;
  campaignId: string;
  note: Note;
}

/** The page frame around a whiteboard or content-tree note: breadcrumbs, an inline-editable
 * title, and the options (folder, tags) a canvas has no room for - then the editor itself,
 * filling every remaining pixel.
 *
 * Deliberately NOT the text note's view/write/preview frame. There is nothing to preview on a
 * canvas (what you edit is what it looks like) and nothing to Save (see useCanvasDoc), so the
 * three-mode toolbar would be three controls that all did nothing. */
export function CanvasNoteWorkspace({ worldId, campaignId, note }: CanvasNoteWorkspaceProps) {
  const updateNote = useNoteStore((s) => s.updateNote);
  const folders = useNoteStore((s) => s.folders);
  const campaignFolders = getFoldersForCampaign(folders, campaignId);
  const [name, setName] = useState(note.name);
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);

  const meta = NOTE_DOC_TYPE_META[note.docType];

  const folderPath: NoteFolder[] = [];
  let cursor = campaignFolders.find((f) => f.id === note.folderId) ?? null;
  while (cursor) {
    folderPath.unshift(cursor);
    const parentId: string | null = cursor.parentId;
    cursor = parentId ? campaignFolders.find((f) => f.id === parentId) ?? null : null;
  }

  const commitName = () => {
    const trimmed = name.trim() || (note.docType === 'tree' ? 'Untitled tree' : 'Untitled board');
    setName(trimmed);
    if (trimmed !== note.name) updateNote(note.id, { name: trimmed });
  };

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <Box sx={{ px: 2, pt: 1.5, pb: 1, flexShrink: 0 }}>
        <MuiBreadcrumbs aria-label="breadcrumb" sx={{ mb: 0.5 }}>
          <Link component={RouterLink} to={`/w/${worldId}/c/${campaignId}/notes`} underline="hover" color="inherit">
            Notes
          </Link>
          {folderPath.map((folder) => (
            <Link
              key={folder.id}
              component={RouterLink}
              to={`/w/${worldId}/c/${campaignId}/notes?folderId=${folder.id}`}
              underline="hover"
              color="inherit"
            >
              {folder.name}
            </Link>
          ))}
          <Typography color="text.primary" sx={{ fontWeight: 700 }}>
            {note.name}
          </Typography>
        </MuiBreadcrumbs>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            variant="standard"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            placeholder={note.docType === 'tree' ? 'Tree title…' : 'Board title…'}
            slotProps={{ input: { disableUnderline: true, sx: { fontSize: 26, fontWeight: 700 } } }}
            sx={{ flexGrow: 1, minWidth: 0 }}
          />
          <Chip
            size="small"
            variant="outlined"
            icon={note.docType === 'tree' ? <AccountTreeIcon fontSize="small" /> : <DashboardCustomizeIcon fontSize="small" />}
            label={meta.label}
          />
          {note.tags.map((tag) => (
            <Chip key={tag} size="small" label={tag} />
          ))}
          <Tooltip title="Folder and tags">
            <IconButton size="small" aria-label="Note options" onClick={(e) => setOptionsAnchor(e.currentTarget)}>
              <TuneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Popover
        open={optionsAnchor !== null}
        anchorEl={optionsAnchor}
        onClose={() => setOptionsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 2, width: 320, borderRadius: 2 } } }}
      >
        <Stack spacing={2}>
          <TextField
            select
            size="small"
            label="Folder"
            value={note.folderId ?? ''}
            onChange={(e) => updateNote(note.id, { folderId: e.target.value || null })}
            fullWidth
          >
            <MenuItem value="">(none)</MenuItem>
            {campaignFolders.map((folder) => (
              <MenuItem key={folder.id} value={folder.id}>
                {folder.name}
              </MenuItem>
            ))}
          </TextField>
          <NoteTagsField value={note.tags} onChange={(tags) => updateNote(note.id, { tags })} />
          <Typography variant="caption" color="text.secondary">
            {meta.description} Changes to the canvas save themselves as you work.
          </Typography>
        </Stack>
      </Popover>

      <Paper variant="outlined" sx={{ flexGrow: 1, minHeight: 0, borderRadius: 0, borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
        {/* keyed by note id: each editor owns its document while open (see useCanvasDoc), so
            moving between two boards has to hand the next one a fresh editor. */}
        {note.docType === 'tree' ? (
          <ContentTreeEditor key={note.id} note={note} />
        ) : (
          <WhiteboardEditor key={note.id} note={note} />
        )}
      </Paper>
    </Stack>
  );
}
